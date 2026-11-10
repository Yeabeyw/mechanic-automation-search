import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type Query,
  type Transaction,
} from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  HttpsError,
  onCall,
  type CallableRequest,
  type FunctionsErrorCode,
} from "firebase-functions/v2/https";
import {
  appendLedgerEvent,
  ledgerHeadRef,
  mechanicRecord,
  requestRecord,
  verifyRecordFingerprint,
} from "./ledger.js";

initializeApp();
setGlobalOptions({ region: "africa-south1", maxInstances: 10 });

const db = getFirestore();
const requestStatuses = [
  "sent",
  "accepted",
  "declined",
  "in_progress",
  "completed",
  "cancelled",
] as const;
type RequestStatus = (typeof requestStatuses)[number];
type AppRole = "customer" | "mechanic" | "admin" | "security_admin";

function requireUid(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  return request.auth.uid;
}

function inputObject(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "The request body must be an object.");
  }
  return data as Record<string, unknown>;
}

function textField(
  data: Record<string, unknown>,
  name: string,
  maxLength: number,
  minLength = 1,
) {
  const value = data[name];
  if (typeof value !== "string" || value.trim().length < minLength || value.length > maxLength) {
    throw new HttpsError("invalid-argument", `${name} must be ${minLength}-${maxLength} characters.`);
  }
  return value.trim();
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpsError("invalid-argument", `Optional text must be at most ${maxLength} characters.`);
  }
  return value.trim() || null;
}

function roleList(data: DocumentData | undefined): AppRole[] {
  const roles: unknown = data?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter(
    (role): role is AppRole =>
      role === "customer" ||
      role === "mechanic" ||
      role === "admin" ||
      role === "security_admin",
  );
}

function asRequestStatus(value: unknown): RequestStatus {
  if (typeof value !== "string" || !requestStatuses.includes(value as RequestStatus)) {
    throw new HttpsError("invalid-argument", "Request status is invalid.");
  }
  return value as RequestStatus;
}

function mechanicCode(uid: string) {
  return `LS-${uid.slice(-8).toUpperCase()}`;
}

function nextReference() {
  return `LS-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function recordMetadata(event: string, recordRef: string, extra: Record<string, unknown> = {}) {
  return {
    event,
    recordRef,
    timestamp: Math.floor(Date.now() / 1000),
    ...extra,
  };
}

export const ensureUserProfile = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const fullName = optionalText(data.fullName, 100);
  const userRef = db.doc(`users/${uid}`);

  const roles = await db.runTransaction(async (transaction) => {
    const profile = await transaction.get(userRef);
    if (profile.exists) {
      if (fullName && !profile.get("full_name")) {
        transaction.update(userRef, { full_name: fullName });
      }
      return roleList(profile.data());
    }

    const tokenName = request.auth?.token.name;
    const tokenEmail = request.auth?.token.email;
    const createdRoles: AppRole[] = ["customer"];
    transaction.create(userRef, {
      full_name: fullName ?? (typeof tokenName === "string" ? tokenName : ""),
      email: typeof tokenEmail === "string" ? tokenEmail : "",
      roles: createdRoles,
      created_at: new Date().toISOString(),
    });
    return createdRoles;
  });

  return { roles };
});

/**
 * Lets a signed-in user change ONLY their own display name. Clients cannot write to
 * users/{uid} (Firestore rules deny it), so this runs with the Admin SDK instead.
 */
export const updateMyProfile = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const fullName = textField(data, "fullName", 100);
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (transaction) => {
    const profile = await transaction.get(userRef);
    if (!profile.exists) throw new HttpsError("failed-precondition", "Your profile is not ready.");
    transaction.update(userRef, { full_name: fullName });
  });
  return { ok: true };
});

export const submitMechanicApplication = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const name = textField(data, "name", 80);
  const workshop = textField(data, "workshop", 80);
  const town = textField(data, "town", 80);
  const bio = optionalText(data.bio, 300);
  const experienceYears = Number(data.experience_years);
  const specialties = data.specialties;
  if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 50) {
    throw new HttpsError("invalid-argument", "experience_years must be between 0 and 50.");
  }
  if (
    !Array.isArray(specialties) ||
    specialties.length === 0 ||
    specialties.length > 6 ||
    !specialties.every(
      (specialty) =>
        typeof specialty === "string" &&
        ["Engine", "Battery", "Tyre", "Brakes", "Electrical", "Other"].includes(specialty),
    )
  ) {
    throw new HttpsError("invalid-argument", "Choose at least one valid repair specialty.");
  }

  const userRef = db.doc(`users/${uid}`);
  const mechanicRef = db.doc(`mechanics/${uid}`);
  const mechanicOwnerRef = db.doc(`mechanic_owners/${uid}`);
  const result = await db.runTransaction(async (transaction) => {
    const [profile, existingMechanic, existingOwner, head] = await Promise.all([
      transaction.get(userRef),
      transaction.get(mechanicRef),
      transaction.get(mechanicOwnerRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (!profile.exists) throw new HttpsError("failed-precondition", "Your Firebase profile is not ready.");
    if (existingMechanic.exists || existingOwner.exists) {
      throw new HttpsError("already-exists", "This account already has a mechanic application.");
    }

    const roles = [...new Set([...roleList(profile.data()), "mechanic" as const])];
    const mechanic = {
      id: uid,
      code: mechanicCode(uid),
      name,
      workshop,
      town,
      experience_years: experienceYears,
      specialties,
      bio,
      verified: false,
      available: false,
      jobs_completed: 0,
      rating: 0,
      is_demo: false,
      photo_key: null,
      created_at: new Date().toISOString(),
    };
    transaction.create(mechanicRef, mechanic);
    transaction.create(mechanicOwnerRef, {
      user_id: uid,
      mechanic_id: uid,
      created_at: mechanic.created_at,
    });
    transaction.update(userRef, { roles });
    await appendLedgerEvent(
      transaction,
      head,
      "MECHANIC_APPLIED",
      "mechanic",
      mechanic.code,
      recordMetadata("MECHANIC_APPLIED", mechanic.code, { verified: false }),
      mechanicRecord(mechanic),
    );
    return { id: uid };
  });

  return result;
});

export const setMechanicAvailability = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  if (typeof data.available !== "boolean") {
    throw new HttpsError("invalid-argument", "available must be true or false.");
  }
  const mechanicRef = db.doc(`mechanics/${uid}`);
  const mechanicOwnerRef = db.doc(`mechanic_owners/${uid}`);
  await db.runTransaction(async (transaction) => {
    const [mechanic, owner] = await Promise.all([
      transaction.get(mechanicRef),
      transaction.get(mechanicOwnerRef),
    ]);
    if (!mechanic.exists || !owner.exists || owner.get("user_id") !== uid) {
      throw new HttpsError("permission-denied", "Only the workshop owner can change availability.");
    }
    transaction.update(mechanicRef, { available: data.available });
  });
});

export const createServiceRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const mechanicId = textField(data, "mechanic_id", 128);
  const category = textField(data, "category", 40);
  const vehicleMake = textField(data, "vehicle_make", 40);
  const vehicleModel = textField(data, "vehicle_model", 40);
  const description = textField(data, "description", 500, 5);
  const vehicleYear =
    data.vehicle_year === null || data.vehicle_year === undefined
      ? null
      : Number(data.vehicle_year);
  const contactPhone = optionalText(data.contact_phone, 20);
  if (!["Engine", "Battery", "Tyre", "Brakes", "Electrical", "Other"].includes(category)) {
    throw new HttpsError("invalid-argument", "Choose a valid repair category.");
  }
  if (
    vehicleYear !== null &&
    (!Number.isInteger(vehicleYear) || vehicleYear < 1970 || vehicleYear > new Date().getFullYear() + 1)
  ) {
    throw new HttpsError("invalid-argument", "vehicle_year is outside the supported range.");
  }

  const customerRef = db.doc(`users/${uid}`);
  const mechanicRef = db.doc(`mechanics/${mechanicId}`);
  const mechanicOwnerRef = db.doc(`mechanic_owners/${mechanicId}`);
  const requestRef = db.collection("service_requests").doc();
  const ref = nextReference();
  const createdAt = new Date().toISOString();
  const newRequest = {
    id: requestRef.id,
    ref,
    customer_id: uid,
    mechanic_id: mechanicId,
    mechanic_owner_id: "",
    category,
    vehicle_make: vehicleMake,
    vehicle_model: vehicleModel,
    vehicle_year: vehicleYear,
    description,
    contact_phone: contactPhone,
    status: "sent" as const,
    created_at: createdAt,
    updated_at: createdAt,
  };

  await db.runTransaction(async (transaction) => {
    const [customer, mechanic, mechanicOwner, head] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(mechanicRef),
      transaction.get(mechanicOwnerRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (!customer.exists || !roleList(customer.data()).includes("customer")) {
      throw new HttpsError("permission-denied", "A customer account is required to send a request.");
    }
    if (
      !mechanic.exists ||
      mechanic.get("verified") !== true ||
      !mechanicOwner.exists ||
      typeof mechanicOwner.get("user_id") !== "string"
    ) {
      throw new HttpsError("not-found", "This mechanic is not available for new requests.");
    }
    newRequest.mechanic_owner_id = String(mechanicOwner.get("user_id"));
    transaction.create(requestRef, newRequest);
    await appendLedgerEvent(
      transaction,
      head,
      "REQUEST_SENT",
      "service_request",
      ref,
      recordMetadata("REQUEST_SENT", ref, {
        category,
        mechanicCode: mechanic.get("code"),
        status: "sent",
      }),
      requestRecord(newRequest, String(mechanic.get("code"))),
    );
  });

  return { id: requestRef.id, ref };
});

export const cancelServiceRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const id = textField(data, "id", 128);
  const requestRef = db.doc(`service_requests/${id}`);

  await db.runTransaction(async (transaction) => {
    const [serviceRequest, head] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (!serviceRequest.exists || serviceRequest.get("customer_id") !== uid) {
      throw new HttpsError("permission-denied", "You can only cancel your own requests.");
    }
    const currentStatus = asRequestStatus(serviceRequest.get("status"));
    if (currentStatus !== "sent" && currentStatus !== "accepted") {
      throw new HttpsError("failed-precondition", "This request can no longer be cancelled.");
    }
    const mechanicRef = db.doc(`mechanics/${String(serviceRequest.get("mechanic_id"))}`);
    const mechanic = await transaction.get(mechanicRef);
    if (!mechanic.exists) throw new HttpsError("failed-precondition", "The assigned mechanic no longer exists.");

    const updatedRequest = { ...serviceRequest.data(), status: "cancelled" };
    transaction.update(requestRef, { status: "cancelled", updated_at: new Date().toISOString() });
    await appendLedgerEvent(
      transaction,
      head,
      "REQUEST_CANCELLED",
      "service_request",
      String(serviceRequest.get("ref")),
      recordMetadata("REQUEST_CANCELLED", String(serviceRequest.get("ref")), { status: "cancelled" }),
      requestRecord(updatedRequest, String(mechanic.get("code"))),
    );
  });
});

export const updateServiceRequestStatus = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const id = textField(data, "id", 128);
  const nextStatus = asRequestStatus(data.status);
  const requestRef = db.doc(`service_requests/${id}`);

  await db.runTransaction(async (transaction) => {
    const serviceRequest = await transaction.get(requestRef);
    if (!serviceRequest.exists) throw new HttpsError("not-found", "Request not found.");
    const mechanicId = String(serviceRequest.get("mechanic_id"));
    const mechanicRef = db.doc(`mechanics/${mechanicId}`);
    const mechanicOwnerRef = db.doc(`mechanic_owners/${mechanicId}`);
    const userRef = db.doc(`users/${uid}`);
    const [mechanic, mechanicOwner, profile, head] = await Promise.all([
      transaction.get(mechanicRef),
      transaction.get(mechanicOwnerRef),
      transaction.get(userRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (
      !mechanic.exists ||
      !mechanicOwner.exists ||
      mechanicOwner.get("user_id") !== uid ||
      !roleList(profile.data()).includes("mechanic")
    ) {
      throw new HttpsError("permission-denied", "Only the assigned mechanic can update this request.");
    }

    const currentStatus = asRequestStatus(serviceRequest.get("status"));
    const allowed: Partial<Record<RequestStatus, RequestStatus[]>> = {
      sent: ["accepted", "declined"],
      accepted: ["in_progress"],
      in_progress: ["completed"],
    };
    if (!allowed[currentStatus]?.includes(nextStatus)) {
      throw new HttpsError("failed-precondition", `Cannot move a request from ${currentStatus} to ${nextStatus}.`);
    }

    const updatedRequest = { ...serviceRequest.data(), status: nextStatus };
    const updates: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    transaction.update(requestRef, updates);
    if (nextStatus === "completed") {
      transaction.update(mechanicRef, { jobs_completed: FieldValue.increment(1) });
    }
    const eventType = `REQUEST_${nextStatus.toUpperCase()}`;
    await appendLedgerEvent(
      transaction,
      head,
      eventType,
      "service_request",
      String(serviceRequest.get("ref")),
      recordMetadata(eventType, String(serviceRequest.get("ref")), { status: nextStatus }),
      requestRecord(updatedRequest, String(mechanic.get("code"))),
    );
  });
});

export const submitReview = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const requestId = textField(data, "request_id", 128);
  const mechanicId = textField(data, "mechanic_id", 128);
  const rating = Number(data.rating);
  const comment = optionalText(data.comment, 400) ?? "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpsError("invalid-argument", "rating must be an integer from 1 to 5.");
  }

  const requestRef = db.doc(`service_requests/${requestId}`);
  const mechanicRef = db.doc(`mechanics/${mechanicId}`);
  const reviewRef = db.doc(`reviews/${requestId}`);
  const reviewsQuery = db.collection("reviews").where("mechanic_id", "==", mechanicId);

  await db.runTransaction(async (transaction) => {
    const [serviceRequest, mechanic, existingReview, existingReviews, head] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(mechanicRef),
      transaction.get(reviewRef),
      transaction.get(reviewsQuery),
      transaction.get(ledgerHeadRef()),
    ]);
    if (
      !serviceRequest.exists ||
      serviceRequest.get("customer_id") !== uid ||
      serviceRequest.get("mechanic_id") !== mechanicId
    ) {
      throw new HttpsError("permission-denied", "You can only review your own completed request.");
    }
    if (serviceRequest.get("status") !== "completed") {
      throw new HttpsError("failed-precondition", "Only completed jobs can be reviewed.");
    }
    if (!mechanic.exists) throw new HttpsError("not-found", "The assigned mechanic no longer exists.");
    if (existingReview.exists) throw new HttpsError("already-exists", "This request already has a review.");

    const createdAt = new Date().toISOString();
    const review = {
      id: requestId,
      mechanic_id: mechanicId,
      rating,
      comment,
      created_at: createdAt,
    };
    const previousRatings = existingReviews.docs.reduce(
      (total, reviewSnapshot) => total + Number(reviewSnapshot.get("rating") || 0),
      0,
    );
    const newRating = Number(
      ((previousRatings + rating) / (existingReviews.size + 1)).toFixed(2),
    );
    transaction.create(reviewRef, review);
    transaction.update(mechanicRef, { rating: newRating });
    const ref = String(serviceRequest.get("ref"));
    const eventType = "REVIEW_SUBMITTED";
    await appendLedgerEvent(
      transaction,
      head,
      eventType,
      "review",
      ref,
      recordMetadata(eventType, ref, { rating }),
    );
  });
  return { id: requestId };
});

export const verifyMechanic = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const id = textField(data, "id", 128);
  const mechanicRef = db.doc(`mechanics/${id}`);

  await db.runTransaction(async (transaction) => {
    const [profile, mechanic, head] = await Promise.all([
      transaction.get(db.doc(`users/${uid}`)),
      transaction.get(mechanicRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (!roleList(profile.data()).includes("admin")) {
      throw new HttpsError("permission-denied", "Administrator access is required.");
    }
    if (!mechanic.exists) throw new HttpsError("not-found", "Mechanic not found.");
    if (mechanic.get("verified") === true) return;

    const verifiedMechanic = { ...mechanic.data(), verified: true };
    transaction.update(mechanicRef, { verified: true });
    await appendLedgerEvent(
      transaction,
      head,
      "MECHANIC_VERIFIED",
      "mechanic",
      String(mechanic.get("code")),
      recordMetadata("MECHANIC_VERIFIED", String(mechanic.get("code")), { verified: true }),
      mechanicRecord(verifiedMechanic),
    );

    const auditRef = db.collection("security_audit").doc();
    transaction.create(auditRef, {
      actor_uid: uid,
      action: "verifyMechanic",
      target_uid: id,
      role_changed: null,
      result: "Allowed",
      reason: "Mechanic verified by admin",
      timestamp: Math.floor(Date.now() / 1000),
      record_ref: String(mechanic.get("code")),
      before_status: "unverified",
      after_status: "verified",
    });
  });
});

export const verifyLedgerRecord = onCall(async (request) => {
  const uid = request.auth?.uid;
  const data = inputObject(request.data);
  const recordRef = textField(data, "recordRef", 128);
  const recordType = data.recordType;
  if (recordType !== "mechanic" && recordType !== "service_request") {
    throw new HttpsError("invalid-argument", "recordType is invalid.");
  }

  const profile = uid ? await db.doc(`users/${uid}`).get() : null;
  const roles = roleList(profile?.data());
  const isAdmin = roles.includes("admin");
  let record: DocumentData;
  let ledgerType: string;
  let mechanicCode: string | null = null;

  if (recordType === "mechanic") {
    const result = await db.collection("mechanics").where("code", "==", recordRef).limit(1).get();
    const mechanic = result.docs[0];
    if (!mechanic) throw new HttpsError("not-found", "Mechanic record not found.");
    const owner = uid ? await db.doc(`mechanic_owners/${mechanic.id}`).get() : null;
    const isOwner = uid !== undefined && owner?.get("user_id") === uid;
    if (mechanic.get("verified") !== true && !isOwner && !isAdmin) {
      throw new HttpsError("permission-denied", "This mechanic proof is not public.");
    }
    record = mechanic.data();
    ledgerType = "mechanic";
  } else {
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to verify this request.");
    const result = await db.collection("service_requests").where("ref", "==", recordRef).limit(1).get();
    const serviceRequest = result.docs[0];
    if (!serviceRequest) throw new HttpsError("not-found", "Service request not found.");
    const mechanicId = String(serviceRequest.get("mechanic_id"));
    const mechanic = await db.doc(`mechanics/${mechanicId}`).get();
    const owner = await db.doc(`mechanic_owners/${mechanicId}`).get();
    const isCustomer = serviceRequest.get("customer_id") === uid;
    const isMechanic = owner.exists && owner.get("user_id") === uid;
    if (!isCustomer && !isMechanic && !isAdmin) {
      throw new HttpsError("permission-denied", "You cannot verify this request.");
    }
    if (!mechanic.exists) throw new HttpsError("failed-precondition", "The assigned mechanic no longer exists.");
    record = serviceRequest.data();
    mechanicCode = String(mechanic.get("code"));
    ledgerType = "service_request";
  }

  const latest = await db
    .collection("ledger_blocks")
    .where("record_ref", "==", recordRef)
    .where("record_type", "==", ledgerType)
    .orderBy("block_index", "desc")
    .limit(1)
    .get();
  const block = latest.docs[0];
  if (!block || typeof block.get("record_hash") !== "string") return { ok: false };
  const blockIndex: unknown = block.get("block_index");
  if (typeof blockIndex !== "number") return { ok: false };

  const snapshot = recordType === "mechanic"
    ? mechanicRecord(record)
    : requestRecord(record, mechanicCode ?? "");
  const ok = await verifyRecordFingerprint(blockIndex, snapshot);
  return { ok };
});

function requireSecurityAdmin(uid: string) {
  const profile = db.doc(`users/${uid}`);
  return profile.get().then((snapshot) => {
    if (!snapshot.exists || !roleList(snapshot.data()).includes("security_admin")) {
      throw new HttpsError("permission-denied", "Security administrator access is required.");
    }
  });
}

async function writeAuditLog(
  actorUid: string,
  action: string,
  targetUid: string | null,
  roleChanged: string | null,
  result: "Allowed" | "Denied",
  reason: string,
  extra: Record<string, unknown> = {},
) {
  const auditRef = db.collection("security_audit").doc();
  await auditRef.create({
    actor_uid: actorUid,
    action,
    target_uid: targetUid,
    role_changed: roleChanged,
    result,
    reason,
    timestamp: Math.floor(Date.now() / 1000),
    ...extra,
  });
}

function writeAuditLogInTransaction(
  transaction: Transaction,
  actorUid: string,
  action: string,
  targetUid: string | null,
  roleChanged: string | null,
  result: "Allowed" | "Denied",
  reason: string,
  extra: Record<string, unknown> = {},
) {
  const auditRef = db.collection("security_audit").doc();
  transaction.create(auditRef, {
    actor_uid: actorUid,
    action,
    target_uid: targetUid,
    role_changed: roleChanged,
    result,
    reason,
    timestamp: Math.floor(Date.now() / 1000),
    ...extra,
  });
}

export const listUserRoles = onCall(async (request) => {
  const uid = requireUid(request);
  await requireSecurityAdmin(uid);

  const usersSnapshot = await db.collection("users").select("roles", "full_name").get();
  const users = usersSnapshot.docs.map((doc) => ({
    uid: doc.id,
    full_name: doc.get("full_name") || "",
    roles: roleList(doc.data()),
  }));
  return { users };
});

// audit-fix:v1 - denials are written to security_audit OUTSIDE the transaction (a thrown error
// rolls a transaction back, which used to discard the audit entry). Role changes are also no longer
// appended to the public ledger, because that exposed user IDs and privilege changes.
type RoleDenial = { code: FunctionsErrorCode; message: string; reason: string };

export const setUserRole = onCall(async (request) => {
  const uid = requireUid(request);
  await requireSecurityAdmin(uid);

  const data = inputObject(request.data);
  const targetUid = textField(data, "targetUid", 128);
  const role = textField(data, "role", 50);
  const action = data.action;

  const deny = async (denial: RoleDenial): Promise<never> => {
    await writeAuditLog(uid, "setUserRole", targetUid, role, "Denied", denial.reason);
    throw new HttpsError(denial.code, denial.message);
  };

  if (action !== "grant" && action !== "revoke") {
    return deny({ code: "invalid-argument", message: "action must be 'grant' or 'revoke'.", reason: "Invalid action" });
  }
  if (role !== "admin" && role !== "mechanic") {
    return deny({
      code: "invalid-argument",
      message: "Only 'admin' and 'mechanic' roles can be managed.",
      reason: "Invalid role for this function",
    });
  }
  if (targetUid === uid) {
    return deny({ code: "permission-denied", message: "You cannot change your own roles.", reason: "Cannot change own roles" });
  }

  const targetRef = db.doc("users/" + targetUid);
  const denial = await db.runTransaction(async (transaction): Promise<RoleDenial | null> => {
    const [targetProfile, allAdmins] = await Promise.all([
      transaction.get(targetRef),
      transaction.get(db.collection("users").where("roles", "array-contains", "admin")),
    ]);

    if (!targetProfile.exists) {
      return { code: "not-found", message: "Target user not found.", reason: "Target user not found" };
    }
    const currentRoles = roleList(targetProfile.data());

    if (action === "grant") {
      if (currentRoles.includes(role)) {
        return { code: "already-exists", message: "User already has this role.", reason: "Role already granted" };
      }
      if (role === "admin" && allAdmins.docs.length === 0) {
        return {
          code: "failed-precondition",
          message: "Cannot grant admin role when no admins exist.",
          reason: "Cannot grant admin when no admins exist",
        };
      }
      transaction.update(targetRef, { roles: FieldValue.arrayUnion(role) });
    } else {
      if (!currentRoles.includes(role)) {
        return { code: "failed-precondition", message: "User does not have this role.", reason: "Role not present" };
      }
      if (role === "admin" && allAdmins.docs.filter((adminDoc) => adminDoc.id !== targetUid).length === 0) {
        return {
          code: "failed-precondition",
          message: "Cannot revoke the last admin role.",
          reason: "Cannot revoke last admin",
        };
      }
      transaction.update(targetRef, { roles: FieldValue.arrayRemove(role) });
    }

    writeAuditLogInTransaction(
      transaction,
      uid,
      "setUserRole_" + action,
      targetUid,
      role,
      "Allowed",
      "Role changed successfully",
    );
    return null;
  });

  if (denial) return deny(denial);
  return { success: true };
});

export const getSecurityPolicy = onCall(async (request) => {
  const uid = requireUid(request);
  await requireSecurityAdmin(uid);

  const policy = {
    actors: ["Visitor", "Customer", "Mechanic", "Admin", "Security Admin", "System"],
    modules: [
      { name: "User profiles", id: "users" },
      { name: "Mechanic profiles", id: "mechanics" },
      { name: "Mechanic ownership", id: "mechanic_owners" },
      { name: "Service requests", id: "service_requests" },
      { name: "Reviews", id: "reviews" },
      { name: "Ledger blocks", id: "ledger_blocks" },
      { name: "Ledger secrets", id: "ledger_secrets" },
      { name: "Ledger state", id: "ledger_state" },
      { name: "Security audit log", id: "security_audit" },
    ],
    permissions: [
      { actor: "Visitor", module: "users", read: "None", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "mechanics", read: "Own (verified)", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "mechanic_owners", read: "None", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "service_requests", read: "None", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "reviews", read: "Full", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "ledger_blocks", read: "Full", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "ledger_secrets", read: "None", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "ledger_state", read: "None", write: "None", status: "Enforced" },
      { actor: "Visitor", module: "security_audit", read: "None", write: "None", status: "Enforced" },

      { actor: "Customer", module: "users", read: "Own", write: "None", status: "Enforced" },
      { actor: "Customer", module: "mechanics", read: "Own (verified)", write: "None", status: "Enforced" },
      { actor: "Customer", module: "mechanic_owners", read: "Own", write: "None", status: "Enforced" },
      { actor: "Customer", module: "service_requests", read: "Own", write: "Own (fn)", status: "Enforced" },
      { actor: "Customer", module: "reviews", read: "Full", write: "None", status: "Enforced" },
      { actor: "Customer", module: "ledger_blocks", read: "Full", write: "None", status: "Enforced" },
      { actor: "Customer", module: "ledger_secrets", read: "None", write: "None", status: "Enforced" },
      { actor: "Customer", module: "ledger_state", read: "None", write: "None", status: "Enforced" },
      { actor: "Customer", module: "security_audit", read: "None", write: "None", status: "Enforced" },

      { actor: "Mechanic", module: "users", read: "Own", write: "None", status: "Enforced" },
      { actor: "Mechanic", module: "mechanics", read: "Own", write: "None", status: "Enforced" },
      { actor: "Mechanic", module: "mechanic_owners", read: "Own", write: "None", status: "Enforced" },
      { actor: "Mechanic", module: "service_requests", read: "Assigned", write: "Assigned (fn)", status: "Enforced" },
      { actor: "Mechanic", module: "reviews", read: "Full", write: "None", status: "Enforced" },
      { actor: "Mechanic", module: "ledger_blocks", read: "Full", write: "None", status: "Enforced" },
      { actor: "Mechanic", module: "ledger_secrets", read: "None", write: "None", status: "Enforced" },
      { actor: "Mechanic", module: "ledger_state", read: "None", write: "None", status: "Enforced" },
      { actor: "Mechanic", module: "security_audit", read: "None", write: "None", status: "Enforced" },

      { actor: "Admin", module: "users", read: "Full", write: "None", status: "Enforced" },
      { actor: "Admin", module: "mechanics", read: "Full", write: "None", status: "Enforced" },
      { actor: "Admin", module: "mechanic_owners", read: "Full", write: "None", status: "Enforced" },
      { actor: "Admin", module: "service_requests", read: "Full", write: "None", status: "Enforced" },
      { actor: "Admin", module: "reviews", read: "Full", write: "None", status: "Enforced" },
      { actor: "Admin", module: "ledger_blocks", read: "Full", write: "None", status: "Enforced" },
      { actor: "Admin", module: "ledger_secrets", read: "None", write: "None", status: "Enforced" },
      { actor: "Admin", module: "ledger_state", read: "None", write: "None", status: "Enforced" },
      { actor: "Admin", module: "security_audit", read: "None", write: "None", status: "Enforced" },

      { actor: "Security Admin", module: "users", read: "Full", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "mechanics", read: "None", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "mechanic_owners", read: "None", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "service_requests", read: "None", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "reviews", read: "Full", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "ledger_blocks", read: "Full", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "ledger_secrets", read: "None", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "ledger_state", read: "None", write: "None", status: "Enforced" },
      { actor: "Security Admin", module: "security_audit", read: "Full", write: "None", status: "Enforced" },

      { actor: "System", module: "users", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "mechanics", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "mechanic_owners", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "service_requests", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "reviews", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "ledger_blocks", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "ledger_secrets", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "ledger_state", read: "Full", write: "Full", status: "Enforced" },
      { actor: "System", module: "security_audit", read: "Full", write: "Full", status: "Enforced" },
    ],
  };

  return policy;
});

// audit-fix:v1 - filters are validated, pagination uses a document cursor (no skipped rows on equal
// timestamps), and the composite indexes it needs are in firestore.indexes.json.
function optionalFilter(value: unknown, name: string, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpsError("invalid-argument", name + " must be a string of at most " + maxLength + " characters.");
  }
  return value;
}

export const listAuditLog = onCall(async (request) => {
  const uid = requireUid(request);
  await requireSecurityAdmin(uid);

  const data = inputObject(request.data);
  const limit = data.limit === undefined || data.limit === null ? 50 : Number(data.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpsError("invalid-argument", "limit must be a whole number between 1 and 100.");
  }
  const filterActor = optionalFilter(data.filterActor, "filterActor", 128);
  const filterAction = optionalFilter(data.filterAction, "filterAction", 100);
  const filterResult = optionalFilter(data.filterResult, "filterResult", 20);
  if (filterResult !== null && filterResult !== "Allowed" && filterResult !== "Denied") {
    throw new HttpsError("invalid-argument", "filterResult must be 'Allowed' or 'Denied'.");
  }
  const startAfterId = optionalFilter(data.startAfterId, "startAfterId", 128);
  const startAfterTimestamp =
    data.startAfter === undefined || data.startAfter === null || data.startAfter === ""
      ? null
      : Number(data.startAfter);
  if (startAfterTimestamp !== null && !Number.isFinite(startAfterTimestamp)) {
    throw new HttpsError("invalid-argument", "startAfter must be a number.");
  }

  let query: Query = db.collection("security_audit");
  if (filterActor) query = query.where("actor_uid", "==", filterActor);
  if (filterAction) query = query.where("action", "==", filterAction);
  if (filterResult) query = query.where("result", "==", filterResult);
  query = query.orderBy("timestamp", "desc");

  if (startAfterId) {
    const cursorDoc = await db.doc("security_audit/" + startAfterId).get();
    if (!cursorDoc.exists) throw new HttpsError("invalid-argument", "startAfterId does not exist.");
    query = query.startAfter(cursorDoc);
  } else if (startAfterTimestamp !== null) {
    query = query.startAfter(startAfterTimestamp);
  }

  const snapshot = await query.limit(limit).get();
  const entries = snapshot.docs.map((doc) => ({
    id: doc.id,
    actor_uid: doc.get("actor_uid"),
    action: doc.get("action"),
    target_uid: doc.get("target_uid"),
    role_changed: doc.get("role_changed"),
    result: doc.get("result"),
    reason: doc.get("reason"),
    timestamp: doc.get("timestamp"),
  }));
  const nextCursor = entries.length === limit ? (entries.at(-1)?.id ?? null) : null;

  return { entries, nextCursor };
});

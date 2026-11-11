import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  FieldPath,
  getFirestore,
  type DocumentReference,
  type DocumentData,
  type Query,
  type Transaction,
} from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  HttpsError,
  onCall,
  type CallableRequest,
  type FunctionsErrorCode,
} from "firebase-functions/v2/https";
import securityPolicy from "./security-policy.json";
import {
  appendLedgerEvent,
  ledgerHeadRef,
  ledgerSaltRefs,
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
type AppRole = "customer" | "admin" | "security_admin";

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
    if (data.consentAccepted !== true) {
      throw new HttpsError("failed-precondition", "Privacy notice consent is required to create an account.");
    }
    const policyVersion = textField(data, "policyVersion", 40);

    const tokenName = request.auth?.token.name;
    const tokenEmail = request.auth?.token.email;
    const createdRoles: AppRole[] = ["customer"];
    transaction.create(userRef, {
      full_name: fullName ?? (typeof tokenName === "string" ? tokenName : ""),
      email: typeof tokenEmail === "string" ? tokenEmail : "",
      roles: createdRoles,
      created_at: new Date().toISOString(),
      consent: {
        accepted: true,
        accepted_at: FieldValue.serverTimestamp(),
        policy_version: policyVersion,
      },
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

export const updateMyVehicles = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  if (!Array.isArray(data.vehicles) || data.vehicles.length > 5) {
    throw new HttpsError("invalid-argument", "Add no more than five vehicles.");
  }
  const vehicles = data.vehicles.map((value) => {
    const vehicle = inputObject(value);
    const make = textField(vehicle, "make", 40);
    const model = textField(vehicle, "model", 40);
    const year =
      vehicle.year === null || vehicle.year === undefined || vehicle.year === ""
        ? null
        : Number(vehicle.year);
    if (year !== null && (!Number.isInteger(year) || year < 1970 || year > new Date().getFullYear() + 1)) {
      throw new HttpsError("invalid-argument", "Vehicle year is outside the supported range.");
    }
    return { make, model, year };
  });
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (transaction) => {
    const profile = await transaction.get(userRef);
    if (!profile.exists) throw new HttpsError("failed-precondition", "Your profile is not ready.");
    transaction.update(userRef, { vehicles });
    writeAuditLogInTransaction(
      transaction,
      uid,
      "updateMyVehicles",
      uid,
      null,
      "Allowed",
      "Customer updated their vehicle list",
    );
  });
  return { ok: true };
});

export const submitMechanicApplication = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const name = textField(data, "name", 80);
  const workshop = textField(data, "workshop", 80);
  const town = textField(data, "town", 80);
  const idReference = textField(data, "id_reference", 100);
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
  const privateRef = db.doc(`mechanic_private/${uid}`);
  const result = await db.runTransaction(async (transaction) => {
    const [profile, existingMechanic, existingOwner, existingPrivate, head] = await Promise.all([
      transaction.get(userRef),
      transaction.get(mechanicRef),
      transaction.get(mechanicOwnerRef),
      transaction.get(privateRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (!profile.exists || !roleList(profile.data()).includes("customer")) {
      throw new HttpsError("failed-precondition", "Your Firebase customer profile is not ready.");
    }
    if (existingMechanic.exists || existingOwner.exists || existingPrivate.exists) {
      throw new HttpsError("already-exists", "This account already has a mechanic application.");
    }

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
      status: "pending",
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
    transaction.create(privateRef, {
      id_reference: idReference,
      submitted_at: mechanic.created_at,
    });
    await appendLedgerEvent(
      transaction,
      head,
      "MECHANIC_APPLIED",
      "mechanic",
      mechanic.code,
      recordMetadata("MECHANIC_APPLIED", mechanic.code, { verified: false }),
      mechanicRecord(mechanic),
    );
    writeAuditLogInTransaction(
      transaction,
      uid,
      "submitMechanicApplication",
      uid,
      null,
      "Allowed",
      "Mechanic application submitted",
      { record_ref: mechanic.code, after_status: "pending" },
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
    if (mechanic.get("verified") !== true) {
      throw new HttpsError("failed-precondition", "Only an admin-verified workshop can change availability.");
    }
    transaction.update(mechanicRef, { available: data.available });
    writeAuditLogInTransaction(
      transaction,
      uid,
      "setMechanicAvailability",
      null,
      null,
      "Allowed",
      "Mechanic availability changed",
      { record_ref: String(mechanic.get("code")), after_status: data.available ? "available" : "unavailable" },
    );
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
  const privateRef = db.doc(`service_request_private/${requestRef.id}`);
  const ref = nextReference();
  const createdAt = new Date().toISOString();
  const newRequest = {
    id: requestRef.id,
    ref,
    customer_id: uid,
    mechanic_id: mechanicId,
    mechanic_code: "",
    mechanic_owner_id: "",
    category,
    status: "sent" as const,
    status_history: [{ status: "sent" as const, actor_uid: uid, changed_at: createdAt }],
    created_at: createdAt,
    updated_at: createdAt,
  };
  const privateRequest = {
    description,
    contact_phone: contactPhone,
    vehicle_make: vehicleMake,
    vehicle_model: vehicleModel,
    vehicle_year: vehicleYear,
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
      mechanic.get("available") !== true ||
      !mechanicOwner.exists ||
      typeof mechanicOwner.get("user_id") !== "string"
    ) {
      throw new HttpsError("not-found", "This mechanic is not available for new requests.");
    }
    newRequest.mechanic_owner_id = String(mechanicOwner.get("user_id"));
    newRequest.mechanic_code = String(mechanic.get("code"));
    transaction.create(requestRef, newRequest);
    transaction.create(privateRef, {
      ...privateRequest,
      customer_id: uid,
      mechanic_owner_id: newRequest.mechanic_owner_id,
      customer_name: String(customer.get("full_name") ?? ""),
    });
    writeAuditLogInTransaction(
      transaction,
      uid,
      "createServiceRequest",
      null,
      null,
      "Allowed",
      "Customer request created",
      { record_ref: ref, after_status: "sent" },
    );
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
      requestRecord({ ...newRequest, ...privateRequest }, String(mechanic.get("code"))),
    );
  });

  return { id: requestRef.id, ref };
});

export const cancelServiceRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const id = textField(data, "id", 128);
  const requestRef = db.doc(`service_requests/${id}`);
  const privateRef = db.doc(`service_request_private/${id}`);

  await db.runTransaction(async (transaction) => {
    const [serviceRequest, privateRequest, head] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(privateRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (!serviceRequest.exists || serviceRequest.get("customer_id") !== uid) {
      throw new HttpsError("permission-denied", "You can only cancel your own requests.");
    }
    const currentStatus = asRequestStatus(serviceRequest.get("status"));
    if (currentStatus !== "sent") {
      throw new HttpsError("failed-precondition", "This request can no longer be cancelled.");
    }
    const mechanicId = String(serviceRequest.get("mechanic_id") ?? "");
    const mechanic = mechanicId
      ? await transaction.get(db.doc(`mechanics/${mechanicId}`))
      : null;
    const history = Array.isArray(serviceRequest.get("status_history"))
      ? serviceRequest.get("status_history")
      : [];

    const changedAt = new Date().toISOString();
    const updatedRequest = {
      ...serviceRequest.data(),
      ...(privateRequest.data() ?? {}),
      status: "cancelled",
    };
    transaction.update(requestRef, {
      status: "cancelled",
      updated_at: changedAt,
      status_history: [
        ...history,
        { status: "cancelled", actor_uid: uid, changed_at: changedAt },
      ],
    });
    writeAuditLogInTransaction(
      transaction,
      uid,
      "cancelServiceRequest",
      null,
      null,
      "Allowed",
      "Customer cancelled a request before mechanic acceptance",
      {
        record_ref: String(serviceRequest.get("ref")),
        before_status: currentStatus,
        after_status: "cancelled",
      },
    );
    await appendLedgerEvent(
      transaction,
      head,
      "REQUEST_CANCELLED",
      "service_request",
      String(serviceRequest.get("ref")),
      recordMetadata("REQUEST_CANCELLED", String(serviceRequest.get("ref")), { status: "cancelled" }),
      requestRecord(
        updatedRequest,
        String(serviceRequest.get("mechanic_code") ?? (mechanic?.exists ? mechanic.get("code") : "")),
      ),
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
    const assignedOwnerId = String(serviceRequest.get("mechanic_owner_id") ?? "");
    const isPoolRequest = serviceRequest.get("status") === "sent" && assignedOwnerId === "";
    if (assignedOwnerId && assignedOwnerId !== uid) {
      throw new HttpsError("permission-denied", "Only the assigned mechanic can update this request.");
    }
    if (isPoolRequest && nextStatus !== "accepted") {
      throw new HttpsError("failed-precondition", "A pooled request must be accepted before it can change.");
    }
    const mechanicId = isPoolRequest ? uid : String(serviceRequest.get("mechanic_id"));
    const mechanicRef = db.doc(`mechanics/${mechanicId}`);
    const mechanicOwnerRef = db.doc(`mechanic_owners/${mechanicId}`);
    const privateRef = db.doc(`service_request_private/${id}`);
    const [mechanic, mechanicOwner, privateRequest, head] = await Promise.all([
      transaction.get(mechanicRef),
      transaction.get(mechanicOwnerRef),
      transaction.get(privateRef),
      transaction.get(ledgerHeadRef()),
    ]);
    if (
      !mechanic.exists ||
      !mechanicOwner.exists ||
      mechanicOwner.get("user_id") !== uid ||
      mechanic.get("verified") !== true
    ) {
      throw new HttpsError("permission-denied", "Only the assigned mechanic can update this request.");
    }
    if (isPoolRequest && mechanic.get("available") !== true) {
      throw new HttpsError("failed-precondition", "Turn availability on before accepting a pooled request.");
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

    const changedAt = new Date().toISOString();
    const previousHistory: unknown = serviceRequest.get("status_history");
    const history = Array.isArray(previousHistory) ? previousHistory : [];
    const historyEntry = {
      status: nextStatus === "declined" ? "declined" : nextStatus,
      actor_uid: uid,
      changed_at: changedAt,
      ...(nextStatus === "declined"
        ? {
            mechanic_id: mechanicId,
            note: "Returned to the available mechanic pool",
          }
        : {}),
    };
    const nextHistory =
      nextStatus === "declined"
        ? [
            ...history,
            historyEntry,
            { status: "sent", actor_uid: uid, changed_at: changedAt, note: "Available to other verified mechanics" },
          ]
        : [...history, historyEntry];
    const returnToPool = nextStatus === "declined";
    const effectiveStatus: RequestStatus = returnToPool ? "sent" : nextStatus;
    const updates: Record<string, unknown> = {
      status: effectiveStatus,
      updated_at: changedAt,
      status_history: nextHistory,
      ...(isPoolRequest && nextStatus === "accepted"
        ? {
            mechanic_id: mechanicId,
            mechanic_code: String(mechanic.get("code")),
            mechanic_owner_id: uid,
          }
        : {}),
      ...(returnToPool ? { mechanic_id: "", mechanic_owner_id: "" } : {}),
    };
    const updatedRequest = {
      ...serviceRequest.data(),
      ...(privateRequest.data() ?? {}),
      ...updates,
      ...(returnToPool ? { mechanic_id: "", mechanic_owner_id: "" } : {}),
    };
    transaction.update(requestRef, updates);
    if (isPoolRequest && nextStatus === "accepted" && privateRequest.exists) {
      transaction.update(privateRef, { mechanic_owner_id: uid });
    }
    if (returnToPool && privateRequest.exists) {
      transaction.update(privateRef, { mechanic_owner_id: "" });
    }
    if (nextStatus === "completed") {
      transaction.update(mechanicRef, { jobs_completed: FieldValue.increment(1) });
    }
    writeAuditLogInTransaction(
      transaction,
      uid,
      "updateServiceRequestStatus",
      null,
      null,
      "Allowed",
      "Service request status changed",
      {
        record_ref: String(serviceRequest.get("ref")),
        before_status: currentStatus,
        after_status: effectiveStatus,
        ...(returnToPool ? { note: "Request returned to the pool after mechanic decline" } : {}),
      },
    );
    const eventType = returnToPool
      ? "REQUEST_DECLINED_AND_RETURNED_TO_POOL"
      : `REQUEST_${nextStatus.toUpperCase()}`;
    await appendLedgerEvent(
      transaction,
      head,
      eventType,
      "service_request",
      String(serviceRequest.get("ref")),
      recordMetadata(eventType, String(serviceRequest.get("ref")), { status: effectiveStatus }),
      requestRecord(updatedRequest, String(mechanic.get("code"))),
    );
  });
});

export const getMechanicInbox = onCall(async (request) => {
  const uid = requireUid(request);
  const [mechanic, owner] = await Promise.all([
    db.doc(`mechanics/${uid}`).get(),
    db.doc(`mechanic_owners/${uid}`).get(),
  ]);
  if (
    !mechanic.exists ||
    !owner.exists ||
    owner.get("user_id") !== uid ||
    mechanic.get("verified") !== true ||
    mechanic.get("status") === "suspended"
  ) {
    throw new HttpsError("permission-denied", "A verified workshop account is required.");
  }

  const assignedQuery = db
    .collection("service_requests")
    .where("mechanic_owner_id", "==", uid)
    .orderBy("created_at", "desc")
    .limit(50);
  const poolQuery = mechanic.get("available") === true
    ? db
        .collection("service_requests")
        .where("mechanic_owner_id", "==", "")
        .where("status", "==", "sent")
        .orderBy("created_at", "desc")
        .limit(50)
        .get()
    : Promise.resolve(null);
  const [assigned, pool] = await Promise.all([assignedQuery.get(), poolQuery]);
  const records = new Map([
    ...assigned.docs.map((snapshot) => [snapshot.id, snapshot] as const),
    ...(pool?.docs ?? []).map((snapshot) => [snapshot.id, snapshot] as const),
  ]);

  return {
    requests: await Promise.all(
      [...records.values()].map(async (snapshot) => {
        const row = snapshot.data();
        const history = Array.isArray(row.status_history) ? row.status_history : [];
        const assignedToThisMechanic = row.mechanic_owner_id === uid;
        const mayReadDetails =
          assignedToThisMechanic &&
          ["accepted", "in_progress", "completed"].includes(String(row.status));
        const response: Record<string, unknown> = {
          id: snapshot.id,
          ref: row.ref,
          category: row.category,
          mechanic_id: row.mechanic_id,
          mechanic_owner_id: row.mechanic_owner_id,
          status: row.status,
          status_history: history.map((event: Record<string, unknown>) => ({
            status: event.status,
            changed_at: event.changed_at,
          })),
          created_at: row.created_at,
          updated_at: row.updated_at,
          returned_to_pool:
            !row.mechanic_owner_id &&
            history.some(
              (event: Record<string, unknown>) => event.status === "declined",
            ),
        };
        if (mayReadDetails) {
          const privateRequest = await db
            .doc(`service_request_private/${snapshot.id}`)
            .get();
          if (privateRequest.exists) {
            const privateData = privateRequest.data() ?? {};
            response.vehicle_make = privateData.vehicle_make ?? "";
            response.vehicle_model = privateData.vehicle_model ?? "";
            response.vehicle_year = privateData.vehicle_year ?? null;
            response.description = privateData.description ?? "";
            response.contact_phone = privateData.contact_phone ?? null;
            response.customer_name = privateData.customer_name ?? null;
          }
        }
        return response;
      }),
    ),
  };
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
    const ref = String(serviceRequest.get("ref"));
    const previousRatings = existingReviews.docs.reduce(
      (total, reviewSnapshot) => total + Number(reviewSnapshot.get("rating") || 0),
      0,
    );
    const newRating = Number(
      ((previousRatings + rating) / (existingReviews.size + 1)).toFixed(2),
    );
    transaction.create(reviewRef, review);
    transaction.update(mechanicRef, { rating: newRating });
    writeAuditLogInTransaction(
      transaction,
      uid,
      "submitReview",
      null,
      null,
      "Allowed",
      "Customer reviewed a completed job",
      { record_ref: ref, after_status: "reviewed" },
    );
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

    const verifiedMechanic = { ...mechanic.data(), verified: true, status: "verified" };
    transaction.update(mechanicRef, { verified: true, status: "verified" });
    await appendLedgerEvent(
      transaction,
      head,
      "MECHANIC_VERIFIED",
      "mechanic",
      String(mechanic.get("code")),
      recordMetadata("MECHANIC_VERIFIED", String(mechanic.get("code")), { verified: true }),
      mechanicRecord(verifiedMechanic),
    );

    writeAuditLogInTransaction(
      transaction,
      uid,
      "verifyMechanic",
      null,
      null,
      "Allowed",
      "Mechanic verified by admin",
      {
        record_ref: String(mechanic.get("code")),
        before_status: "unverified",
        after_status: "verified",
      },
    );
  });
});

export const suspendMechanic = onCall(async (request) => {
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
    if (mechanic.get("verified") !== true) return;

    const suspendedMechanic = {
      ...mechanic.data(),
      verified: false,
      available: false,
      status: "suspended",
    };
    transaction.update(mechanicRef, { verified: false, available: false, status: "suspended" });
    await appendLedgerEvent(
      transaction,
      head,
      "MECHANIC_SUSPENDED",
      "mechanic",
      String(mechanic.get("code")),
      recordMetadata("MECHANIC_SUSPENDED", String(mechanic.get("code")), { verified: false }),
      mechanicRecord(suspendedMechanic),
    );
    writeAuditLogInTransaction(
      transaction,
      uid,
      "suspendMechanic",
      null,
      null,
      "Allowed",
      "Mechanic suspended by admin",
      {
        record_ref: String(mechanic.get("code")),
        before_status: "verified",
        after_status: "suspended",
      },
    );
  });
});

export const reassignServiceRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const data = inputObject(request.data);
  const id = textField(data, "id", 128);
  const mechanicId = textField(data, "mechanic_id", 128);
  const requestRef = db.doc(`service_requests/${id}`);
  const privateRef = db.doc(`service_request_private/${id}`);

  await db.runTransaction(async (transaction) => {
    const [adminProfile, serviceRequest, newMechanic, newOwner, privateRequest, head] =
      await Promise.all([
        transaction.get(db.doc(`users/${uid}`)),
        transaction.get(requestRef),
        transaction.get(db.doc(`mechanics/${mechanicId}`)),
        transaction.get(db.doc(`mechanic_owners/${mechanicId}`)),
        transaction.get(privateRef),
        transaction.get(ledgerHeadRef()),
      ]);
    if (!serviceRequest.exists) throw new HttpsError("not-found", "Request not found.");
    const isAdmin = roleList(adminProfile.data()).includes("admin");
    const isCustomer = serviceRequest.get("customer_id") === uid;
    if (!isAdmin && !isCustomer) {
      throw new HttpsError("permission-denied", "Only the request owner or an administrator can reassign it.");
    }
    if (!newMechanic.exists || newMechanic.get("verified") !== true || newMechanic.get("available") !== true) {
      throw new HttpsError("failed-precondition", "Choose an available, verified mechanic.");
    }
    if (!newOwner.exists || newOwner.get("user_id") !== mechanicId) {
      throw new HttpsError("failed-precondition", "The selected mechanic ownership record is invalid.");
    }
    const currentStatus = asRequestStatus(serviceRequest.get("status"));
    const currentHistory: unknown = serviceRequest.get("status_history");
    const hasBeenDeclined =
      Array.isArray(currentHistory) &&
      currentHistory.some(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          "status" in entry &&
          entry.status === "declined",
      );
    if (isCustomer && (currentStatus !== "sent" || serviceRequest.get("mechanic_owner_id") !== "" || !hasBeenDeclined)) {
      throw new HttpsError("failed-precondition", "You can choose another mechanic only after a decline returns the request to the pool.");
    }
    if (isAdmin && !["sent", "accepted", "in_progress"].includes(currentStatus)) {
      throw new HttpsError("failed-precondition", "Only open or active requests can be reassigned.");
    }
    if (serviceRequest.get("mechanic_owner_id") === mechanicId) {
      throw new HttpsError("invalid-argument", "Choose a different mechanic.");
    }
    const changedAt = new Date().toISOString();
    const priorHistory: unknown = serviceRequest.get("status_history");
    const history = Array.isArray(priorHistory) ? priorHistory : [];
    const nextHistory = [
      ...history,
      {
        status: "sent",
        actor_uid: uid,
        changed_at: changedAt,
        note: isAdmin
          ? "Admin reassigned request; new mechanic must accept"
          : "Customer selected another mechanic; mechanic must accept",
      },
    ];
    const updatedRequest = {
      ...serviceRequest.data(),
      ...(privateRequest.data() ?? {}),
      mechanic_id: mechanicId,
      mechanic_code: String(newMechanic.get("code")),
      mechanic_owner_id: mechanicId,
      status: "sent",
    };
    transaction.update(requestRef, {
      mechanic_id: mechanicId,
      mechanic_code: String(newMechanic.get("code")),
      mechanic_owner_id: mechanicId,
      status: "sent",
      updated_at: changedAt,
      status_history: nextHistory,
    });
    if (privateRequest.exists) transaction.update(privateRef, { mechanic_owner_id: mechanicId });
    writeAuditLogInTransaction(
      transaction,
      uid,
      "reassignServiceRequest",
      null,
      null,
      "Allowed",
      isAdmin ? "Administrator reassigned a service request" : "Customer selected another mechanic after a decline",
      {
        record_ref: String(serviceRequest.get("ref")),
        before_status: currentStatus,
        after_status: "sent",
      },
    );
    const eventType = isAdmin ? "REQUEST_REASSIGNED" : "REQUEST_CUSTOMER_REASSIGNED";
    await appendLedgerEvent(
      transaction,
      head,
      eventType,
      "service_request",
      String(serviceRequest.get("ref")),
      recordMetadata(eventType, String(serviceRequest.get("ref")), {
        status: "sent",
        mechanicCode: String(newMechanic.get("code")),
      }),
      requestRecord(updatedRequest, String(newMechanic.get("code"))),
    );
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
    const mechanicId = String(serviceRequest.get("mechanic_id") ?? "");
    const mechanic = mechanicId ? await db.doc(`mechanics/${mechanicId}`).get() : null;
    const owner = mechanicId ? await db.doc(`mechanic_owners/${mechanicId}`).get() : null;
    const isCustomer = serviceRequest.get("customer_id") === uid;
    const isMechanic = Boolean(owner?.exists && owner.get("user_id") === uid);
    if (!isCustomer && !isMechanic && !isAdmin) {
      throw new HttpsError("permission-denied", "You cannot verify this request.");
    }
    const privateRequest = await db.doc(`service_request_private/${serviceRequest.id}`).get();
    record = { ...serviceRequest.data(), ...(privateRequest.data() ?? {}) };
    mechanicCode = String(serviceRequest.get("mechanic_code") ?? (mechanic?.exists ? mechanic.get("code") : ""));
    if (!mechanicCode) throw new HttpsError("failed-precondition", "The request has no mechanic code to verify.");
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
  if (role !== "admin") {
    return deny({
      code: "invalid-argument",
      message: "Mechanics are verified profiles, not assignable account roles. Only the admin role can be managed here.",
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
  return securityPolicy;
});

export const beforeSignInAudit = beforeUserSignedIn(async (event) => {
  const uid = event.data?.uid;
  if (!uid) throw new Error("Identity Platform sign-in event is missing its user ID.");
  await writeAuditLog(
    uid,
    "signIn",
    null,
    null,
    "Allowed",
    "Identity Platform sign-in event",
  );
});

export const recordSecurityConsoleAccess = onCall(async (request) => {
  const uid = requireUid(request);
  const profile = await db.doc(`users/${uid}`).get();
  const allowed = Boolean(profile.exists && roleList(profile.data()).includes("security_admin"));
  await writeAuditLog(
    uid,
    "securityConsoleAccess",
    null,
    null,
    allowed ? "Allowed" : "Denied",
    allowed ? "Security console opened" : "Unauthorised security console access",
  );
  if (!allowed) {
    throw new HttpsError("permission-denied", "Security administrator access is required.");
  }
  return { ok: true };
});

export const recordDataExport = onCall(async (request) => {
  const uid = requireUid(request);
  await writeAuditLog(uid, "dataExport", null, null, "Allowed", "User requested personal data export");
  return { ok: true };
});

export const deleteUser = onCall(async (request) => {
  const uid = requireUid(request);
  const userRef = db.doc(`users/${uid}`);
  const profile = await userRef.get();
  if (!profile.exists) throw new HttpsError("not-found", "Account profile not found.");
  const roles = roleList(profile.data());
  if (roles.includes("admin")) {
    const admins = await db.collection("users").where("roles", "array-contains", "admin").get();
    if (admins.size <= 1) {
      throw new HttpsError("failed-precondition", "The last administrator account cannot be deleted.");
    }
  }

  const customerRequests = await db.collection("service_requests").where("customer_id", "==", uid).get();
  const assignedRequests = await db.collection("service_requests").where("mechanic_owner_id", "==", uid).get();
  const reviews = await db.collection("reviews").where("mechanic_id", "==", uid).get();
  const requestUpdates = new Map<string, { ref: DocumentReference; data: Record<string, unknown> }>();
  const reviewIds = new Set<string>();
  const customerRequestIds = new Set(customerRequests.docs.map((snapshot) => snapshot.id));

  for (const snapshot of customerRequests.docs) {
    requestUpdates.set(snapshot.ref.path, {
      ref: snapshot.ref,
      data: {
        customer_id: "deleted",
        contact_phone: FieldValue.delete(),
        description: FieldValue.delete(),
        vehicle_make: FieldValue.delete(),
        vehicle_model: FieldValue.delete(),
        vehicle_year: FieldValue.delete(),
        status_history: Array.isArray(snapshot.get("status_history"))
          ? snapshot.get("status_history").map((event: Record<string, unknown>) => ({
              ...event,
              ...(event.actor_uid === uid ? { actor_uid: "deleted" } : {}),
              ...(event.mechanic_id === uid ? { mechanic_id: "deleted" } : {}),
            }))
          : [],
      },
    });
    reviewIds.add(snapshot.id);
  }
  for (const snapshot of assignedRequests.docs) {
    const update = requestUpdates.get(snapshot.ref.path) ?? { ref: snapshot.ref, data: {} };
    update.data.mechanic_id = "deleted";
    update.data.mechanic_code = FieldValue.delete();
    update.data.mechanic_owner_id = "deleted";
    requestUpdates.set(snapshot.ref.path, update);
  }
  for (const snapshot of reviews.docs) reviewIds.add(snapshot.id);

  const mechanicPrivateRecords = await Promise.all(
    assignedRequests.docs
      .filter((snapshot) => !customerRequestIds.has(snapshot.id))
      .map((snapshot) => db.doc(`service_request_private/${snapshot.id}`).get()),
  );
  const mechanicProfile = await db.doc(`mechanics/${uid}`).get();
  const saltRefs = await ledgerSaltRefs([
    ...customerRequests.docs.map((snapshot) => String(snapshot.get("ref") ?? "")),
    String(mechanicProfile.get("code") ?? ""),
  ]);
  const writer = db.bulkWriter();
  for (const saltRef of saltRefs) writer.delete(saltRef);
  for (const update of requestUpdates.values()) writer.update(update.ref, update.data);
  for (const requestId of customerRequestIds) {
    writer.delete(db.doc(`service_request_private/${requestId}`));
  }
  for (const privateRecord of mechanicPrivateRecords) {
    if (privateRecord.exists) {
      writer.update(privateRecord.ref, { mechanic_owner_id: "deleted" });
    }
  }
  for (const reviewId of reviewIds) writer.delete(db.doc(`reviews/${reviewId}`));
  writer.delete(db.doc(`mechanic_owners/${uid}`));
  writer.delete(db.doc(`mechanics/${uid}`));
  writer.delete(db.doc(`mechanic_private/${uid}`));
  writer.delete(userRef);
  await writer.close();
  await getAuth().deleteUser(uid);
  await writeAuditLog("account-erasure", "deleteUser", null, null, "Allowed", "Account erasure completed");
  return { ok: true };
});

export const anonymizeOldRequests = onSchedule("every 24 hours", async () => {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const cursorRef = db.doc("ledger_state/request_retention_cursor");
  const cursor = await cursorRef.get();
  let query = db.collection("service_requests")
    .where("created_at", "<=", cutoff)
    .orderBy("created_at")
    .orderBy(FieldPath.documentId())
    .limit(400);
  if (cursor.exists && typeof cursor.get("created_at") === "string" && typeof cursor.get("document_id") === "string") {
    query = query.startAfter(cursor.get("created_at"), cursor.get("document_id"));
  }
  const oldRequests = await query.get();
  if (oldRequests.empty) {
    if (cursor.exists) await cursorRef.delete();
    return;
  }
  const retentionSaltRefs = await ledgerSaltRefs(
    oldRequests.docs.map((snapshot) => String(snapshot.get("ref") ?? "")),
  );
  const writer = db.bulkWriter();
  for (const saltRef of retentionSaltRefs) writer.delete(saltRef);
  for (const snapshot of oldRequests.docs) {
    if (snapshot.get("retention_anonymized") !== true) {
      const history: unknown = snapshot.get("status_history");
      writer.update(snapshot.ref, {
        customer_id: "anonymized",
        mechanic_id: FieldValue.delete(),
        mechanic_code: FieldValue.delete(),
        mechanic_owner_id: FieldValue.delete(),
        contact_phone: FieldValue.delete(),
        description: FieldValue.delete(),
        vehicle_make: FieldValue.delete(),
        vehicle_model: FieldValue.delete(),
        vehicle_year: FieldValue.delete(),
        status_history: Array.isArray(history)
          ? history.map((event: Record<string, unknown>) => ({
              status: event.status,
              changed_at: event.changed_at,
            }))
          : [],
        retention_anonymized: true,
      });
    }
    writer.delete(db.doc(`service_request_private/${snapshot.id}`));
  }
  await writer.close();
  const last = oldRequests.docs.at(-1);
  if (last) {
    await cursorRef.set({
      created_at: last.get("created_at"),
      document_id: last.id,
    });
  }
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

export const publishAiDataset = onCall({ memory: "512MiB" }, async (request) => {
  const uid = requireUid(request);
  const profile = await db.doc(`users/${uid}`).get();
  if (!roleList(profile.data()).includes("admin")) {
    throw new HttpsError("permission-denied", "Administrator access is required.");
  }
  const data = inputObject(request.data);
  const records = data.records;
  if (!Array.isArray(records) || records.length === 0 || records.length > 2000) {
    throw new HttpsError("invalid-argument", "records must be a non-empty array of at most 2000 rows.");
  }
  const sample = records[0];
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
    throw new HttpsError("invalid-argument", "Each record must be an object.");
  }
  const banned = ["name", "phone", "email", "contact_phone", "full_name"];
  for (const key of Object.keys(sample as object)) {
    if (banned.includes(key.toLowerCase())) {
      throw new HttpsError("invalid-argument", "AI dataset must not include names, phones or emails.");
    }
  }
  const nSynthetic = Number(data.n_synthetic) || 0;
  const nReal = Number(data.n_real) || 0;
  await db.doc("ai_dataset/current").set({
    records,
    n_synthetic: nSynthetic,
    n_real: nReal,
    size: records.length,
    updated_at: new Date().toISOString(),
    updated_by: uid,
  });
  return { ok: true as const, size: records.length };
});

export const publishAiModels = onCall({ memory: "512MiB" }, async (request) => {
  const uid = requireUid(request);
  const profile = await db.doc(`users/${uid}`).get();
  if (!roleList(profile.data()).includes("admin")) {
    throw new HttpsError("permission-denied", "Administrator access is required.");
  }
  const data = inputObject(request.data);
  const bundle = data.bundle;
  if (!bundle || typeof bundle !== "object") {
    throw new HttpsError("invalid-argument", "bundle is required.");
  }
  await db.doc("ai_models/latest").set({
    bundle,
    dataset_size: Number(data.dataset_size) || 0,
    trained_at: typeof data.trained_at === "string" ? data.trained_at : new Date().toISOString(),
    best_model: typeof data.best_model === "string" ? data.best_model : "forest",
    updated_by: uid,
  });
  return { ok: true as const };
});

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
    record_ref: doc.get("record_ref"),
    before_status: doc.get("before_status"),
    after_status: doc.get("after_status"),
  }));
  const nextCursor = entries.length === limit ? (entries.at(-1)?.id ?? null) : null;

  return { entries, nextCursor };
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLedgerRecord = exports.verifyMechanic = exports.submitReview = exports.updateServiceRequestStatus = exports.cancelServiceRequest = exports.createServiceRequest = exports.setMechanicAvailability = exports.submitMechanicApplication = exports.ensureUserProfile = void 0;
const node_crypto_1 = require("node:crypto");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const ledger_js_1 = require("./ledger.js");
(0, app_1.initializeApp)();
(0, v2_1.setGlobalOptions)({ region: "africa-south1", maxInstances: 10 });
const db = (0, firestore_1.getFirestore)();
const requestStatuses = [
    "sent",
    "accepted",
    "declined",
    "in_progress",
    "completed",
    "cancelled",
];
function requireUid(request) {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Sign in to continue.");
    return request.auth.uid;
}
function inputObject(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new https_1.HttpsError("invalid-argument", "The request body must be an object.");
    }
    return data;
}
function textField(data, name, maxLength, minLength = 1) {
    const value = data[name];
    if (typeof value !== "string" || value.trim().length < minLength || value.length > maxLength) {
        throw new https_1.HttpsError("invalid-argument", `${name} must be ${minLength}-${maxLength} characters.`);
    }
    return value.trim();
}
function optionalText(value, maxLength) {
    if (value === null || value === undefined || value === "")
        return null;
    if (typeof value !== "string" || value.length > maxLength) {
        throw new https_1.HttpsError("invalid-argument", `Optional text must be at most ${maxLength} characters.`);
    }
    return value.trim() || null;
}
function roleList(data) {
    const roles = data?.roles;
    if (!Array.isArray(roles))
        return [];
    return roles.filter((role) => role === "customer" ||
        role === "mechanic" ||
        role === "admin" ||
        role === "security_admin");
}
function asRequestStatus(value) {
    if (typeof value !== "string" || !requestStatuses.includes(value)) {
        throw new https_1.HttpsError("invalid-argument", "Request status is invalid.");
    }
    return value;
}
function mechanicCode(uid) {
    return `LS-${uid.slice(-8).toUpperCase()}`;
}
function nextReference() {
    return `LS-${(0, node_crypto_1.randomBytes)(5).toString("hex").toUpperCase()}`;
}
function recordMetadata(event, recordRef, extra = {}) {
    return {
        event,
        recordRef,
        timestamp: Math.floor(Date.now() / 1000),
        ...extra,
    };
}
exports.ensureUserProfile = (0, https_1.onCall)(async (request) => {
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
        const createdRoles = ["customer"];
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
exports.submitMechanicApplication = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request);
    const data = inputObject(request.data);
    const name = textField(data, "name", 80);
    const workshop = textField(data, "workshop", 80);
    const town = textField(data, "town", 80);
    const bio = optionalText(data.bio, 300);
    const experienceYears = Number(data.experience_years);
    const specialties = data.specialties;
    if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 50) {
        throw new https_1.HttpsError("invalid-argument", "experience_years must be between 0 and 50.");
    }
    if (!Array.isArray(specialties) ||
        specialties.length === 0 ||
        specialties.length > 6 ||
        !specialties.every((specialty) => typeof specialty === "string" &&
            ["Engine", "Battery", "Tyre", "Brakes", "Electrical", "Other"].includes(specialty))) {
        throw new https_1.HttpsError("invalid-argument", "Choose at least one valid repair specialty.");
    }
    const userRef = db.doc(`users/${uid}`);
    const mechanicRef = db.doc(`mechanics/${uid}`);
    const mechanicOwnerRef = db.doc(`mechanic_owners/${uid}`);
    const result = await db.runTransaction(async (transaction) => {
        const [profile, existingMechanic, existingOwner, head] = await Promise.all([
            transaction.get(userRef),
            transaction.get(mechanicRef),
            transaction.get(mechanicOwnerRef),
            transaction.get((0, ledger_js_1.ledgerHeadRef)()),
        ]);
        if (!profile.exists)
            throw new https_1.HttpsError("failed-precondition", "Your Firebase profile is not ready.");
        if (existingMechanic.exists || existingOwner.exists) {
            throw new https_1.HttpsError("already-exists", "This account already has a mechanic application.");
        }
        const roles = [...new Set([...roleList(profile.data()), "mechanic"])];
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
        await (0, ledger_js_1.appendLedgerEvent)(transaction, head, "MECHANIC_APPLIED", "mechanic", mechanic.code, recordMetadata("MECHANIC_APPLIED", mechanic.code, { verified: false }), (0, ledger_js_1.mechanicRecord)(mechanic));
        return { id: uid };
    });
    return result;
});
exports.setMechanicAvailability = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request);
    const data = inputObject(request.data);
    if (typeof data.available !== "boolean") {
        throw new https_1.HttpsError("invalid-argument", "available must be true or false.");
    }
    const mechanicRef = db.doc(`mechanics/${uid}`);
    const mechanicOwnerRef = db.doc(`mechanic_owners/${uid}`);
    await db.runTransaction(async (transaction) => {
        const [mechanic, owner] = await Promise.all([
            transaction.get(mechanicRef),
            transaction.get(mechanicOwnerRef),
        ]);
        if (!mechanic.exists || !owner.exists || owner.get("user_id") !== uid) {
            throw new https_1.HttpsError("permission-denied", "Only the workshop owner can change availability.");
        }
        transaction.update(mechanicRef, { available: data.available });
    });
});
exports.createServiceRequest = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request);
    const data = inputObject(request.data);
    const mechanicId = textField(data, "mechanic_id", 128);
    const category = textField(data, "category", 40);
    const vehicleMake = textField(data, "vehicle_make", 40);
    const vehicleModel = textField(data, "vehicle_model", 40);
    const description = textField(data, "description", 500, 5);
    const vehicleYear = data.vehicle_year === null || data.vehicle_year === undefined
        ? null
        : Number(data.vehicle_year);
    const contactPhone = optionalText(data.contact_phone, 20);
    if (!["Engine", "Battery", "Tyre", "Brakes", "Electrical", "Other"].includes(category)) {
        throw new https_1.HttpsError("invalid-argument", "Choose a valid repair category.");
    }
    if (vehicleYear !== null &&
        (!Number.isInteger(vehicleYear) || vehicleYear < 1970 || vehicleYear > new Date().getFullYear() + 1)) {
        throw new https_1.HttpsError("invalid-argument", "vehicle_year is outside the supported range.");
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
        status: "sent",
        created_at: createdAt,
        updated_at: createdAt,
    };
    await db.runTransaction(async (transaction) => {
        const [customer, mechanic, mechanicOwner, head] = await Promise.all([
            transaction.get(customerRef),
            transaction.get(mechanicRef),
            transaction.get(mechanicOwnerRef),
            transaction.get((0, ledger_js_1.ledgerHeadRef)()),
        ]);
        if (!customer.exists || !roleList(customer.data()).includes("customer")) {
            throw new https_1.HttpsError("permission-denied", "A customer account is required to send a request.");
        }
        if (!mechanic.exists ||
            mechanic.get("verified") !== true ||
            !mechanicOwner.exists ||
            typeof mechanicOwner.get("user_id") !== "string") {
            throw new https_1.HttpsError("not-found", "This mechanic is not available for new requests.");
        }
        newRequest.mechanic_owner_id = String(mechanicOwner.get("user_id"));
        transaction.create(requestRef, newRequest);
        await (0, ledger_js_1.appendLedgerEvent)(transaction, head, "REQUEST_SENT", "service_request", ref, recordMetadata("REQUEST_SENT", ref, {
            category,
            mechanicCode: mechanic.get("code"),
            status: "sent",
        }), (0, ledger_js_1.requestRecord)(newRequest, String(mechanic.get("code"))));
    });
    return { id: requestRef.id, ref };
});
exports.cancelServiceRequest = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request);
    const data = inputObject(request.data);
    const id = textField(data, "id", 128);
    const requestRef = db.doc(`service_requests/${id}`);
    await db.runTransaction(async (transaction) => {
        const [serviceRequest, head] = await Promise.all([
            transaction.get(requestRef),
            transaction.get((0, ledger_js_1.ledgerHeadRef)()),
        ]);
        if (!serviceRequest.exists || serviceRequest.get("customer_id") !== uid) {
            throw new https_1.HttpsError("permission-denied", "You can only cancel your own requests.");
        }
        const currentStatus = asRequestStatus(serviceRequest.get("status"));
        if (currentStatus !== "sent" && currentStatus !== "accepted") {
            throw new https_1.HttpsError("failed-precondition", "This request can no longer be cancelled.");
        }
        const mechanicRef = db.doc(`mechanics/${String(serviceRequest.get("mechanic_id"))}`);
        const mechanic = await transaction.get(mechanicRef);
        if (!mechanic.exists)
            throw new https_1.HttpsError("failed-precondition", "The assigned mechanic no longer exists.");
        const updatedRequest = { ...serviceRequest.data(), status: "cancelled" };
        transaction.update(requestRef, { status: "cancelled", updated_at: new Date().toISOString() });
        await (0, ledger_js_1.appendLedgerEvent)(transaction, head, "REQUEST_CANCELLED", "service_request", String(serviceRequest.get("ref")), recordMetadata("REQUEST_CANCELLED", String(serviceRequest.get("ref")), { status: "cancelled" }), (0, ledger_js_1.requestRecord)(updatedRequest, String(mechanic.get("code"))));
    });
});
exports.updateServiceRequestStatus = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request);
    const data = inputObject(request.data);
    const id = textField(data, "id", 128);
    const nextStatus = asRequestStatus(data.status);
    const requestRef = db.doc(`service_requests/${id}`);
    await db.runTransaction(async (transaction) => {
        const serviceRequest = await transaction.get(requestRef);
        if (!serviceRequest.exists)
            throw new https_1.HttpsError("not-found", "Request not found.");
        const mechanicId = String(serviceRequest.get("mechanic_id"));
        const mechanicRef = db.doc(`mechanics/${mechanicId}`);
        const mechanicOwnerRef = db.doc(`mechanic_owners/${mechanicId}`);
        const userRef = db.doc(`users/${uid}`);
        const [mechanic, mechanicOwner, profile, head] = await Promise.all([
            transaction.get(mechanicRef),
            transaction.get(mechanicOwnerRef),
            transaction.get(userRef),
            transaction.get((0, ledger_js_1.ledgerHeadRef)()),
        ]);
        if (!mechanic.exists ||
            !mechanicOwner.exists ||
            mechanicOwner.get("user_id") !== uid ||
            !roleList(profile.data()).includes("mechanic")) {
            throw new https_1.HttpsError("permission-denied", "Only the assigned mechanic can update this request.");
        }
        const currentStatus = asRequestStatus(serviceRequest.get("status"));
        const allowed = {
            sent: ["accepted", "declined"],
            accepted: ["in_progress"],
            in_progress: ["completed"],
        };
        if (!allowed[currentStatus]?.includes(nextStatus)) {
            throw new https_1.HttpsError("failed-precondition", `Cannot move a request from ${currentStatus} to ${nextStatus}.`);
        }
        const updatedRequest = { ...serviceRequest.data(), status: nextStatus };
        const updates = {
            status: nextStatus,
            updated_at: new Date().toISOString(),
        };
        transaction.update(requestRef, updates);
        if (nextStatus === "completed") {
            transaction.update(mechanicRef, { jobs_completed: firestore_1.FieldValue.increment(1) });
        }
        const eventType = `REQUEST_${nextStatus.toUpperCase()}`;
        await (0, ledger_js_1.appendLedgerEvent)(transaction, head, eventType, "service_request", String(serviceRequest.get("ref")), recordMetadata(eventType, String(serviceRequest.get("ref")), { status: nextStatus }), (0, ledger_js_1.requestRecord)(updatedRequest, String(mechanic.get("code"))));
    });
});
exports.submitReview = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request);
    const data = inputObject(request.data);
    const requestId = textField(data, "request_id", 128);
    const mechanicId = textField(data, "mechanic_id", 128);
    const rating = Number(data.rating);
    const comment = optionalText(data.comment, 400) ?? "";
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new https_1.HttpsError("invalid-argument", "rating must be an integer from 1 to 5.");
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
            transaction.get((0, ledger_js_1.ledgerHeadRef)()),
        ]);
        if (!serviceRequest.exists ||
            serviceRequest.get("customer_id") !== uid ||
            serviceRequest.get("mechanic_id") !== mechanicId) {
            throw new https_1.HttpsError("permission-denied", "You can only review your own completed request.");
        }
        if (serviceRequest.get("status") !== "completed") {
            throw new https_1.HttpsError("failed-precondition", "Only completed jobs can be reviewed.");
        }
        if (!mechanic.exists)
            throw new https_1.HttpsError("not-found", "The assigned mechanic no longer exists.");
        if (existingReview.exists)
            throw new https_1.HttpsError("already-exists", "This request already has a review.");
        const createdAt = new Date().toISOString();
        const review = {
            id: requestId,
            mechanic_id: mechanicId,
            rating,
            comment,
            created_at: createdAt,
        };
        const previousRatings = existingReviews.docs.reduce((total, reviewSnapshot) => total + Number(reviewSnapshot.get("rating") || 0), 0);
        const newRating = Number(((previousRatings + rating) / (existingReviews.size + 1)).toFixed(2));
        transaction.create(reviewRef, review);
        transaction.update(mechanicRef, { rating: newRating });
        const ref = String(serviceRequest.get("ref"));
        const eventType = "REVIEW_SUBMITTED";
        await (0, ledger_js_1.appendLedgerEvent)(transaction, head, eventType, "review", ref, recordMetadata(eventType, ref, { rating }));
    });
    return { id: requestId };
});
exports.verifyMechanic = (0, https_1.onCall)(async (request) => {
    const uid = requireUid(request);
    const data = inputObject(request.data);
    const id = textField(data, "id", 128);
    const mechanicRef = db.doc(`mechanics/${id}`);
    await db.runTransaction(async (transaction) => {
        const [profile, mechanic, head] = await Promise.all([
            transaction.get(db.doc(`users/${uid}`)),
            transaction.get(mechanicRef),
            transaction.get((0, ledger_js_1.ledgerHeadRef)()),
        ]);
        if (!roleList(profile.data()).includes("admin")) {
            throw new https_1.HttpsError("permission-denied", "Administrator access is required.");
        }
        if (!mechanic.exists)
            throw new https_1.HttpsError("not-found", "Mechanic not found.");
        if (mechanic.get("verified") === true)
            return;
        const verifiedMechanic = { ...mechanic.data(), verified: true };
        transaction.update(mechanicRef, { verified: true });
        await (0, ledger_js_1.appendLedgerEvent)(transaction, head, "MECHANIC_VERIFIED", "mechanic", String(mechanic.get("code")), recordMetadata("MECHANIC_VERIFIED", String(mechanic.get("code")), { verified: true }), (0, ledger_js_1.mechanicRecord)(verifiedMechanic));
    });
});
exports.verifyLedgerRecord = (0, https_1.onCall)(async (request) => {
    const uid = request.auth?.uid;
    const data = inputObject(request.data);
    const recordRef = textField(data, "recordRef", 128);
    const recordType = data.recordType;
    if (recordType !== "mechanic" && recordType !== "service_request") {
        throw new https_1.HttpsError("invalid-argument", "recordType is invalid.");
    }
    const profile = uid ? await db.doc(`users/${uid}`).get() : null;
    const roles = roleList(profile?.data());
    const isAdmin = roles.includes("admin");
    let record;
    let ledgerType;
    let mechanicCode = null;
    if (recordType === "mechanic") {
        const result = await db.collection("mechanics").where("code", "==", recordRef).limit(1).get();
        const mechanic = result.docs[0];
        if (!mechanic)
            throw new https_1.HttpsError("not-found", "Mechanic record not found.");
        const owner = uid ? await db.doc(`mechanic_owners/${mechanic.id}`).get() : null;
        const isOwner = uid !== undefined && owner?.get("user_id") === uid;
        if (mechanic.get("verified") !== true && !isOwner && !isAdmin) {
            throw new https_1.HttpsError("permission-denied", "This mechanic proof is not public.");
        }
        record = mechanic.data();
        ledgerType = "mechanic";
    }
    else {
        if (!uid)
            throw new https_1.HttpsError("unauthenticated", "Sign in to verify this request.");
        const result = await db.collection("service_requests").where("ref", "==", recordRef).limit(1).get();
        const serviceRequest = result.docs[0];
        if (!serviceRequest)
            throw new https_1.HttpsError("not-found", "Service request not found.");
        const mechanicId = String(serviceRequest.get("mechanic_id"));
        const mechanic = await db.doc(`mechanics/${mechanicId}`).get();
        const owner = await db.doc(`mechanic_owners/${mechanicId}`).get();
        const isCustomer = serviceRequest.get("customer_id") === uid;
        const isMechanic = owner.exists && owner.get("user_id") === uid;
        if (!isCustomer && !isMechanic && !isAdmin) {
            throw new https_1.HttpsError("permission-denied", "You cannot verify this request.");
        }
        if (!mechanic.exists)
            throw new https_1.HttpsError("failed-precondition", "The assigned mechanic no longer exists.");
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
    if (!block || typeof block.get("record_hash") !== "string")
        return { ok: false };
    const blockIndex = block.get("block_index");
    if (typeof blockIndex !== "number")
        return { ok: false };
    const snapshot = recordType === "mechanic"
        ? (0, ledger_js_1.mechanicRecord)(record)
        : (0, ledger_js_1.requestRecord)(record, mechanicCode ?? "");
    const ok = await (0, ledger_js_1.verifyRecordFingerprint)(blockIndex, snapshot);
    return { ok };
});

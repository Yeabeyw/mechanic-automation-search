"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerHeadRef = ledgerHeadRef;
exports.mechanicRecord = mechanicRecord;
exports.requestRecord = requestRecord;
exports.appendLedgerEvent = appendLedgerEvent;
exports.verifyRecordFingerprint = verifyRecordFingerprint;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const GENESIS_PREV = "0".repeat(64);
function ledgerHeadRef() {
    return (0, firestore_1.getFirestore)().doc("ledger_state/head");
}
function sha256Hex(value) {
    return (0, node_crypto_1.createHash)("sha256").update(value, "utf8").digest("hex");
}
function fingerprintField(value) {
    if (value === null)
        return "~";
    return Buffer.from(value, "utf8").toString("hex");
}
function canonicalMechanic(record) {
    const specialties = record.specialties.map(fingerprintField).join(",");
    return [
        "autohelp:v1",
        "mechanic",
        fingerprintField(record.code),
        fingerprintField(record.name),
        fingerprintField(record.workshop),
        fingerprintField(record.town),
        specialties,
        fingerprintField(String(record.experience_years)),
        fingerprintField(String(record.verified)),
    ].join("|");
}
function canonicalRequest(record) {
    return [
        "autohelp:v1",
        "service_request",
        fingerprintField(record.ref),
        fingerprintField(record.category),
        fingerprintField(record.mechanic_code),
        fingerprintField(record.status),
        fingerprintField(record.vehicle_make),
        fingerprintField(record.vehicle_model),
        fingerprintField(record.vehicle_year === null ? null : String(record.vehicle_year)),
        fingerprintField(record.description),
        fingerprintField(record.contact_phone),
    ].join("|");
}
function mechanicRecord(data) {
    return {
        code: data.code,
        name: data.name,
        workshop: data.workshop,
        town: data.town,
        specialties: data.specialties,
        experience_years: data.experience_years,
        verified: data.verified,
    };
}
function requestRecord(data, mechanicCode) {
    return {
        ref: data.ref,
        category: data.category,
        mechanic_code: mechanicCode,
        status: data.status,
        vehicle_make: data.vehicle_make,
        vehicle_model: data.vehicle_model,
        vehicle_year: data.vehicle_year ?? null,
        description: data.description,
        contact_phone: data.contact_phone ?? null,
    };
}
async function appendLedgerEvent(transaction, head, eventType, recordType, recordRef, metadata, record) {
    const db = (0, firestore_1.getFirestore)();
    const blockIndex = head.exists ? Number(head.get("block_index")) + 1 : 0;
    const prevHash = head.exists ? String(head.get("block_hash")) : GENESIS_PREV;
    const ts = Math.floor(Date.now() / 1000);
    const salt = record ? (0, node_crypto_1.randomBytes)(32).toString("hex") : null;
    const recordHash = record && salt
        ? sha256Hex(`${salt}|${"code" in record ? canonicalMechanic(record) : canonicalRequest(record)}`)
        : null;
    const payload = JSON.stringify({
        ...metadata,
        ...(recordHash ? { recordHash } : {}),
    });
    const dataHash = sha256Hex(payload);
    const blockHash = sha256Hex(`${blockIndex}|${prevHash}|${dataHash}|${ts}`);
    const blockId = String(blockIndex).padStart(12, "0");
    transaction.create(db.doc(`ledger_blocks/${blockId}`), {
        block_index: blockIndex,
        ts,
        event_type: eventType,
        record_type: recordType,
        record_ref: recordRef,
        payload,
        data_hash: dataHash,
        record_hash: recordHash,
        prev_hash: prevHash,
        block_hash: blockHash,
        network: "Firebase Firestore (simulated hash-chain)",
        created_at: new Date(ts * 1000).toISOString(),
        tx_hash: null,
        block_number: null,
        contract_address: null,
    });
    if (salt) {
        transaction.create(db.doc(`ledger_secrets/${blockId}`), {
            block_index: blockIndex,
            salt,
        });
    }
    transaction.set(ledgerHeadRef(), { block_index: blockIndex, block_hash: blockHash });
}
async function verifyRecordFingerprint(blockIndex, record) {
    const db = (0, firestore_1.getFirestore)();
    const blockId = String(blockIndex).padStart(12, "0");
    const secret = await db.doc(`ledger_secrets/${blockId}`).get();
    const block = await db.doc(`ledger_blocks/${blockId}`).get();
    if (!secret.exists || !block.exists)
        return false;
    const salt = secret.get("salt");
    const expected = block.get("record_hash");
    const payload = JSON.parse(String(block.get("payload")));
    if (typeof salt !== "string" || typeof expected !== "string" || payload.recordHash !== expected) {
        return false;
    }
    const canonical = "code" in record ? canonicalMechanic(record) : canonicalRequest(record);
    return sha256Hex(`${salt}|${canonical}`) === expected;
}

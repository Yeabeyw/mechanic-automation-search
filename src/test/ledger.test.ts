import { describe, expect, it } from "vitest";
import {
  fingerprintRecord,
  verifyBlock,
  verifyChain,
  verifyRecordSnapshot,
  type LedgerBlock,
  type RecordSnapshot,
} from "@/lib/ledger";

// Real blocks written by public.ledger_append in the database.
const genesis: LedgerBlock = {
  block_index: 0,
  ts: 1793956312,
  event_type: "GENESIS",
  record_type: "system",
  record_ref: "AUTOHELP-LS",
  payload: '{"note": "AutoHelp Lesotho ledger genesis", "event": "GENESIS", "recordRef": "AUTOHELP-LS", "timestamp": 1793956312, "recordType": "system"}',
  data_hash: "33cf9600aa342737b1f9520975fcfbab0b130f0fdafa594789f755131994375c",
  record_hash: null,
  prev_hash: "0".repeat(64),
  block_hash: "fd3e57080e998d84299634699869a7f61e1ddc008efc44f3987dedca8d0fcce0",
  network: "AutoHelp Ledger (simulated hash-chain)",
  created_at: "",
};
const block1: LedgerBlock = {
  ...genesis,
  block_index: 1,
  event_type: "MECHANIC_VERIFIED",
  record_type: "mechanic",
  record_ref: "MECH-001",
  payload: '{"event": "MECHANIC_VERIFIED", "recordRef": "MECH-001", "timestamp": 1793956312, "mechanicId": "MECH-001", "recordType": "mechanic"}',
  data_hash: "dcf40b30e84896ef869dfb8bcca4e78e61bfdc398c9b1d083ad38d9531ab33c5",
  record_hash: null,
  prev_hash: "fd3e57080e998d84299634699869a7f61e1ddc008efc44f3987dedca8d0fcce0",
  block_hash: "24bf60c0a2f023888f0d6031e9d84bed7b02979d6659c1f200eaa695156dd3cf",
};

describe("ledger verification", () => {
  it("accepts blocks hashed by the database", async () => {
    expect((await verifyBlock(genesis, null)).ok).toBe(true);
    expect((await verifyBlock(block1, genesis)).ok).toBe(true);
  });
  it("rejects a block whose payload was altered", async () => {
    const forged = { ...block1, payload: block1.payload.replace("MECH-001", "MECH-002") };
    expect((await verifyBlock(forged, genesis)).dataHashOk).toBe(false);
  });
  it("rejects a block not linked to its predecessor", async () => {
    expect((await verifyBlock({ ...block1, prev_hash: "a".repeat(64) }, genesis)).ok).toBe(false);
  });
  it("rejects blocks when the previous block is missing", async () => {
    expect((await verifyBlock(block1)).linkOk).toBe(false);
    expect((await verifyChain([block1])).every((check) => check.ok)).toBe(false);
  });
  it("matches a mechanic's current selected fields to its fingerprint", async () => {
    const salt = "a".repeat(64);
    const snapshot: RecordSnapshot = {
      type: "mechanic",
      ref: "MECH-001",
      name: "Thabo Mokhesi",
      workshop: "Mokhesi Motor Works",
      town: "Maseru",
      specialties: ["Engine", "Brakes"],
      experienceYears: 12,
      verified: true,
    };
    const recordHash = await fingerprintRecord(snapshot, salt);
    const proof: LedgerBlock = {
      ...block1,
      record_hash: recordHash,
      payload: JSON.stringify({ recordHash, verified: true }),
    };
    expect(await verifyRecordSnapshot([proof], snapshot, salt)).toBe(true);
    expect(await verifyRecordSnapshot([proof], { ...snapshot, town: "Leribe" }, salt)).toBe(false);
    expect(await verifyRecordSnapshot([proof], { ...snapshot, verified: false }, salt)).toBe(false);
  });
  it("matches the current request fields to the latest ledger fingerprint", async () => {
    const salt = "b".repeat(64);
    const sentSnapshot: RecordSnapshot = {
      type: "service_request",
      ref: "REQ-1",
      category: "Engine",
      mechanicCode: "MECH-001",
      status: "sent",
      vehicleMake: "Toyota",
      vehicleModel: "Hilux",
      vehicleYear: 2015,
      description: "Engine noise",
      contactPhone: "+266 50000000",
    };
    const acceptedSnapshot = { ...sentSnapshot, status: "accepted" };
    const sentHash = await fingerprintRecord(sentSnapshot, salt);
    const acceptedHash = await fingerprintRecord(acceptedSnapshot, salt);
    const sent: LedgerBlock = {
      ...block1,
      block_index: 2,
      event_type: "REQUEST_SENT",
      record_type: "service_request",
      record_ref: "REQ-1",
      record_hash: sentHash,
      payload: JSON.stringify({ recordHash: sentHash, status: "sent" }),
    };
    const accepted: LedgerBlock = {
      ...sent,
      block_index: 3,
      event_type: "REQUEST_ACCEPTED",
      record_hash: acceptedHash,
      payload: JSON.stringify({ recordHash: acceptedHash, status: "accepted" }),
    };
    expect(await verifyRecordSnapshot([sent, accepted], acceptedSnapshot, salt)).toBe(true);
    expect(await verifyRecordSnapshot([sent, accepted], { ...acceptedSnapshot, status: "completed" }, salt)).toBe(false);
    expect(await verifyRecordSnapshot([sent, accepted], { ...acceptedSnapshot, category: "Brakes" }, salt)).toBe(false);
    expect(await verifyRecordSnapshot([sent, accepted], { ...acceptedSnapshot, contactPhone: null }, salt)).toBe(false);
  });
});

// Seeds Firestore with 3 demo Lesotho mechanics and a valid hash-chain ledger
// (APPLIED + VERIFIED event for each mechanic = 6 blocks), using the same hashing rules as
// functions/src/ledger.ts, so the app, the verifier and `npm run anchor` all accept it.
//
// Usage (free Spark plan, no Cloud Functions needed):
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "D:\keys\musolink-key.json"
//   node scripts/seed-ledger.mjs --dry-run   # builds + verifies the chain in memory only
//   node scripts/seed-ledger.mjs             # writes to Firestore
import crypto from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");
const GENESIS_PREV = "0".repeat(64);
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const field = (v) => (v === null ? "~" : Buffer.from(String(v), "utf8").toString("hex"));

function canonicalMechanic(m) {
  return [
    "autohelp:v1",
    "mechanic",
    field(m.code),
    field(m.name),
    field(m.workshop),
    field(m.town),
    m.specialties.map(field).join(","),
    field(String(m.experience_years)),
    field(String(m.verified)),
  ].join("|");
}

const now = new Date();
const createdAt = now.toISOString();

const mechanics = [
  {
    id: "demo-thabo",
    code: "LS-DEMO0001",
    name: "Thabo Mokoena",
    workshop: "Mokoena Auto Works",
    town: "Maseru",
    experience_years: 12,
    specialties: ["Engine", "Brakes"],
    bio: "Engine and brake specialist serving Maseru and surrounding areas.",
    photo_key: "thabo",
  },
  {
    id: "demo-lineo",
    code: "LS-DEMO0002",
    name: "Lineo Mohapi",
    workshop: "Lineo Electrical & Battery",
    town: "Teyateyaneng",
    experience_years: 8,
    specialties: ["Electrical", "Battery"],
    bio: "Auto electrician: batteries, alternators and wiring faults.",
    photo_key: "lineo",
  },
  {
    id: "demo-neo",
    code: "LS-DEMO0003",
    name: "Neo Letsie",
    workshop: "Letsie Tyre & Service",
    town: "Mafeteng",
    experience_years: 5,
    specialties: ["Tyre", "Other"],
    bio: "Tyre fitting, balancing and general servicing.",
    photo_key: "neo",
  },
];

// Build the chain in memory.
const blocks = [];
const secrets = [];
let prevHash = GENESIS_PREV;
let ts = Math.floor(now.getTime() / 1000);

function append(eventType, mechanic, verified) {
  const index = blocks.length;
  const salt = crypto.randomBytes(32).toString("hex");
  const record = { ...mechanic, verified };
  const recordHash = sha(`${salt}|${canonicalMechanic(record)}`);
  ts += 1;
  const payload = JSON.stringify({
    event: eventType,
    recordRef: mechanic.code,
    timestamp: ts,
    verified,
    recordHash,
  });
  const dataHash = sha(payload);
  const blockHash = sha(`${index}|${prevHash}|${dataHash}|${ts}`);
  const id = String(index).padStart(12, "0");
  blocks.push({
    id,
    data: {
      block_index: index,
      ts,
      event_type: eventType,
      record_type: "mechanic",
      record_ref: mechanic.code,
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
    },
  });
  secrets.push({ id, data: { block_index: index, salt } });
  prevHash = blockHash;
}

for (const m of mechanics) {
  append("MECHANIC_APPLIED", m, false);
  append("MECHANIC_VERIFIED", m, true);
}

// Self-check using the same rules as scripts/anchor-ledger.mjs and src/lib/ledger.ts.
blocks.forEach(({ data: b }, i) => {
  const prev = i === 0 ? GENESIS_PREV : blocks[i - 1].data.block_hash;
  const ok =
    b.block_index === i &&
    b.prev_hash === prev &&
    sha(b.payload) === b.data_hash &&
    sha(`${b.block_index}|${b.prev_hash}|${b.data_hash}|${b.ts}`) === b.block_hash;
  if (!ok) throw new Error(`Self-check failed at block #${i}`);
});
console.log(`Built ${blocks.length} blocks in memory; hash-chain self-check passed.`);
console.log(`Head: block #${blocks.length - 1} ${prevHash}`);

if (DRY_RUN) {
  console.log("Dry run only - nothing written to Firestore.");
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key path first.');
  process.exit(1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const fs = await import("node:fs");
const key = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
initializeApp({ credential: cert(key), projectId: key.project_id });
const db = getFirestore();

// Refuse to touch an existing ledger so the chain can never be forked by accident.
const head = await db.doc("ledger_state/head").get();
const existing = await db.collection("ledger_blocks").limit(1).get();
if (head.exists || !existing.empty) {
  console.error("Ledger already has data - refusing to seed. Nothing was written.");
  process.exit(1);
}

const batch = db.batch();
for (const m of mechanics) {
  batch.set(db.doc(`mechanics/${m.id}`), {
    ...m,
    verified: true,
    available: true,
    jobs_completed: 0,
    rating: 0,
    is_demo: true,
    created_at: createdAt,
  });
}
for (const b of blocks) batch.set(db.doc(`ledger_blocks/${b.id}`), b.data);
for (const s of secrets) batch.set(db.doc(`ledger_secrets/${s.id}`), s.data);
const last = blocks.at(-1).data;
batch.set(db.doc("ledger_state/head"), { block_index: last.block_index, block_hash: last.block_hash });
await batch.commit();

console.log(`Seeded ${mechanics.length} mechanics and ${blocks.length} ledger blocks into project ${key.project_id}.`);
console.log("Now run: npm run anchor");

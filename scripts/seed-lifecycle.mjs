// AutoHelp - append a demo JOB LIFECYCLE to the existing hash-chain ledger (free Spark plan, no Cloud Functions).
// Uses exactly the same hashing rules as functions/src/ledger.ts, so the app, the checker and `npm run anchor` accept it.
// Every block is labelled "demo": true and uses LS-DEMOREQ* references. No personal data is written.
//
//   node scripts/seed-lifecycle.mjs --dry-run                 (reads the public ledger, writes nothing, needs no key)
//   node scripts/seed-lifecycle.mjs --key="D:\keys\key.json"  (appends to Firestore)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

process.on("uncaughtException", (e) => { console.error("\nERROR: " + e.message); process.exit(1); });
process.on("unhandledRejection", (e) => { console.error("\nERROR: " + (e && e.message ? e.message : e)); process.exit(1); });

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const keyArg = (args.find((a) => a.startsWith("--key=")) || "").slice(6).replace(/^"|"$/g, "");
const GENESIS = "0".repeat(64);
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const field = (v) => (v === null ? "~" : Buffer.from(String(v), "utf8").toString("hex"));
const pad = (n) => String(n).padStart(12, "0");

if (fs.existsSync(".env")) process.loadEnvFile(".env");
const { VITE_FIREBASE_PROJECT_ID: PROJECT_ID, VITE_FIREBASE_API_KEY: API_KEY } = process.env;
if (!PROJECT_ID || !API_KEY) throw new Error("Missing VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_API_KEY in .env - run from the project root.");

// ---- the demo jobs -------------------------------------------------------------------------
const jobs = [
  { ref: "LS-DEMOREQ1", mech: "LS-DEMO0001", category: "Brakes", make: "Toyota", model: "Hilux", year: 2016,
    description: "DEMO seed record: brake pads squealing", steps: ["sent", "accepted", "in_progress", "completed", "review"], rating: 5 },
  { ref: "LS-DEMOREQ2", mech: "LS-DEMO0002", category: "Battery", make: "Nissan", model: "NP200", year: 2014,
    description: "DEMO seed record: car will not start", steps: ["sent", "accepted", "in_progress", "completed", "review"], rating: 4 },
  { ref: "LS-DEMOREQ3", mech: "LS-DEMO0003", category: "Tyre", make: "Volkswagen", model: "Polo", year: 2019,
    description: "DEMO seed record: slow puncture", steps: ["sent", "declined", "accepted", "in_progress"], rating: null },
];

function canonicalRequest(r) {
  return ["autohelp:v1", "service_request", field(r.ref), field(r.category), field(r.mech), field(r.status),
    field(r.make), field(r.model), field(r.year === null ? null : String(r.year)), field(r.description), field(null)].join("|");
}

// interleave the jobs so the ledger reads like real activity
const plan = [];
for (let i = 0; i < Math.max(...jobs.map((j) => j.steps.length)); i++)
  for (const job of jobs) if (job.steps[i]) plan.push({ job, step: job.steps[i] });

function buildBlocks(startIndex, startPrev, startTs) {
  const blocks = [], secrets = [];
  let prev = startPrev, ts = startTs;
  plan.forEach(({ job, step }, n) => {
    const index = startIndex + n;
    ts += 1;
    let eventType, recordType = "service_request", extra, effective, record = true;
    if (step === "review") { eventType = "REVIEW_SUBMITTED"; recordType = "review"; extra = { rating: job.rating }; record = false; }
    else if (step === "declined") { eventType = "REQUEST_DECLINED_AND_RETURNED_TO_POOL"; effective = "sent"; extra = { status: "sent" }; }
    else if (step === "sent") { eventType = "REQUEST_SENT"; effective = "sent"; extra = { category: job.category, mechanicCode: job.mech, status: "sent" }; }
    else { eventType = "REQUEST_" + step.toUpperCase(); effective = step; extra = { status: step }; }

    let salt = null, recordHash = null;
    if (record) {
      salt = crypto.randomBytes(32).toString("hex");
      recordHash = sha(`${salt}|${canonicalRequest({ ...job, status: effective })}`);
    }
    const payload = JSON.stringify({ event: eventType, recordRef: job.ref, timestamp: ts, ...extra, demo: true, ...(recordHash ? { recordHash } : {}) });
    const dataHash = sha(payload);
    const blockHash = sha(`${index}|${prev}|${dataHash}|${ts}`);
    const id = pad(index);
    blocks.push({ id, data: {
      block_index: index, ts, event_type: eventType, record_type: recordType, record_ref: job.ref, payload,
      data_hash: dataHash, record_hash: recordHash, prev_hash: prev, block_hash: blockHash,
      network: "Firebase Firestore (simulated hash-chain)", created_at: new Date(ts * 1000).toISOString(),
      tx_hash: null, block_number: null, contract_address: null } });
    if (salt) secrets.push({ id, data: { block_index: index, salt } });
    prev = blockHash;
  });
  return { blocks, secrets };
}

function selfCheck(blocks, startIndex, startPrev) {
  blocks.forEach(({ data: b }, i) => {
    const prev = i === 0 ? startPrev : blocks[i - 1].data.block_hash;
    const ok = b.block_index === startIndex + i && b.prev_hash === prev && sha(b.payload) === b.data_hash &&
      sha(`${b.block_index}|${b.prev_hash}|${b.data_hash}|${b.ts}`) === b.block_hash &&
      !/@|contact|phone|email/i.test(b.payload);
    if (!ok) throw new Error(`Self-check failed at new block #${b.block_index}`);
  });
}

function show(blocks) {
  console.log("\n  index  event                                      reference");
  for (const { data: b } of blocks) console.log(`  ${String(b.block_index).padEnd(5)}  ${b.event_type.padEnd(41)}  ${b.record_ref}`);
  console.log("");
}

// ---- read the current public ledger ----------------------------------------------------------
async function readPublicChain() {
  const out = []; let token;
  do {
    const p = new URLSearchParams({ pageSize: "500", key: API_KEY }); if (token) p.set("pageToken", token);
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/ledger_blocks?${p}`);
    if (!res.ok) throw new Error(`Could not read the public ledger: HTTP ${res.status}`);
    const j = await res.json();
    for (const d of j.documents ?? []) { const f = d.fields ?? {};
      out.push({ index: Number(f.block_index?.integerValue), ts: Number(f.ts?.integerValue), hash: f.block_hash?.stringValue, ref: f.record_ref?.stringValue }); }
    token = j.nextPageToken;
  } while (token);
  return out.sort((a, b) => a.index - b.index);
}

if (DRY) {
  const chain = await readPublicChain();
  if (chain.length === 0) throw new Error("The ledger is empty - seed the mechanics first (scripts/seed-ledger.mjs).");
  if (chain.some((b) => (b.ref || "").startsWith("LS-DEMOREQ"))) throw new Error("Demo jobs are already in the ledger - nothing to do.");
  const head = chain.at(-1);
  const { blocks } = buildBlocks(head.index + 1, head.hash, Math.max(Math.floor(Date.now() / 1000), head.ts));
  selfCheck(blocks, head.index + 1, head.hash);
  console.log(`Current ledger: ${chain.length} blocks, head #${head.index}.`);
  console.log(`DRY RUN OK: would append ${blocks.length} blocks (#${head.index + 1} to #${head.index + blocks.length}); the new chain verified in memory.`);
  show(blocks);
  console.log("Nothing was written.");
  process.exit(0);
}

// ---- real run ---------------------------------------------------------------------------------
const keyPath = keyArg || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !fs.existsSync(keyPath)) throw new Error('Pass your service-account key: --key="D:\\keys\\your-key.json"');
const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
if (key.project_id !== PROJECT_ID) throw new Error(`Key is for project "${key.project_id}" but .env says "${PROJECT_ID}". Refusing to write.`);

const req = createRequire(path.resolve("functions", "package.json"));
let appMod, fsMod;
try { appMod = req("firebase-admin/app"); fsMod = req("firebase-admin/firestore"); }
catch { appMod = await import("firebase-admin/app"); fsMod = await import("firebase-admin/firestore"); }
appMod.initializeApp({ credential: appMod.cert(key), projectId: key.project_id });
const db = fsMod.getFirestore();

let written = null;
await db.runTransaction(async (tx) => {
  const headRef = db.doc("ledger_state/head");
  const [head, already] = await Promise.all([
    tx.get(headRef),
    tx.get(db.collection("ledger_blocks").where("record_ref", "==", "LS-DEMOREQ1").limit(1)),
  ]);
  if (!head.exists) throw new Error("ledger_state/head not found - seed the mechanics first (scripts/seed-ledger.mjs).");
  if (!already.empty) throw new Error("Demo jobs are already in the ledger - nothing written.");
  const startIndex = Number(head.get("block_index")) + 1;
  const startPrev = String(head.get("block_hash"));
  const last = await tx.get(db.doc(`ledger_blocks/${pad(startIndex - 1)}`));
  if (!last.exists || last.get("block_hash") !== startPrev) throw new Error("Ledger head does not match the last block - stopping so the chain cannot fork.");
  const { blocks, secrets } = buildBlocks(startIndex, startPrev, Math.max(Math.floor(Date.now() / 1000), Number(last.get("ts"))));
  selfCheck(blocks, startIndex, startPrev);
  for (const b of blocks) tx.create(db.doc(`ledger_blocks/${b.id}`), b.data);
  for (const s of secrets) tx.create(db.doc(`ledger_secrets/${s.id}`), s.data);
  const tip = blocks.at(-1).data;
  tx.set(headRef, { block_index: tip.block_index, block_hash: tip.block_hash });
  written = { blocks, startIndex };
});

console.log(`Appended ${written.blocks.length} blocks (#${written.startIndex} to #${written.startIndex + written.blocks.length - 1}) to project ${key.project_id}.`);
show(written.blocks);
console.log("Next: npm run anchor");
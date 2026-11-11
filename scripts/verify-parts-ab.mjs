// AutoHelp - verification for PART A (application + hosting) and PART B (blockchain records).
// Run from the project root:  node scripts/verify-parts-ab.mjs
// Optional: --url=https://your-site.web.app   --skip-tests   --skip-live
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=");
const SKIP_TESTS = flag("skip-tests");
const SKIP_LIVE = flag("skip-live");

const rows = [];
function rec(part, name, status, detail = "") {
  rows.push({ part, name, status });
  console.log(`[${status}] ${part} | ${name}${detail ? "\n         -> " + detail : ""}`);
}
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8").replace(/\r/g, "") : null);
const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const run = (cmd, a) => spawnSync(cmd, a, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function parseEnv(text) {
  const out = {};
  for (const line of (text || "").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = parseEnv(read(".env"));
const firebaserc = (() => { try { return JSON.parse(read(".firebaserc")); } catch { return null; } })();
const projectId = env.VITE_FIREBASE_PROJECT_ID || firebaserc?.projects?.default;
const site = firebaserc?.targets?.[firebaserc?.projects?.default]?.hosting?.main?.[0];
const liveUrl = (opt("url") || (site ? `https://${site}.web.app` : "")).replace(/\/$/, "");

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

console.log("\n=== PART A: SOFTWARE DEVELOPMENT ===\n");

// A1 - application routes exist
const needRoutes = ["index", "mechanics.index", "mechanics.$id", "request.$mechanicId", "requests", "auth", "workshop", "admin", "profile", "ledger", "privacy"];
const missingRoutes = needRoutes.filter((r) => !fs.existsSync(path.join("src", "routes", `${r}.tsx`)));
missingRoutes.length
  ? rec("A", "Application pages exist", "FAIL", "missing: " + missingRoutes.join(", "))
  : rec("A", "Application pages exist", "PASS", `${needRoutes.length} routes found`);

// A2 - Firebase config present
const needEnv = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"];
const missingEnv = needEnv.filter((k) => !env[k]);
missingEnv.length
  ? rec("A", "Firebase configuration (.env)", "FAIL", "missing: " + missingEnv.join(", "))
  : rec("A", "Firebase configuration (.env)", "PASS", `project: ${projectId}`);

// A3 - Cloud Functions backend source present
const fnSrc = read("functions/src/index.ts") || "";
const needFns = ["createServiceRequest", "updateServiceRequestStatus", "verifyMechanic", "submitReview", "verifyLedgerRecord"];
const missingFns = needFns.filter((f) => !new RegExp(`export const ${f}\\b`).test(fnSrc));
missingFns.length
  ? rec("A", "Backend Cloud Functions defined", "FAIL", "missing: " + missingFns.join(", "))
  : rec("A", "Backend Cloud Functions defined", "PASS", "request, status, verification, review and ledger functions found");

// A4 - type-check (Part D files excluded on purpose)
{
  const r = run("npx", ["tsc", "--noEmit"]);
  const errs = (r.stdout || "").split("\n").filter((l) => l.includes("error TS"));
  const partD = (l) => l.startsWith("src/lib/ml.ts") || l.startsWith("src/routes/ai-dashboards.tsx");
  const mine = errs.filter((l) => !partD(l));
  mine.length === 0
    ? rec("A", "TypeScript compiles (Part A/B files)", "PASS", errs.length ? `${errs.length} errors remain in Part D files only (ml.ts / ai-dashboards.tsx)` : "no errors")
    : rec("A", "TypeScript compiles (Part A/B files)", "FAIL", mine.slice(0, 5).join("\n            "));
  const f = run("npx", ["tsc", "--noEmit", "-p", "functions/tsconfig.json"]);
  f.status === 0
    ? rec("A", "Cloud Functions compile", "PASS")
    : rec("A", "Cloud Functions compile", "FAIL", (f.stdout || f.stderr || "").split("\n").slice(0, 4).join(" | "));
}

// A5 - routing test
if (!SKIP_TESTS) {
  const r = run("npx", ["vitest", "run", "src/test/app-routing.test.tsx"]);
  r.status === 0 ? rec("A", "App routing unit test", "PASS") : rec("A", "App routing unit test", "FAIL", (r.stdout + r.stderr).split("\n").slice(-8).join(" | "));
}

// A6 - production build + hosting config
{
  const fb = (() => { try { return JSON.parse(read("firebase.json")); } catch { return null; } })();
  const pub = fb?.hosting?.public;
  if (!pub) rec("A", "Firebase Hosting configured", "FAIL", "firebase.json has no hosting.public");
  else if (!fs.existsSync(path.join(pub, "_shell.html"))) rec("A", "Firebase Hosting configured", "WARN", `${pub}/_shell.html not found - run: npm run build`);
  else rec("A", "Firebase Hosting configured", "PASS", `serves ${pub}, SPA rewrite -> ${fb.hosting.rewrites?.[0]?.destination}`);
}

// A7 - app is actually hosted and reachable
if (SKIP_LIVE) rec("A", "Hosted app reachable", "WARN", "skipped (--skip-live)");
else if (!liveUrl) rec("A", "Hosted app reachable", "FAIL", "could not work out the site URL - pass --url=https://...");
else {
  try {
    const home = await fetch(liveUrl, { signal: AbortSignal.timeout(20000) });
    const html = await home.text();
    const deep = await fetch(liveUrl + "/ledger", { signal: AbortSignal.timeout(20000) });
    home.ok && /<html/i.test(html) && deep.ok
      ? rec("A", "Hosted app reachable", "PASS", `${liveUrl} (home ${home.status}, /ledger ${deep.status})`)
      : rec("A", "Hosted app reachable", "FAIL", `${liveUrl} -> home ${home.status}, /ledger ${deep.status}`);
  } catch (e) {
    rec("A", "Hosted app reachable", "FAIL", `${liveUrl} - ${e.message}`);
  }
}

// A8 - write features switched on?
env.VITE_FIREBASE_MUTATIONS_ENABLED === "true"
  ? rec("A", "Write features enabled", "PASS", "customers can create requests, mechanics can update them")
  : rec("A", "Write features enabled", "WARN", "VITE_FIREBASE_MUTATIONS_ENABLED=false -> the app is READ-ONLY, so no new ledger records can be created from the app. Deploy Functions, set it to true, rebuild and redeploy.");

console.log("\n=== PART B: BLOCKCHAIN TECHNOLOGY ===\n");

// B1 - contracts
{
  const anchor = read("contracts/AutoHelpAnchor.sol"), ledger = read("contracts/AutoHelpLedger.sol");
  anchor && ledger && /function anchor\(/.test(anchor) && /function recordEvent\(/.test(ledger)
    ? rec("B", "Smart contracts written", "PASS", "AutoHelpAnchor.sol (checkpoints) + AutoHelpLedger.sol (per-block entries)")
    : rec("B", "Smart contracts written", "FAIL", "contracts/*.sol missing or incomplete");
}

// B2 - browser and server hash formulas identical
{
  const client = read("src/lib/ledger.ts") || "", server = read("functions/src/ledger.ts") || "";
  const f = "${blockIndex}|${prevHash}|${dataHash}|${ts}";
  const clientOk = client.includes("`${b.block_index}|${b.prev_hash}|${b.data_hash}|${b.ts}`");
  const serverOk = server.includes("`" + f + "`");
  clientOk && serverOk
    ? rec("B", "Browser and server hash formula match", "PASS", "block_hash = SHA-256(index|prev_hash|data_hash|ts)")
    : rec("B", "Browser and server hash formula match", "FAIL", `client:${clientOk} server:${serverOk}`);
}

// B3 - append-only enforced by security rules
{
  const rules = read("firestore.rules") || "";
  const m = rules.match(/match \/ledger_blocks\/\{blockId\} \{([\s\S]*?)\n    \}/);
  const body = m ? m[1] : "";
  const ok = m && /allow get: if true/.test(body) && /allow list: if true/.test(body) &&
    /allow create: if false/.test(body) && /allow update: if false/.test(body) && /allow delete: if false/.test(body);
  ok ? rec("B", "Ledger is public-read and write-locked (rules)", "PASS", "only Cloud Functions (admin SDK) can append")
     : rec("B", "Ledger is public-read and write-locked (rules)", "FAIL", "ledger_blocks rules not as expected");
  /match \/ledger_secrets/.test(rules) && /match \/ledger_secrets\/\{secretId\} \{[\s\S]*?allow get: if false/.test(rules)
    ? rec("B", "Ledger salts are private (rules)", "PASS")
    : rec("B", "Ledger salts are private (rules)", "FAIL");
}

// B4 - ledger + anchor unit tests
if (!SKIP_TESTS) {
  const r = run("npx", ["vitest", "run", "src/test/ledger.test.ts", "src/test/anchor.test.ts"]);
  r.status === 0
    ? rec("B", "Ledger + anchor unit tests (tamper detection)", "PASS")
    : rec("B", "Ledger + anchor unit tests (tamper detection)", "FAIL", (r.stdout + r.stderr).split("\n").slice(-8).join(" | "));
}

// B5 - verify the LIVE ledger chain from the public database
let liveBlocks = null;
if (SKIP_LIVE) rec("B", "Live ledger hash-chain verified", "WARN", "skipped (--skip-live)");
else if (!projectId) rec("B", "Live ledger hash-chain verified", "FAIL", "no Firebase project id");
else {
  try {
    const val = (v) => v == null ? null : v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue ?? (v.nullValue !== undefined ? null : v.timestampValue ?? null));
    const docs = [];
    let token = "";
    do {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ledger_blocks?pageSize=300&orderBy=block_index${token ? "&pageToken=" + encodeURIComponent(token) : ""}`;
      const j = await getJson(url);
      for (const d of j.documents || []) { const o = {}; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); docs.push(o); }
      token = j.nextPageToken || "";
    } while (token);
    liveBlocks = docs.sort((a, b) => a.block_index - b.block_index);
    if (liveBlocks.length === 0) rec("B", "Live ledger hash-chain verified", "FAIL", "ledger_blocks is empty - run the seed/ledger scripts");
    else {
      const problems = [];
      liveBlocks.forEach((b, i) => {
        if (b.block_index !== i) problems.push(`#${b.block_index}: expected index ${i}`);
        const prev = i === 0 ? "0".repeat(64) : liveBlocks[i - 1].block_hash;
        if (b.prev_hash !== prev) problems.push(`#${b.block_index}: prev_hash does not link to previous block`);
        if (sha256(String(b.payload)) !== b.data_hash) problems.push(`#${b.block_index}: payload does not match data_hash`);
        if (sha256(`${b.block_index}|${b.prev_hash}|${b.data_hash}|${b.ts}`) !== b.block_hash) problems.push(`#${b.block_index}: block_hash is wrong`);
      });
      problems.length === 0
        ? rec("B", "Live ledger hash-chain verified", "PASS", `${liveBlocks.length} blocks, genesis to head, every hash and link recomputed independently`)
        : rec("B", "Live ledger hash-chain verified", "FAIL", problems.slice(0, 6).join("\n            "));
      const kinds = [...new Set(liveBlocks.map((b) => b.event_type))];
      kinds.length >= 2
        ? rec("B", "Ledger holds real app events", "PASS", kinds.slice(0, 8).join(", "))
        : rec("B", "Ledger holds real app events", "WARN", `only: ${kinds.join(", ")}`);
    }
  } catch (e) {
    rec("B", "Live ledger hash-chain verified", "FAIL", e.message);
  }
}

// B6 - no personal data in ledger payloads (GDPR Art. 17)
if (liveBlocks && liveBlocks.length) {
  const badKeys = /^(name|full_name|fullName|email|phone|contact_phone|contactPhone|description|address|vehicle_make|vehicle_model|vehicleMake|vehicleModel|plate|registration)$/i;
  const hits = [];
  for (const b of liveBlocks) {
    let p = null; try { p = JSON.parse(b.payload); } catch { hits.push(`#${b.block_index}: payload is not JSON`); continue; }
    for (const k of Object.keys(p)) if (badKeys.test(k)) hits.push(`#${b.block_index}: key "${k}"`);
    const s = b.payload;
    if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s)) hits.push(`#${b.block_index}: looks like an email address`);
    if (/(\+?266[\s-]?)?\b[2-6]\d{7}\b/.test(s)) hits.push(`#${b.block_index}: looks like a Lesotho phone number`);
  }
  hits.length === 0
    ? rec("B", "No personal data in ledger payloads", "PASS", "payloads hold only status/ids/hashes")
    : rec("B", "No personal data in ledger payloads", "FAIL", hits.slice(0, 6).join("\n            "));
}

// B7 - head of the chain is published on a public blockchain (Ethereum Sepolia)
{
  const store = (() => { try { return JSON.parse(read("public/anchors.json")); } catch { return null; } })();
  if (!store || !store.anchors?.length) rec("B", "Checkpoints published on public blockchain", "FAIL", "public/anchors.json missing or empty - run: npm run anchor");
  else if (SKIP_LIVE) rec("B", "Checkpoints published on public blockchain", "WARN", "skipped (--skip-live)");
  else {
    try {
      const { ethers } = await import("ethers");
      const p = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com", undefined, { staticNetwork: true });
      const code = await p.getCode(store.contract);
      if (code === "0x") rec("B", "Anchor contract deployed on Sepolia", "FAIL", store.contract);
      else rec("B", "Anchor contract deployed on Sepolia", "PASS", `${store.contract}\n         -> https://sepolia.etherscan.io/address/${store.contract}`);
      const c = new ethers.Contract(store.contract, ["function checkpoints(uint256) view returns (bytes32)", "function checkpointCount() view returns (uint256)"], p);
      let bad = 0;
      for (const a of store.anchors) {
        const onchain = String(await c.checkpoints(a.checkpointIndex)).toLowerCase();
        const same = onchain === ("0x" + a.blockHash).toLowerCase();
        const r = await p.getTransactionReceipt(a.txHash);
        const txOk = r && r.status === 1;
        const ledgerOk = !liveBlocks || liveBlocks[a.checkpointIndex]?.block_hash === a.blockHash;
        const good = same && txOk && ledgerOk;
        if (!good) bad++;
        rec("B", `Checkpoint #${a.checkpointIndex} matches chain + ledger`, good ? "PASS" : "FAIL",
          good ? `tx ${a.txHash}` : `on-chain match:${same} tx success:${!!txOk} matches live ledger block:${ledgerOk}`);
      }
      if (liveBlocks?.length) {
        const last = Math.max(...store.anchors.map((a) => a.checkpointIndex));
        const head = liveBlocks.length - 1;
        last >= head
          ? rec("B", "Latest ledger block is anchored", "PASS", `anchored up to block ${last} of ${head}`)
          : rec("B", "Latest ledger block is anchored", "WARN", `blocks ${last + 1}..${head} are newer than the last anchor - run: npm run anchor`);
      }
    } catch (e) {
      rec("B", "Checkpoints published on public blockchain", "FAIL", `could not query Sepolia: ${e.message}`);
    }
  }
}

// summary
const count = (s) => rows.filter((r) => r.status === s).length;
console.log("\n=== SUMMARY ===");
for (const part of ["A", "B"]) {
  const r = rows.filter((x) => x.part === part);
  const f = r.filter((x) => x.status === "FAIL").length, w = r.filter((x) => x.status === "WARN").length;
  console.log(`Part ${part}: ${r.length - f - w} passed, ${w} warnings, ${f} failed -> ${f ? "NOT READY" : w ? "READY, review warnings" : "READY"}`);
}
console.log(`Total: ${count("PASS")} PASS, ${count("WARN")} WARN, ${count("FAIL")} FAIL\n`);
process.exit(count("FAIL") ? 1 : 0);
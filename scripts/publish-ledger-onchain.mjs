// Reads the public Firestore ledger, verifies the whole hash-chain, then writes every block
// (event type + block hash) that is not yet on-chain into the AutoHelpLedger contract.
// Records progress in public/ledger-onchain.json.   Usage: npm run ledger:publish
import fs from "node:fs";
import crypto from "node:crypto";
import { ethers } from "ethers";

if (fs.existsSync(".env")) process.loadEnvFile(".env");
if (fs.existsSync(".env.anchor")) process.loadEnvFile(".env.anchor");
const { ANCHOR_RPC_URL, ANCHOR_PRIVATE_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_API_KEY } = process.env;
if (!ANCHOR_RPC_URL || !ANCHOR_PRIVATE_KEY) throw new Error("Missing ANCHOR_RPC_URL / ANCHOR_PRIVATE_KEY in .env.anchor");
if (!VITE_FIREBASE_PROJECT_ID || !VITE_FIREBASE_API_KEY) {
  throw new Error("Missing VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_API_KEY in .env");
}

const FILE = "public/ledger-onchain.json";
if (!fs.existsSync(FILE)) throw new Error(`${FILE} not found - run: npm run ledger:deploy`);
const store = JSON.parse(fs.readFileSync(FILE, "utf8"));
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const BATCH = 15;

// 1. Load every publicly readable Firestore ledger block.
const blocks = [];
let pageToken;
do {
  const params = new URLSearchParams({ pageSize: "500", key: VITE_FIREBASE_API_KEY });
  if (pageToken) params.set("pageToken", pageToken);
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(VITE_FIREBASE_PROJECT_ID)}` +
    `/databases/(default)/documents/ledger_blocks?${params}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Could not read Firestore ledger: ${res.status} ${await res.text()}`);
  const page = await res.json();
  for (const document of page.documents ?? []) {
    const fields = document.fields ?? {};
    const str = (name) => {
      const v = fields[name]?.stringValue;
      if (typeof v !== "string") throw new Error(`Ledger block is missing string field ${name}.`);
      return v;
    };
    const int = (name) => {
      const v = Number(fields[name]?.integerValue);
      if (!Number.isSafeInteger(v)) throw new Error(`Ledger block has invalid integer field ${name}.`);
      return v;
    };
    blocks.push({
      block_index: int("block_index"),
      ts: int("ts"),
      event_type: str("event_type"),
      payload: str("payload"),
      data_hash: str("data_hash"),
      prev_hash: str("prev_hash"),
      block_hash: str("block_hash"),
    });
  }
  pageToken = page.nextPageToken;
} while (pageToken);
blocks.sort((a, b) => a.block_index - b.block_index);
if (blocks.length === 0) throw new Error("Ledger is empty");

// 2. Refuse to publish a broken chain.
blocks.forEach((b, i) => {
  const prev = i === 0 ? "0".repeat(64) : blocks[i - 1].block_hash;
  const okLink = b.block_index === i && b.prev_hash === prev;
  const okData = sha(b.payload) === b.data_hash;
  const okBlock = sha(`${b.block_index}|${b.prev_hash}|${b.data_hash}|${b.ts}`) === b.block_hash;
  if (!(okLink && okData && okBlock)) throw new Error(`Hash-chain is broken at block #${b.block_index} - not publishing.`);
});

// 3. Compare with what the contract already holds.
const provider = new ethers.JsonRpcProvider(ANCHOR_RPC_URL);
const wallet = new ethers.Wallet(ANCHOR_PRIVATE_KEY, provider);
const abi = [
  "function recordBatch(uint256[] blockIndexes, string[] eventTypes, bytes32[] blockHashes)",
  "function recordCount() view returns (uint256)",
  "function getEntry(uint256 blockIndex) view returns (bytes32 blockHash, uint64 timestamp, string eventType)",
];
const contract = new ethers.Contract(store.contract, abi, wallet);
const already = Number(await contract.recordCount());
if (already > blocks.length) throw new Error(`Contract holds ${already} blocks but Firestore only has ${blocks.length}.`);
for (let i = 0; i < already; i++) {
  const [hash] = await contract.getEntry(i);
  if (hash !== "0x" + blocks[i].block_hash) {
    throw new Error(`On-chain block #${i} differs from Firestore - the ledger was altered or re-seeded. Deploy a new contract with --force.`);
  }
}

const pending = blocks.slice(already);
if (pending.length === 0) {
  console.log(`Nothing new: all ${blocks.length} blocks are already on-chain.`);
  process.exit(0);
}
console.log(`Publishing ${pending.length} new block(s) (#${pending[0].block_index}-#${pending.at(-1).block_index}) to ${store.contract}`);

// 4. Publish in batches.
for (let i = 0; i < pending.length; i += BATCH) {
  const chunk = pending.slice(i, i + BATCH);
  const tx = await contract.recordBatch(
    chunk.map((b) => b.block_index),
    chunk.map((b) => b.event_type),
    chunk.map((b) => "0x" + b.block_hash),
  );
  const receipt = await tx.wait();
  if (receipt?.status !== 1) throw new Error("Transaction failed");
  store.batches.push({
    fromIndex: chunk[0].block_index,
    toIndex: chunk.at(-1).block_index,
    txHash: receipt.hash,
    chainBlock: receipt.blockNumber,
    publishedAt: new Date().toISOString(),
  });
  console.log(`  blocks #${chunk[0].block_index}-#${chunk.at(-1).block_index} -> tx ${receipt.hash}`);
}

// 5. Read everything back from the chain and compare.
const total = Number(await contract.recordCount());
for (let i = 0; i < total; i++) {
  const [hash, , type] = await contract.getEntry(i);
  if (hash !== "0x" + blocks[i].block_hash || type !== blocks[i].event_type) {
    throw new Error(`Read-back mismatch at block #${i}`);
  }
}
store.recordCount = total;
store.headHash = blocks.at(-1).block_hash;
store.updatedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(store, null, 2) + "\n");
console.log(`Verified ${total}/${blocks.length} blocks on-chain. Commit + push ${FILE} so the website shows it.`);
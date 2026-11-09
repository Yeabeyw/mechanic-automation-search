// Reads the public ledger, verifies the whole hash-chain, then publishes the head block hash
// to the AutoHelpAnchor contract. Records the transaction in public/anchors.json.
// Usage: npm run anchor
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

const ANCHORS_FILE = "public/anchors.json";
if (!fs.existsSync(ANCHORS_FILE)) throw new Error("public/anchors.json not found - run: npm run anchor:deploy");
const store = JSON.parse(fs.readFileSync(ANCHORS_FILE, "utf8"));
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

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
    const readString = (name) => {
      const value = fields[name]?.stringValue;
      if (typeof value !== "string") throw new Error(`Ledger block is missing string field ${name}.`);
      return value;
    };
    const readInteger = (name) => {
      const value = Number(fields[name]?.integerValue);
      if (!Number.isSafeInteger(value)) throw new Error(`Ledger block has invalid integer field ${name}.`);
      return value;
    };
    blocks.push({
      block_index: readInteger("block_index"),
      ts: readInteger("ts"),
      payload: readString("payload"),
      data_hash: readString("data_hash"),
      prev_hash: readString("prev_hash"),
      block_hash: readString("block_hash"),
    });
  }
  pageToken = page.nextPageToken;
} while (pageToken);
blocks.sort((a, b) => a.block_index - b.block_index);
if (blocks.length === 0) throw new Error("Ledger is empty");

// 2. Refuse to anchor a broken chain
blocks.forEach((b, i) => {
  const prev = i === 0 ? "0".repeat(64) : blocks[i - 1].block_hash;
  const okLink = b.block_index === i && b.prev_hash === prev;
  const okData = sha(b.payload) === b.data_hash;
  const okBlock = sha(`${b.block_index}|${b.prev_hash}|${b.data_hash}|${b.ts}`) === b.block_hash;
  if (!(okLink && okData && okBlock)) throw new Error(`Hash-chain is broken at block #${b.block_index} - not anchoring.`);
});
const head = blocks.at(-1);
const last = store.anchors.at(-1);
if (last && last.checkpointIndex >= head.block_index) {
  console.log(`Nothing new: block #${last.checkpointIndex} is already anchored (tx ${last.txHash}).`);
  process.exit(0);
}

// 3. Publish the checkpoint
const provider = new ethers.JsonRpcProvider(ANCHOR_RPC_URL);
const wallet = new ethers.Wallet(ANCHOR_PRIVATE_KEY, provider);
const abi = ["function anchor(uint256 blockIndex, bytes32 blockHash)"];
const contract = new ethers.Contract(store.contract, abi, wallet);
console.log(`Anchoring block #${head.block_index} (${head.block_hash.slice(0, 12)}...) of ${blocks.length} blocks`);
const tx = await contract.anchor(head.block_index, "0x" + head.block_hash);
const receipt = await tx.wait();
if (receipt?.status !== 1) throw new Error("Transaction failed");

store.anchors.push({
  checkpointIndex: head.block_index,
  blockHash: head.block_hash,
  txHash: receipt.hash,
  chainBlock: receipt.blockNumber,
  anchoredAt: new Date().toISOString(),
});
fs.writeFileSync(ANCHORS_FILE, JSON.stringify(store, null, 2) + "\n");
console.log("Anchored. tx:", receipt.hash, "| chain block:", receipt.blockNumber);
console.log("Now commit + push public/anchors.json so the website shows it.");
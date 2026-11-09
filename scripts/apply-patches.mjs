// One-off patcher: wires the Sepolia anchor into existing files. Safe to run twice.
import fs from "node:fs";

function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (typeof from === "string" && s.includes(to)) continue; // already applied
    if (from instanceof RegExp ? !from.test(s) : !s.includes(from)) {
      if (!(from instanceof RegExp && s.includes("tx_hash?:"))) console.warn(`  ! pattern not found in ${file}: ${String(from).slice(0, 50)}`);
      continue;
    }
    s = from instanceof RegExp ? s.replace(from, to) : s.replace(from, () => to);
  }
  fs.writeFileSync(file, s);
  console.log("patched", file);
}

patch("src/lib/ledger.ts", [
  [/  created_at: string;(\r?\n)\};/, "  created_at: string;$1  tx_hash?: string | null;$1  block_number?: number | null;$1  contract_address?: string | null;$1};"],
]);

patch("src/components/LedgerProof.tsx", [
  [
    'import { verifyChain, short, type LedgerBlock, type RecordSnapshot } from "@/lib/ledger";',
    'import { verifyChain, short, type LedgerBlock, type RecordSnapshot } from "@/lib/ledger";\nimport { anchorFor, useAnchors } from "@/lib/anchor";',
  ],
  ["  const [busy, setBusy] = useState(false);", "  const [busy, setBusy] = useState(false);\n  const { data: anchorStore } = useAnchors();"],
  ["proof · Simulated", "proof · Hash-chain"],
  [
    "          Not a blockchain transaction",
    '          {anchorFor(latestBlock.block_index, anchorStore) ? "Anchored on Ethereum Sepolia" : "Not yet anchored on-chain"}',
  ],
]);

patch("src/routes/project.tsx", [
  [
    "Current demo mode is a simulated, database-backed SHA-256 hash chain.",
    "The ledger is a SHA-256 hash chain in the database whose head hash is periodically anchored to Ethereum Sepolia through the AutoHelpAnchor smart contract (see the ledger explorer for contract address and transaction links).",
  ],
  [" The app does not currently submit public-network transactions.", " Only hashes are published on-chain; no personal data."],
  ["Simulation only. Contract address: <b>Not deployed.</b> Transaction hashes: none.", "Hybrid: database hash-chain + public checkpoints. Contract address and transaction hashes are listed on the ledger explorer page."],
  ["<b>Future test network:</b> Sepolia or Polygon Amoy (Proof-of-Stake). No wallet secret is stored in this app.", "<b>Test network:</b> Ethereum Sepolia (Proof-of-Stake). The wallet key stays on the operator's computer; the website holds no secret."],
]);

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.scripts = { ...pkg.scripts, "anchor:deploy": "node scripts/deploy-anchor.mjs", anchor: "node scripts/anchor-ledger.mjs" };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("patched package.json scripts");
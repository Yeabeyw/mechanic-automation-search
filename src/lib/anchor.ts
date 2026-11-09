// Public-blockchain anchoring of the AutoHelp hash-chain (Ethereum Sepolia).
// Only the head block hash is published (see contracts/AutoHelpAnchor.sol); checkpoints are
// listed in /anchors.json and can be re-checked by anyone against a public RPC node.
import { useQuery } from "@tanstack/react-query";
import { verifyChain, type LedgerBlock } from "@/lib/ledger";

export const CHECKPOINT_TOPIC = "0xbcad6c330b3fb4fec8e9a33323e21f6cf160ab212b63f8fcf66767f92ede453c"; // keccak256("Checkpoint(uint256,bytes32,uint256)")
export const PUBLIC_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
export const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";
export const EXPLORER_ADDRESS = "https://sepolia.etherscan.io/address/";

export type Anchor = {
  checkpointIndex: number;
  blockHash: string;
  txHash: string;
  chainBlock: number;
  anchoredAt: string;
};
export type AnchorStore = { network: string; chainId: number; contract: string; deployTx?: string; anchors: Anchor[] };

export type RpcLog = { address: string; topics: string[]; data: string };
export type RpcReceipt = { status: string; blockNumber: string; logs: RpcLog[] };

export async function loadAnchors(): Promise<AnchorStore | null> {
  try {
    const res = await fetch("/anchors.json", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as AnchorStore;
    return json && typeof json.contract === "string" && Array.isArray(json.anchors) ? json : null;
  } catch {
    return null;
  }
}

export function useAnchors() {
  return useQuery({ queryKey: ["anchors"], queryFn: loadAnchors, staleTime: 60_000 });
}

/** The first checkpoint that covers a block (a checkpoint commits to every block up to its index). */
export function anchorFor(blockIndex: number, store: AnchorStore | null | undefined): Anchor | null {
  if (!store) return null;
  return store.anchors.find((a) => a.checkpointIndex >= blockIndex) ?? null;
}

/** Decode a Checkpoint(uint256 indexed blockIndex, bytes32 blockHash, uint256 timestamp) log. */
export function decodeCheckpointLog(log: RpcLog): { blockIndex: number; blockHash: string; timestamp: number } | null {
  if (log.topics[0]?.toLowerCase() !== CHECKPOINT_TOPIC || log.topics.length < 2) return null;
  const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  if (data.length < 128) return null;
  return {
    blockIndex: Number(BigInt(log.topics[1]!)),
    blockHash: data.slice(0, 64).toLowerCase(),
    timestamp: Number(BigInt("0x" + data.slice(64, 128))),
  };
}

export function receiptMatchesAnchor(receipt: RpcReceipt | null, anchor: Anchor, contract: string): boolean {
  if (!receipt || receipt.status !== "0x1") return false;
  return receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== contract.toLowerCase()) return false;
    const decoded = decodeCheckpointLog(log);
    return (
      decoded !== null &&
      decoded.blockIndex === anchor.checkpointIndex &&
      decoded.blockHash === anchor.blockHash.toLowerCase()
    );
  });
}

export async function fetchReceipt(txHash: string, rpcUrl = PUBLIC_RPC_URL): Promise<RpcReceipt | null> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
  });
  if (!res.ok) throw new Error(`RPC error ${res.status}`);
  const json = (await res.json()) as { result: RpcReceipt | null; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export type AnchorVerdict = { ok: boolean; message: string };

/** Full check: local chain intact up to the checkpoint, DB block == published hash, and the tx exists on-chain. */
export async function verifyAnchorOnChain(
  anchor: Anchor,
  contract: string,
  blocks: LedgerBlock[],
  getReceipt: (tx: string) => Promise<RpcReceipt | null> = fetchReceipt,
): Promise<AnchorVerdict> {
  const covered = blocks.filter((b) => b.block_index <= anchor.checkpointIndex);
  if (covered.length !== anchor.checkpointIndex + 1) return { ok: false, message: "Ledger is missing blocks covered by this checkpoint." };
  const checks = await verifyChain(covered);
  if (!checks.every((c) => c.ok)) return { ok: false, message: "Hash-chain is broken before the checkpoint." };
  const head = covered.at(-1)!;
  if (head.block_hash.toLowerCase() !== anchor.blockHash.toLowerCase()) {
    return { ok: false, message: `Block #${head.block_index} in the database differs from the hash that was published on-chain.` };
  }
  const receipt = await getReceipt(anchor.txHash);
  if (!receiptMatchesAnchor(receipt, anchor, contract)) {
    return { ok: false, message: "Transaction not found on the public network, or it does not contain this checkpoint." };
  }
  return { ok: true, message: `Block #${anchor.checkpointIndex} hash matches the Ethereum Sepolia checkpoint (chain block ${anchor.chainBlock}).` };
}
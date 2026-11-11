import { describe, expect, it } from "vitest";
import {
  anchorFor,
  CHECKPOINT_TOPIC,
  decodeCheckpointLog,
  receiptMatchesAnchor,
  verifyAnchorOnChain,
  type Anchor,
  type AnchorStore,
  type RpcReceipt,
} from "@/lib/anchor";
import { sha256Hex, blockHashInput, type LedgerBlock } from "@/lib/ledger";

const CONTRACT = "0x1111111111111111111111111111111111111111";

async function makeChain(n: number): Promise<LedgerBlock[]> {
  const out: LedgerBlock[] = [];
  for (let i = 0; i < n; i++) {
    const payload = JSON.stringify({ event: "E", i });
    const data_hash = await sha256Hex(payload);
    const prev_hash = i === 0 ? "0".repeat(64) : out[i - 1]!.block_hash;
    const base = { block_index: i, ts: 1000 + i, data_hash, prev_hash };
    out.push({
      ...base,
      event_type: "E",
      record_type: "system",
      record_ref: "R",
      payload,
      record_hash: null,
      block_hash: await sha256Hex(blockHashInput(base)),
      network: "test",
      created_at: "",
    });
  }
  return out;
}

function receiptFor(anchor: Anchor, hash = anchor.blockHash): RpcReceipt {
  return {
    status: "0x1",
    blockNumber: "0x10",
    logs: [
      {
        address: CONTRACT,
        topics: [CHECKPOINT_TOPIC, "0x" + anchor.checkpointIndex.toString(16).padStart(64, "0")],
        data: "0x" + hash + (1700000000).toString(16).padStart(64, "0"),
      },
    ],
  };
}

describe("on-chain anchoring", () => {
  it("decodes a Checkpoint log", () => {
    const a: Anchor = {
      checkpointIndex: 7,
      blockHash: "ab".repeat(32),
      txHash: "0xtx",
      chainBlock: 16,
      anchoredAt: "",
    };
    const d = decodeCheckpointLog(receiptFor(a).logs[0]!);
    expect(d).toEqual({ blockIndex: 7, blockHash: "ab".repeat(32), timestamp: 1700000000 });
  });
  it("finds the checkpoint that covers a block", () => {
    const store: AnchorStore = {
      network: "n",
      chainId: 1,
      contract: CONTRACT,
      anchors: [
        { checkpointIndex: 5, blockHash: "a", txHash: "t1", chainBlock: 1, anchoredAt: "" },
        { checkpointIndex: 9, blockHash: "b", txHash: "t2", chainBlock: 2, anchoredAt: "" },
      ],
    };
    expect(anchorFor(3, store)?.txHash).toBe("t1");
    expect(anchorFor(6, store)?.txHash).toBe("t2");
    expect(anchorFor(10, store)).toBeNull();
    expect(anchorFor(0, null)).toBeNull();
  });
  it("accepts an intact chain and rejects a rewritten database", async () => {
    const chain = await makeChain(5);
    const anchor: Anchor = {
      checkpointIndex: 4,
      blockHash: chain[4]!.block_hash,
      txHash: "0xtx",
      chainBlock: 16,
      anchoredAt: "",
    };
    expect(
      (await verifyAnchorOnChain(anchor, CONTRACT, chain, async () => receiptFor(anchor))).ok,
    ).toBe(true);

    // Attacker rewrites block 2 and re-hashes everything after it consistently.
    const forged = await makeChain(5);
    const payload = JSON.stringify({ event: "E", i: 2, forged: true });
    forged[2] = { ...forged[2]!, payload, data_hash: await sha256Hex(payload) };
    for (let i = 2; i < 5; i++) {
      if (i > 2) forged[i] = { ...forged[i]!, prev_hash: forged[i - 1]!.block_hash };
      forged[i] = { ...forged[i]!, block_hash: await sha256Hex(blockHashInput(forged[i]!)) };
    }
    const verdict = await verifyAnchorOnChain(anchor, CONTRACT, forged, async () =>
      receiptFor(anchor),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toMatch(/differs from the hash/);
  });
  it("rejects a missing or mismatching transaction", async () => {
    const chain = await makeChain(3);
    const anchor: Anchor = {
      checkpointIndex: 2,
      blockHash: chain[2]!.block_hash,
      txHash: "0xtx",
      chainBlock: 1,
      anchoredAt: "",
    };
    expect(receiptMatchesAnchor(null, anchor, CONTRACT)).toBe(false);
    expect(receiptMatchesAnchor(receiptFor(anchor, "cd".repeat(32)), anchor, CONTRACT)).toBe(false);
    expect(
      receiptMatchesAnchor(
        receiptFor(anchor),
        anchor,
        "0x2222222222222222222222222222222222222222",
      ),
    ).toBe(false);
    expect((await verifyAnchorOnChain(anchor, CONTRACT, chain, async () => null)).ok).toBe(false);
  });
});

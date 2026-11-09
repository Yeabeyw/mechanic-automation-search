import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link2, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getLedgerBlocks,
  getLedgerBlocksForRecord,
  verifyLedgerRecord,
} from "@/lib/firebase-data";
import { anchorFor, useAnchors } from "@/lib/anchor";
import { verifyChain, short, type LedgerBlock, type RecordSnapshot } from "@/lib/ledger";

/** Shows the Firestore hash-chain proof for one record and verifies its current fingerprint. */
export function LedgerProof({ recordRef, snapshot }: { recordRef: string; snapshot: RecordSnapshot }) {
  const [result, setResult] = useState<null | { ok: boolean; message: string }>(null);
  const [busy, setBusy] = useState(false);
  const { data: anchorStore } = useAnchors();
  const { data: blocks, error, isLoading } = useQuery({
    queryKey: ["ledger-ref", recordRef],
    queryFn: () => getLedgerBlocksForRecord(recordRef),
  });
  const availableBlocks = blocks ?? [];
  const latest = availableBlocks.at(-1);
  if (isLoading) return null;
  if (error) return <p className="text-xs text-destructive">Ledger proof could not be loaded: {error.message}</p>;
  if (!latest) return <p className="text-xs text-muted-foreground">No ledger proof is available for this record yet.</p>;
  const latestBlock = latest;

  async function check() {
    setBusy(true);
    setResult(null);
    try {
      const all = (await getLedgerBlocks()).filter(
        (block) => block.block_index <= latestBlock.block_index,
      );

      const chainChecks = await verifyChain(all);
      const chainOk = all.length > 0 && chainChecks.length === all.length && chainChecks.every((item) => item.ok);
      const { ok: recordOk } = await verifyLedgerRecord(recordRef, snapshot.type);
      setResult({
        ok: chainOk && recordOk,
        message: !chainOk
          ? "Ledger chain verification failed."
          : recordOk
            ? `Current record fingerprint matches the simulated proof ${short(latestBlock.record_hash ?? "")}.`
            : "Current record differs from its latest fingerprint, or its proof is missing.",
      });
    } catch (verificationError) {
      setResult({
        ok: false,
        message: verificationError instanceof Error ? `Verification failed: ${verificationError.message}` : "Verification failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="size-4 text-primary" />
        <span className="font-semibold">
          {snapshot.type === "mechanic" ? "Mechanic verification" : "Request history"} proof · Hash-chain
          {" · "}{availableBlocks.length} event{availableBlocks.length > 1 ? "s" : ""}
        </span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">
          {anchorFor(latestBlock.block_index, anchorStore) ? "Anchored on Ethereum Sepolia" : "Not yet anchored on-chain"}
        </span>
        <span className="font-mono text-muted-foreground">#{latestBlock.block_index} · {short(latestBlock.record_hash ?? latestBlock.data_hash, 10)}</span>
        <button onClick={check} disabled={busy} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />} Verify integrity
        </button>
      </div>
      {result !== null && (
        <p className={`mt-2 flex items-center gap-1 font-medium ${result.ok ? "text-success" : "text-destructive"}`}>
          {result.ok ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
          {result.message}
        </p>
      )}
      <p className="mt-1 text-muted-foreground">
        Network: {latestBlock.network}. Personal and vehicle details remain off-ledger.{" "}
        <Link to="/ledger" className="font-medium text-primary underline">Open ledger explorer</Link>
      </p>
    </div>
  );
}

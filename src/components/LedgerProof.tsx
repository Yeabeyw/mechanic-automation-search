import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link2, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  verifyChain,
  verifyRecordSnapshot,
  short,
  type LedgerBlock,
  type RecordSnapshot,
} from "@/lib/ledger";

/** Shows the simulated ledger proof for one record and verifies its current fingerprint. */
export function LedgerProof({ recordRef, snapshot }: { recordRef: string; snapshot: RecordSnapshot }) {
  const [result, setResult] = useState<null | { ok: boolean; message: string }>(null);
  const [busy, setBusy] = useState(false);
  const { data: blocks, error, isLoading } = useQuery({
    queryKey: ["ledger-ref", recordRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_blocks")
        .select("*")
        .eq("record_ref", recordRef)
        .order("block_index", { ascending: true });
      if (error) throw error;
      return data as LedgerBlock[];
    },
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
      const all: LedgerBlock[] = [];
      const pageSize = 500;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("ledger_blocks")
          .select("*")
          .lte("block_index", latestBlock.block_index)
          .order("block_index", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data as LedgerBlock[]));
        if (data.length < pageSize) break;
      }

      const chainChecks = await verifyChain(all);
      const chainOk = all.length > 0 && chainChecks.length === all.length && chainChecks.every((item) => item.ok);
      const recordBlocks = all.filter((block) => block.record_ref === recordRef);
      const { data: fingerprintSalt, error: fingerprintError } = await supabase.rpc(
        "ledger_fingerprint_salt",
        { _block_index: latestBlock.block_index },
      );
      if (fingerprintError) throw fingerprintError;
      if (!fingerprintSalt) throw new Error("Fingerprint salt is unavailable.");
      const recordOk = await verifyRecordSnapshot(recordBlocks, snapshot, fingerprintSalt);
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
          {snapshot.type === "mechanic" ? "Mechanic verification" : "Request history"} proof · Simulated
          {" · "}{availableBlocks.length} event{availableBlocks.length > 1 ? "s" : ""}
        </span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">
          Not a blockchain transaction
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

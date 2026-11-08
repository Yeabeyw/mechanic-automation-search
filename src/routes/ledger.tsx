import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2, Boxes, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyChain, verifyBlock, short, type LedgerBlock, type BlockCheck } from "@/lib/ledger";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger explorer — AutoHelp Lesotho" },
      { name: "description", content: "Public hash-chain ledger of mechanic verifications, job updates and reviews — verify integrity in your browser." },
      { property: "og:title", content: "Ledger explorer — AutoHelp Lesotho" },
      { property: "og:description", content: "Transparent, tamper-evident records for every AutoHelp job." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ledger,
});

function Ledger() {
  const [checks, setChecks] = useState<Record<number, BlockCheck> | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [tamper, setTamper] = useState<{ index: number; ok: boolean } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const { data: blocks, isLoading, error } = useQuery({
    queryKey: ["ledger"],
    queryFn: async () => {
      const all: LedgerBlock[] = [];
      const pageSize = 500;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("ledger_blocks")
          .select("*")
          .order("block_index", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data as LedgerBlock[]));
        if (data.length < pageSize) return all;
      }
    },
  });

  async function runVerify() {
    if (!blocks) return;
    setBusy(true);
    setChecks(null);
    setVerifyError(null);
    try {
      const res = await verifyChain(blocks);
      setChecks(Object.fromEntries(res.map((r) => [r.index, r])));
    } catch (verificationError) {
      setVerifyError(
        verificationError instanceof Error ? verificationError.message : "Ledger verification failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function simulateTamper() {
    if (!blocks || blocks.length < 2) return;
    const target = blocks[Math.min(1, blocks.length - 1)];
    if (!target) return;
    const forged: LedgerBlock = { ...target, payload: target.payload.replace(/"status": "[a-z_]+"/, '"status": "completed"').replace(/"rating": \d/, '"rating": 1') + " " };
    const prev = blocks.find((b) => b.block_index === target.block_index - 1) ?? null;
    const r = await verifyBlock(forged, prev);
    setTamper({ index: target.block_index, ok: r.ok });
  }

  const allOk =
    checks &&
    (blocks?.length ?? 0) > 0 &&
    Object.keys(checks).length === blocks?.length &&
    Object.values(checks).every((c) => c.ok);
  const byType = (blocks ?? []).reduce<Record<string, number>>((a, b) => ({ ...a, [b.event_type]: (a[b.event_type] ?? 0) + 1 }), {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold"><Boxes className="text-primary" /> Ledger explorer</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Selected mechanic and request fields are fingerprinted with SHA-256, then each proof is chained to the previous block.
            The ledger stores event metadata and fingerprints, never names, phones or descriptions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" onClick={simulateTamper}><FlaskConical /> Tamper test</Button>
          <Button variant="hero" onClick={runVerify} disabled={busy || isLoading || !!error}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify entire chain
          </Button>
        </div>
      </div>
      {error && <p className="mt-4 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">Ledger could not be loaded: {error.message}</p>}

      <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        Mode: <b>simulated ledger</b> (verifiable SHA-256 hash-chain held in the AutoHelp database). This is not a public-blockchain transaction; testnet anchoring requires a deployed contract, RPC endpoint and server-side wallet configuration.
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="glass rounded-2xl p-4"><p className="font-display text-3xl font-bold">{blocks?.length ?? 0}</p><p className="text-xs text-muted-foreground">Blocks</p></div>
        {Object.entries(byType).slice(0, 3).map(([k, v]) => (
          <div key={k} className="glass rounded-2xl p-4"><p className="font-display text-3xl font-bold">{v}</p><p className="truncate text-xs text-muted-foreground">{k}</p></div>
        ))}
      </div>

      {checks && (
        <p className={cn("mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium", allOk ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
          {allOk ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
          {allOk ? `All ${blocks?.length} blocks verified in your browser — data hashes, block hashes and links match.` : "Integrity failure detected in at least one block."}
        </p>
      )}
      {verifyError && <p className="mt-2 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{verifyError}</p>}
      {tamper && (
        <p className="mt-2 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">
          Tamper test: edited a copy of block #{tamper.index}'s payload in memory → verification {tamper.ok ? "passed (unexpected)" : "FAILED, as it should"}. The stored ledger is unchanged.
        </p>
      )}

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-muted-foreground">Loading blocks…</p>}
        {[...(blocks ?? [])].reverse().map((b) => {
          const c = checks?.[b.block_index];
          return (
            <button key={b.block_index} onClick={() => setOpen(open === b.block_index ? null : b.block_index)} className="glass block w-full rounded-xl p-4 text-left">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-xs">#{b.block_index}</span>
                <span className="font-semibold">{b.event_type}</span>
                <span className="font-mono text-xs text-muted-foreground">{b.record_ref}</span>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(b.ts * 1000).toLocaleString("en-ZA", { timeZone: "Africa/Maseru" })}</span>
                {c && (c.ok ? <ShieldCheck className="size-4 text-success" /> : <ShieldAlert className="size-4 text-destructive" />)}
              </div>
              <div className="mt-2 grid gap-1 font-mono text-[11px] text-muted-foreground md:grid-cols-2">
                <span>record fingerprint: {short(b.record_hash ?? b.data_hash, 14)}</span>
                <span>block hash: {short(b.block_hash, 14)}</span>
                <span>prev: {short(b.prev_hash, 14)}</span>
              </div>
              {open === b.block_index && (
                <div className="mt-3 space-y-1 break-all rounded-lg bg-background/60 p-3 font-mono text-[11px]">
                  <p><span className="text-muted-foreground">payload:</span> {b.payload}</p>
                  <p><span className="text-muted-foreground">event hash = sha256(metadata payload):</span> {b.data_hash}</p>
                  <p><span className="text-muted-foreground">record fingerprint:</span> {b.record_hash ?? "Legacy proof has no record fingerprint"}</p>
                  <p><span className="text-muted-foreground">block_hash = sha256(index|prev|data_hash|ts):</span> {b.block_hash}</p>
                  <p><span className="text-muted-foreground">prev_hash:</span> {b.prev_hash}</p>
                  <p><span className="text-muted-foreground">network:</span> {b.network}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

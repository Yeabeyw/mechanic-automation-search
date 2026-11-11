import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Boxes,
  FlaskConical,
  Link2,
  ExternalLink,
  Download,
  Search,
  ListTree,
  Layers,
} from "lucide-react";
import { getLedgerBlocks } from "@/lib/firebase-data";
import { verifyChain, verifyBlock, short, type LedgerBlock, type BlockCheck } from "@/lib/ledger";
import {
  anchorFor,
  useAnchors,
  verifyAnchorOnChain,
  EXPLORER_ADDRESS,
  EXPLORER_TX,
  type AnchorVerdict,
} from "@/lib/anchor";
import {
  BlockchainPanel,
  DemoBadge,
  EventBadge,
  Stars,
  TONE,
  formatTime,
  metaFor,
  networkLabel,
  payloadInfo,
} from "@/components/LedgerParts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "Ledger explorer — AutoHelp Lesotho" },
      {
        name: "description",
        content:
          "Public hash-chain ledger of mechanic verifications, job updates and reviews, with optional Ethereum Sepolia checkpoints.",
      },
      { property: "og:title", content: "Ledger explorer — AutoHelp Lesotho" },
      {
        property: "og:description",
        content: "Transparent, tamper-evident records for every AutoHelp job.",
      },
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
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"blocks" | "jobs">("blocks");
  const [kind, setKind] = useState<string | null>(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainVerdict, setChainVerdict] = useState<AnchorVerdict | null>(null);

  const { data: store } = useAnchors();
  const {
    data: blocks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ledger"],
    queryFn: getLedgerBlocks,
  });

  const latestAnchor = store?.anchors.at(-1) ?? null;

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
        verificationError instanceof Error
          ? verificationError.message
          : "Ledger verification failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runChainVerify() {
    if (!blocks || !store || !latestAnchor) return;
    setChainBusy(true);
    setChainVerdict(null);
    try {
      setChainVerdict(await verifyAnchorOnChain(latestAnchor, store.contract, blocks));
    } catch (e) {
      setChainVerdict({
        ok: false,
        message:
          e instanceof Error ? `On-chain check failed: ${e.message}` : "On-chain check failed.",
      });
    } finally {
      setChainBusy(false);
    }
  }

  async function simulateTamper() {
    if (!blocks || blocks.length < 2) return;
    const target = blocks[Math.min(1, blocks.length - 1)];
    if (!target) return;
    const forged: LedgerBlock = {
      ...target,
      payload:
        target.payload
          .replace(/"status":\s*"[a-z_]+"/, '"status":"completed"')
          .replace(/"rating":\s*\d/, '"rating":1') + " ",
    };
    const prev = blocks.find((b) => b.block_index === target.block_index - 1) ?? null;
    const r = await verifyBlock(forged, prev);
    setTamper({ index: target.block_index, ok: r.ok });
  }

  function exportProof() {
    const file = {
      exportedAt: new Date().toISOString(),
      anchors: store ?? null,
      blocks: blocks ?? [],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "autohelp-ledger-proof.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function showJobBlocks(ref: string) {
    setSearch(ref);
    setKind(null);
    setView("blocks");
  }

  const allOk =
    checks &&
    (blocks?.length ?? 0) > 0 &&
    Object.keys(checks).length === blocks?.length &&
    Object.values(checks).every((c) => c.ok);

  const infos = useMemo(
    () => new Map((blocks ?? []).map((b) => [b.block_index, payloadInfo(b)])),
    [blocks],
  );
  const hasDemo = useMemo(() => [...infos.values()].some((i) => i.demo), [infos]);
  const byType = useMemo(
    () =>
      (blocks ?? []).reduce<Record<string, number>>(
        (acc, b) => ({ ...acc, [b.event_type]: (acc[b.event_type] ?? 0) + 1 }),
        {},
      ),
    [blocks],
  );
  const jobCount = new Set(
    (blocks ?? []).filter((b) => b.record_type === "service_request").map((b) => b.record_ref),
  ).size;
  const mechanicCount = new Set(
    (blocks ?? []).filter((b) => b.record_type === "mechanic").map((b) => b.record_ref),
  ).size;
  const anchoredCount = (blocks ?? []).filter((b) => anchorFor(b.block_index, store)).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...(blocks ?? [])].reverse();
    if (kind) list = list.filter((b) => b.event_type === kind);
    return q
      ? list.filter((b) =>
          `${b.record_ref} ${b.event_type} ${metaFor(b.event_type).label} ${b.block_index}`
            .toLowerCase()
            .includes(q),
        )
      : list;
  }, [blocks, search, kind]);

  const groups = useMemo(() => {
    const byRef = new Map<string, LedgerBlock[]>();
    for (const b of blocks ?? []) {
      const list = byRef.get(b.record_ref);
      if (list) list.push(b);
      else byRef.set(b.record_ref, [b]);
    }
    const q = search.trim().toLowerCase();
    return [...byRef.entries()]
      .map(([ref, list]) => ({
        ref,
        list: [...list].sort((a, b) => a.block_index - b.block_index),
      }))
      .filter((g) => !q || g.ref.toLowerCase().includes(q))
      .sort((a, b) => (b.list.at(-1)?.block_index ?? 0) - (a.list.at(-1)?.block_index ?? 0));
  }, [blocks, search]);

  const stat = "glass rounded-2xl p-4";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Boxes className="text-primary" /> Ledger explorer
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Selected mechanic and request fields are fingerprinted with SHA-256, then each proof is
            chained to the previous block. The ledger stores event metadata and fingerprints, never
            names, phones or descriptions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="glass" onClick={exportProof} disabled={!blocks}>
            <Download /> Export proof
          </Button>
          <Button variant="glass" onClick={simulateTamper}>
            <FlaskConical /> Tamper test
          </Button>
          <Button variant="hero" onClick={runVerify} disabled={busy || isLoading || !!error}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify entire chain
          </Button>
        </div>
      </div>
      {blocks && blocks.length > 0 && <BlockchainPanel blocks={blocks} store={store} />}
      {error && (
        <p className="mt-4 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">
          Ledger could not be loaded: {error.message}
        </p>
      )}

      {latestAnchor && store ? (
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className="size-4 text-primary" />
            <b>Public blockchain anchor — {store.network}</b>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {store.anchors.length} checkpoint{store.anchors.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The hash of block #{latestAnchor.checkpointIndex} was published to the AutoHelpAnchor
            smart contract. Because every block links to the previous one, this single hash commits
            to the entire history up to that block. Editing the database afterwards would no longer
            match the public chain.
          </p>
          <div className="mt-2 grid gap-1 break-all font-mono text-[11px] md:grid-cols-2">
            <span>
              contract:{" "}
              <a
                className="text-primary underline"
                href={EXPLORER_ADDRESS + store.contract}
                target="_blank"
                rel="noreferrer"
              >
                {store.contract}
              </a>
            </span>
            <span>
              latest tx:{" "}
              <a
                className="text-primary underline"
                href={EXPLORER_TX + latestAnchor.txHash}
                target="_blank"
                rel="noreferrer"
              >
                {short(latestAnchor.txHash, 12)} <ExternalLink className="inline size-3" />
              </a>
            </span>
            <span>anchored block hash: {short(latestAnchor.blockHash, 14)}</span>
            <span>chain block: {latestAnchor.chainBlock}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="hero"
              size="sm"
              onClick={runChainVerify}
              disabled={chainBusy || isLoading || !!error}
            >
              {chainBusy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify against
              Sepolia
            </Button>
            {chainVerdict && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  chainVerdict.ok ? "text-success" : "text-destructive",
                )}
              >
                {chainVerdict.ok ? (
                  <ShieldCheck className="size-3" />
                ) : (
                  <ShieldAlert className="size-3" />
                )}{" "}
                {chainVerdict.message}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          Mode: <b>hash-chain ledger</b> (verifiable SHA-256 hash-chain held in the AutoHelp
          database). No checkpoint has been anchored to a public blockchain yet.
        </div>
      )}

      {hasDemo && (
        <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          Blocks tagged <DemoBadge /> were written by a seeding script to demonstrate a complete job
          lifecycle. They are genuine, verifiable ledger entries, but they were not created by real
          customers.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={stat}>
          <p className="font-display text-3xl font-bold">{blocks?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">Blocks in the chain</p>
        </div>
        <div className={stat}>
          <p className="font-display text-3xl font-bold">{jobCount}</p>
          <p className="text-xs text-muted-foreground">Jobs tracked</p>
        </div>
        <div className={stat}>
          <p className="font-display text-3xl font-bold">{mechanicCount}</p>
          <p className="text-xs text-muted-foreground">Mechanics recorded</p>
        </div>
        <div className={stat}>
          <p className="font-display text-3xl font-bold">
            {anchoredCount}
            <span className="text-lg text-muted-foreground">/{blocks?.length ?? 0}</span>
          </p>
          <p className="text-xs text-muted-foreground">Blocks covered by Sepolia</p>
        </div>
      </div>

      {checks && (
        <p
          className={cn(
            "mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium",
            allOk ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          {allOk ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
          {allOk
            ? `All ${blocks?.length} blocks verified in your browser — data hashes, block hashes and links match.`
            : "Integrity failure detected in at least one block."}
        </p>
      )}
      {verifyError && (
        <p className="mt-2 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">
          {verifyError}
        </p>
      )}
      {tamper && (
        <p className="mt-2 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">
          Tamper test: edited a copy of block #{tamper.index}'s payload in memory → verification{" "}
          {tamper.ok ? "passed (unexpected)" : "FAILED, as it should"}. The stored ledger is
          unchanged.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference (e.g. LS-DEMOREQ1), event or block number"
            aria-label="Search the ledger"
            className="w-full rounded-xl border border-border bg-background/60 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div
          role="group"
          aria-label="Ledger view"
          className="flex rounded-xl border border-border bg-background/60 p-1 text-sm"
        >
          <button
            type="button"
            aria-pressed={view === "blocks"}
            onClick={() => setView("blocks")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5",
              view === "blocks" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Layers className="size-4" /> All blocks
          </button>
          <button
            type="button"
            aria-pressed={view === "jobs"}
            onClick={() => setView("jobs")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5",
              view === "jobs" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <ListTree className="size-4" /> Job timelines
          </button>
        </div>
      </div>

      {view === "blocks" && Object.keys(byType).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by event">
          <button
            type="button"
            aria-pressed={kind === null}
            onClick={() => setKind(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              kind === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            All ({blocks?.length ?? 0})
          </button>
          {Object.entries(byType).map(([type, count]) => (
            <button
              key={type}
              type="button"
              aria-pressed={kind === type}
              onClick={() => setKind(kind === type ? null : type)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                kind === type
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {metaFor(type).label} ({count})
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="mt-4 text-muted-foreground">Loading blocks…</p>}

      {view === "blocks" && (
        <div className="mt-4 space-y-2">
          {!isLoading && visible.length === 0 && (
            <p className="text-sm text-muted-foreground">No blocks match your search.</p>
          )}
          {visible.map((b) => {
            const c = checks?.[b.block_index];
            const anchor = anchorFor(b.block_index, store);
            const info = infos.get(b.block_index);
            return (
              <button
                key={b.block_index}
                onClick={() => setOpen(open === b.block_index ? null : b.block_index)}
                className="glass block w-full rounded-xl p-4 text-left"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-xs">
                    #{b.block_index}
                  </span>
                  <EventBadge type={b.event_type} />
                  <span className="font-mono text-xs text-muted-foreground">{b.record_ref}</span>
                  {info?.demo && <DemoBadge />}
                  {info?.rating != null && <Stars value={info.rating} />}
                  {anchor && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Anchored · Sepolia
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{formatTime(b.ts)}</span>
                  {c &&
                    (c.ok ? (
                      <ShieldCheck className="size-4 text-success" />
                    ) : (
                      <ShieldAlert className="size-4 text-destructive" />
                    ))}
                </div>
                <div className="mt-2 grid gap-1 font-mono text-[11px] text-muted-foreground md:grid-cols-2">
                  <span>record fingerprint: {short(b.record_hash ?? b.data_hash, 14)}</span>
                  <span>block hash: {short(b.block_hash, 14)}</span>
                  <span>prev: {short(b.prev_hash, 14)}</span>
                  {anchor && <span>covered by tx: {short(anchor.txHash, 12)}</span>}
                </div>
                {open === b.block_index && (
                  <div className="mt-3 space-y-1 break-all rounded-lg bg-background/60 p-3 font-mono text-[11px]">
                    <p>
                      <span className="text-muted-foreground">event type:</span> {b.event_type}
                    </p>
                    <p>
                      <span className="text-muted-foreground">payload:</span> {b.payload}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        event hash = sha256(metadata payload):
                      </span>{" "}
                      {b.data_hash}
                    </p>
                    <p>
                      <span className="text-muted-foreground">record fingerprint:</span>{" "}
                      {b.record_hash ?? "Legacy proof has no record fingerprint"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        block_hash = sha256(index|prev|data_hash|ts):
                      </span>{" "}
                      {b.block_hash}
                    </p>
                    <p>
                      <span className="text-muted-foreground">prev_hash:</span> {b.prev_hash}
                    </p>
                    <p>
                      <span className="text-muted-foreground">network:</span>{" "}
                      {networkLabel(b, store, anchor !== null)}
                    </p>
                    {anchor && (
                      <p>
                        <span className="text-muted-foreground">public transaction:</span>{" "}
                        <a
                          className="text-primary underline"
                          href={EXPLORER_TX + anchor.txHash}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {anchor.txHash}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {view === "jobs" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {!isLoading && groups.length === 0 && (
            <p className="text-sm text-muted-foreground">No records match your search.</p>
          )}
          {groups.map((g) => {
            const first = g.list[0];
            const last = g.list.at(-1);
            const isJob = g.list.some((b) => b.record_type === "service_request");
            const demo = g.list.some((b) => infos.get(b.block_index)?.demo);
            return (
              <section
                key={g.ref}
                className="glass rounded-2xl p-4"
                aria-label={`Timeline ${g.ref}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{g.ref}</span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {isJob ? "Job" : "Mechanic"}
                  </span>
                  {demo && <DemoBadge />}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {g.list.length} block{g.list.length > 1 ? "s" : ""}
                  </span>
                </div>
                {last && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    Current stage: <EventBadge type={last.event_type} />
                  </p>
                )}
                <ol className="mt-3 space-y-3 border-l border-border pl-4">
                  {g.list.map((b) => {
                    const { Icon, tone, label } = metaFor(b.event_type);
                    const anchor = anchorFor(b.block_index, store);
                    const info = infos.get(b.block_index);
                    return (
                      <li key={b.block_index} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[1.55rem] top-0 grid size-5 place-items-center rounded-full",
                            TONE[tone],
                          )}
                        >
                          <Icon className="size-3" />
                        </span>
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {label}
                          {info?.rating != null && <Stars value={info.rating} />}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          #{b.block_index} · {formatTime(b.ts)}
                          {anchor ? " · anchored" : ""}
                        </p>
                      </li>
                    );
                  })}
                </ol>
                {first && (
                  <Button
                    variant="glass"
                    size="sm"
                    className="mt-3"
                    onClick={() => showJobBlocks(g.ref)}
                  >
                    <Layers /> View its blocks
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

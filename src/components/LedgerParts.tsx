import { Fragment, type ComponentType } from "react";
import {
  ShieldCheck,
  Link2,
  Network,
  Eye,
  Send,
  UserCheck,
  Hammer,
  CheckCircle2,
  Star,
  Undo2,
  BadgeCheck,
  ClipboardList,
} from "lucide-react";
import { anchorFor, type AnchorStore } from "@/lib/anchor";
import { short, type LedgerBlock } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export type Tone = "primary" | "success" | "warning" | "muted" | "destructive";
export type EventMeta = { label: string; tone: Tone; Icon: ComponentType<{ className?: string }> };

const EVENT_META: Record<string, EventMeta> = {
  MECHANIC_APPLIED: { label: "Mechanic applied", tone: "muted", Icon: ClipboardList },
  MECHANIC_VERIFIED: { label: "Mechanic verified", tone: "success", Icon: BadgeCheck },
  REQUEST_SENT: { label: "Request sent", tone: "primary", Icon: Send },
  REQUEST_ACCEPTED: { label: "Accepted by mechanic", tone: "primary", Icon: UserCheck },
  REQUEST_IN_PROGRESS: { label: "Work in progress", tone: "warning", Icon: Hammer },
  REQUEST_COMPLETED: { label: "Job completed", tone: "success", Icon: CheckCircle2 },
  REQUEST_DECLINED_AND_RETURNED_TO_POOL: {
    label: "Declined · returned to pool",
    tone: "warning",
    Icon: Undo2,
  },
  REVIEW_SUBMITTED: { label: "Review submitted", tone: "success", Icon: Star },
};

export const TONE: Record<Tone, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  muted: "bg-accent text-foreground",
  destructive: "bg-destructive/15 text-destructive",
};

export function metaFor(type: string): EventMeta {
  const known = EVENT_META[type];
  if (known) return known;
  const label = type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { label, tone: "muted", Icon: ClipboardList };
}

export function payloadInfo(block: LedgerBlock): { demo: boolean; rating: number | null } {
  try {
    const parsed: unknown = JSON.parse(block.payload);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const data = parsed as Record<string, unknown>;
      const rating = data["rating"];
      return { demo: data["demo"] === true, rating: typeof rating === "number" ? rating : null };
    }
  } catch {
    /* payload is not JSON */
  }
  return { demo: false, rating: null };
}

export function EventBadge({ type }: { type: string }) {
  const { label, tone, Icon } = metaFor(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[tone],
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
      Demo
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-warning"
      aria-label={`${value} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-3", i < value ? "fill-current" : "opacity-30")} />
      ))}
    </span>
  );
}

export function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleString("en-ZA", { timeZone: "Africa/Maseru" });
}

export function networkLabel(
  block: LedgerBlock,
  store: AnchorStore | null | undefined,
  anchored: boolean,
) {
  return anchored && store
    ? `Hash-chain ledger \u2192 anchored on ${store.network}`
    : `${block.network} \u2014 not yet anchored on a public blockchain`;
}

function ChainStrip({
  blocks,
  store,
}: {
  blocks: LedgerBlock[];
  store: AnchorStore | null | undefined;
}) {
  const recent = blocks.slice(-8);
  const checkpoints = new Set((store?.anchors ?? []).map((a) => a.checkpointIndex));
  return (
    <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Latest blocks &mdash; every block stores the hash of the block before it
      </p>
      <div className="mt-2 flex items-stretch gap-1 overflow-x-auto pb-1">
        {recent.map((b, i) => {
          const onChain = checkpoints.has(b.block_index);
          const covered = !onChain && anchorFor(b.block_index, store) !== null;
          return (
            <Fragment key={b.block_index}>
              {i > 0 && <Link2 className="size-4 shrink-0 self-center text-primary" aria-hidden />}
              <div
                className={cn(
                  "min-w-[8.5rem] shrink-0 rounded-lg border p-2 font-mono text-[10px]",
                  onChain ? "border-primary bg-primary/10" : "border-border bg-background/60",
                )}
              >
                <p className="text-xs font-semibold">Block #{b.block_index}</p>
                <p className="text-muted-foreground">hash {short(b.block_hash, 6)}</p>
                <p className="text-muted-foreground">prev {short(b.prev_hash, 6)}</p>
                <p className={onChain ? "font-semibold text-primary" : "text-muted-foreground"}>
                  {onChain
                    ? "On-chain checkpoint"
                    : covered
                      ? "Covered by checkpoint"
                      : "Not anchored"}
                </p>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function BlockchainPanel({
  blocks,
  store,
}: {
  blocks: LedgerBlock[];
  store: AnchorStore | null | undefined;
}) {
  const latest = store?.anchors.at(-1) ?? null;
  const pillars = [
    {
      Icon: Network,
      title: "Distributed processing",
      body: "Checkpoints are transactions on a public blockchain, processed and stored by many independent nodes, not only by the AutoHelp database.",
      proof:
        latest && store
          ? `${store.anchors.length} checkpoint(s) on ${store.network}`
          : "No checkpoint anchored yet",
    },
    {
      Icon: Eye,
      title: "Transparency",
      body: "The whole ledger is publicly readable on this page, and the smart contract and every transaction can be inspected on Etherscan without logging in.",
      proof: `${blocks.length} public blocks \u00b7 contract and transactions linked below`,
    },
    {
      Icon: ShieldCheck,
      title: "Integrity",
      body: "Each block contains the previous block's SHA-256 hash and the head hash is written on-chain. Changing any record breaks the chain and no longer matches the blockchain.",
      proof: latest
        ? `Block #${latest.checkpointIndex} hash is fixed on-chain`
        : "Verify with the chain check below",
    },
  ];
  return (
    <section
      aria-label="Blockchain at a glance"
      className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-4"
    >
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        <Link2 className="size-5 text-primary" /> Blockchain at a glance
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {store ? `${store.network} \u00b7 Proof-of-Stake` : "Hash-chain only"}
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        AutoHelp records mechanic verifications, job updates and reviews on a blockchain-secured
        ledger. Only fingerprints are stored &mdash; never names, phone numbers or descriptions.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {pillars.map(({ Icon, title, body, proof }) => (
          <div key={title} className="rounded-xl bg-background/60 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-4 text-primary" /> {title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            <p className="mt-2 text-xs font-medium text-primary">{proof}</p>
          </div>
        ))}
      </div>
      <ChainStrip blocks={blocks} store={store} />
    </section>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LedgerBlock } from "@/lib/ledger";

export const Route = createFileRoute("/project")({
  head: () => ({
    meta: [
      { title: "BIDT3110 assignment evidence — AutoHelp Lesotho" },
      { name: "description", content: "Assignment evidence: software, blockchain design, and progress for parts C and D." },
      { property: "og:title", content: "BIDT3110 assignment evidence — AutoHelp Lesotho" },
      { property: "og:description", content: "How AutoHelp Lesotho meets the group assignment brief." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Project,
});

const onChain = ["Record reference and event type", "SHA-256 event fingerprint", "Status and minimal event metadata", "Timestamp"];
const offChain = ["Customer name & email", "Phone numbers", "Vehicle make/model/year", "Free-text descriptions", "Review comments", "Passwords & sessions"];

function Project() {
  const { data: samples, error: sampleError } = useQuery({
    queryKey: ["project-ledger-samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_blocks")
        .select("*")
        .order("block_index", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data as LedgerBlock[];
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Assignment evidence</h1>
        <p className="mt-1 text-muted-foreground">BIDT3110 — Using AI, Cybersecurity and Blockchain to enhance digital solutions. Context: Lesotho.</p>
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-xl font-semibold">Part A — Software development [5]</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <Item done>Customer journey: problem → find mechanic → profile → request → status timeline → review</Item>
          <Item done>Mechanic workspace: apply, availability, accept/decline, start, complete</Item>
          <Item done>Admin: verify mechanics, oversee requests</Item>
          <Item done>Secure database with per-role access rules, email + Google sign-in</Item>
          <Item>Publish to a public URL (pending — click Publish)</Item>
        </ul>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-xl font-semibold">Part B — Blockchain [20]</h2>
        <p className="mt-2 text-sm text-muted-foreground">Current demo mode is a simulated, database-backed SHA-256 hash chain. Database triggers append proofs when a mechanic is verified, a request is created or changes status, and a review is submitted. The app does not currently submit public-network transactions.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-background/60 p-3 font-mono text-xs">{`data_hash  = SHA256(payload)
block_hash = SHA256(index | prev_hash | data_hash | timestamp)
prev_hash  = block_hash of block (index − 1)   // genesis = 0×64`}</pre>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><h3 className="font-semibold text-success">On the ledger</h3><ul className="mt-1 list-disc pl-5 text-sm">{onChain.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3 className="font-semibold text-destructive">Kept off the ledger (GDPR Art. 17)</h3><ul className="mt-1 list-disc pl-5 text-sm">{offChain.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
        <ul className="mt-4 space-y-1 text-sm">
          <Item done>Transparency and integrity: <Link to="/ledger" className="text-primary underline">ledger explorer</Link>, record checks, whole-chain verification, and a tamper test</Item>
          <Item done>Automatic simulated proofs for mechanic verification, requests/statuses, job completion, and review submission</Item>
          <Item done>Solidity event contract source: <code>contracts/AutoHelpLedger.sol</code> — deployment is not configured</Item>
          <Item>Public distributed ledger, consensus finality, and explorer transaction links require a deployed contract and funded test wallet</Item>
        </ul>
        <div className="mt-4 grid gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm md:grid-cols-2">
          <p><b>Network:</b> Simulation only. Contract address: <b>Not deployed.</b> Transaction hashes: none.</p>
          <p><b>Future test network:</b> Sepolia or Polygon Amoy (Proof-of-Stake). No wallet secret is stored in this app.</p>
        </div>
        <div className="mt-5">
          <h3 className="font-semibold">Data flow</h3>
          <ol className="mt-2 grid gap-2 text-center text-xs md:grid-cols-5">
            {["Customer / mechanic action", "Database validates role and transition", "Trigger builds minimal event payload and SHA-256 hash", "Simulation stores proof; future relay calls recordEvent", "Admin or customer verifies proof"].map((step, index) => (
              <li key={step} className="rounded-lg bg-background/60 p-3">{index + 1}. {step}</li>
            ))}
          </ol>
        </div>
        <div className="mt-5">
          <h3 className="font-semibold">Sample proof fingerprints (hash-chain records, not transaction hashes)</h3>
          {sampleError && <p className="mt-2 text-sm text-destructive">Sample proofs could not be loaded: {sampleError.message}</p>}
          <div className="mt-2 space-y-2 font-mono text-xs">
            {(samples ?? []).map((block) => (
              <p key={block.block_index} className="break-all rounded-lg bg-background/60 p-3">
                #{block.block_index} {block.event_type} · {block.network} · data hash {block.data_hash}
              </p>
            ))}
            {samples?.length === 0 && <p className="text-muted-foreground">No sample proof records are available.</p>}
          </div>
        </div>
        <div className="mt-5">
          <h3 className="font-semibold">Blockchain concepts and trade-offs</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Supply-chain provenance: a repair job is tracked from request through status changes, completion, and review.</li>
            <li>Trust and disintermediation: a public chain could let customers verify records without relying only on AutoHelp’s database; current simulation does not provide that independent trust.</li>
            <li>Consensus and immutability: a future testnet deployment would make accepted event logs tamper-evident across network participants; emitted records prove what was submitted, not that the source claim was true.</li>
            <li>Scalability: anchor only key events and fingerprints, not every edit or bulky record.</li>
            <li>Energy: use a Proof-of-Stake test network such as Sepolia or Polygon Amoy, not Proof-of-Work.</li>
            <li>Privacy and regulation: keep personal data off-chain; immutable public data can conflict with erasure rights.</li>
            <li>DeFi and tokenization were considered and are out of scope; this project has no tokens or online payments.</li>
          </ul>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-xl font-semibold">Parts C & D — next</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <Item>Data classification & GDPR spreadsheets</Item>
          <Item>Separate-domain security configuration module</Item>
          <Item>Dataset, model training, accuracy & saturation dashboards</Item>
        </ul>
      </section>
    </div>
  );
}

function Item({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span>{children}</span>
    </li>
  );
}

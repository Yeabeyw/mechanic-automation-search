import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  getAdminRequests,
  getLedgerBlocks,
  getMechanicsForAdmin,
  verifyMechanic,
} from "@/lib/firebase-data";
import { useAuth } from "@/lib/auth";
import { STATUS_LABEL, type Mechanic } from "@/lib/mechanics";
import { DemoTag } from "@/components/MechanicBits";
import { Button } from "@/components/ui/button";
import { verifyChain } from "@/lib/ledger";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — AutoHelp Lesotho" },
      { name: "description", content: "Verify mechanics and oversee requests." },
      { property: "og:title", content: "Admin — AutoHelp Lesotho" },
      { property: "og:description", content: "Mechanic verification and platform oversight." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { hasRole, loading, user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole("admin");
  const { data: mechs } = useQuery({
    queryKey: ["admin-mechanics"],
    enabled: isAdmin,
    queryFn: getMechanicsForAdmin,
  });
  const { data: reqs } = useQuery({
    queryKey: ["admin-requests"],
    enabled: isAdmin,
    queryFn: getAdminRequests,
  });
  const { data: audit, error: auditError } = useQuery({
    queryKey: ["admin-ledger-audit"],
    enabled: isAdmin,
    queryFn: async () => {
      const all = await getLedgerBlocks();
      const checks = await verifyChain(all);
      return all.map((block, index) => ({ block, valid: checks[index]?.ok === true }));
    },
  });

  if (loading) return null;
  if (!user || !isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Administrators only</h1>
        <p className="mt-2 text-muted-foreground">Your account doesn't have the admin role.</p>
        <Button asChild variant="glass" className="mt-6"><Link to="/">Go home</Link></Button>
      </div>
    );

  async function verify(m: Mechanic) {
    try {
      await verifyMechanic(m.id);
      toast.success(`${m.name} verified — proof added to the Firebase ledger`);
      qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify this mechanic.");
    }
  }

  const pending = (mechs ?? []).filter((m) => !m.verified);
  const counts = (reqs ?? []).reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Admin</h1>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Mechanics" value={mechs?.length ?? 0} />
        <Kpi label="Pending verification" value={pending.length} />
        <Kpi label="Requests (latest 50)" value={reqs?.length ?? 0} />
        <Kpi label="Completed" value={counts["completed"] ?? 0} />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Pending verification</h2>
      <div className="mt-3 space-y-2">
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
        {pending.map((m) => (
          <div key={m.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
            <div><p className="font-semibold">{m.name} · {m.workshop}</p><p className="text-xs text-muted-foreground">{m.code} · {m.town} · {m.specialties.join(", ")}</p></div>
            <Button variant="hero" size="sm" onClick={() => verify(m)}>Verify</Button>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">All mechanics</h2>
      <div className="glass mt-3 overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-3">Code</th><th>Name</th><th>Town</th><th>Status</th><th>Jobs</th></tr></thead>
          <tbody>
            {(mechs ?? []).map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{m.code}</td>
                <td className="flex items-center gap-2 py-3">{m.name} {m.is_demo && <DemoTag />}</td>
                <td>{m.town}</td>
                <td>{m.verified ? "Verified" : "Pending"}</td>
                <td>{m.jobs_completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Recent requests</h2>
      <div className="mt-3 space-y-2">
        {(reqs ?? []).map((r) => (
          <div key={r.id} className="glass flex justify-between rounded-xl p-3 text-sm">
            <span><span className="font-mono text-xs text-muted-foreground">{r.ref}</span> · {r.category} · {r.mechanics?.name}</span>
            <span>{STATUS_LABEL[r.status]}</span>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Ledger proofs — audit</h2>
            <p className="text-xs text-muted-foreground">Current entries are simulated hash-chain records, not public blockchain transactions.</p>
          </div>
          <Button asChild variant="glass" size="sm"><Link to="/ledger">Open ledger explorer <ExternalLink className="ml-1 size-3" /></Link></Button>
        </div>
        {auditError && <p className="mt-3 text-sm text-destructive">Audit records could not be loaded: {auditError.message}</p>}
        <div className="glass mt-3 overflow-x-auto rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr>
              <th className="p-3">Event type</th><th>Record</th><th>Time (Lesotho)</th><th>Record fingerprint</th><th>Transaction hash</th><th>Network</th><th>Status</th>
            </tr></thead>
            <tbody>
              {[...(audit ?? [])].reverse().map(({ block, valid }) => (
                <tr key={block.block_index} className="border-t border-border">
                  <td className="p-3 font-semibold">{block.event_type}</td>
                  <td className="font-mono">{block.record_ref}</td>
                  <td>{new Date(block.ts * 1000).toLocaleString("en-ZA", { timeZone: "Africa/Maseru" })}</td>
                  <td className="font-mono">{block.record_hash?.slice(0, 10) ?? "—"}{block.record_hash ? "…" : ""}</td>
                  <td className="text-muted-foreground">Not submitted (simulation)</td>
                  <td>{block.network}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 ${valid ? "text-warning" : "text-destructive"}`}>
                      {valid ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
                      {valid ? "Simulated" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
              {audit?.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={7}>No proof records.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="font-display text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

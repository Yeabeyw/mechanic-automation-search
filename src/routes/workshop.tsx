import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, STATUS_LABEL, type Mechanic, type RequestStatus } from "@/lib/mechanics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workshop")({
  head: () => ({
    meta: [
      { title: "Mechanic workspace — AutoHelp Lesotho" },
      { name: "description", content: "Manage availability, accept requests and complete jobs." },
      { property: "og:title", content: "Mechanic workspace — AutoHelp Lesotho" },
      { property: "og:description", content: "Run your workshop's AutoHelp requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workshop,
});

const NEXT: Partial<Record<RequestStatus, { to: RequestStatus; label: string }[]>> = {
  sent: [{ to: "accepted", label: "Accept" }, { to: "declined", label: "Decline" }],
  accepted: [{ to: "in_progress", label: "Start job" }],
  in_progress: [{ to: "completed", label: "Mark completed" }],
};

function Workshop() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ["my-mechanic", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("mechanics").select("*").eq("user_id", user!.id).maybeSingle()).data as Mechanic | null,
  });
  const { data: jobs } = useQuery({
    queryKey: ["my-jobs", me?.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("service_requests").select("*").eq("mechanic_id", me!.id).order("created_at", { ascending: false })).data ?? [],
  });

  if (!loading && !user)
    return <Gate />;
  if (isLoading || loading) return <div className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">Loading…</div>;
  if (!me) return <Apply />;

  async function setAvail(v: boolean) {
    const { error } = await supabase.from("mechanics").update({ available: v }).eq("id", me!.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-mechanic"] });
  }
  async function move(id: string, to: RequestStatus) {
    const { error } = await supabase.from("service_requests").update({ status: to }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status → ${STATUS_LABEL[to]} — proof added to the simulated ledger`);
    qc.invalidateQueries();
  }

  const groups: { title: string; filter: (s: RequestStatus) => boolean }[] = [
    { title: "New requests", filter: (s) => s === "sent" },
    { title: "Active jobs", filter: (s) => s === "accepted" || s === "in_progress" },
    { title: "History", filter: (s) => ["completed", "declined", "cancelled"].includes(s) },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{me.code}</p>
          <h1 className="text-3xl font-bold">{me.workshop}</h1>
          <p className="text-sm text-muted-foreground">{me.verified ? "✓ Verified — visible to customers" : "Waiting for admin verification — not yet visible to customers"}</p>
        </div>
        <label className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm">
          Available now <Switch checked={me.available} onCheckedChange={setAvail} />
        </label>
      </div>
      {groups.map((g) => {
        const list = (jobs ?? []).filter((j) => g.filter(j.status));
        return (
          <section key={g.title} className="mt-8">
            <h2 className="text-lg font-semibold">{g.title} <span className="text-muted-foreground">({list.length})</span></h2>
            <div className="mt-3 space-y-3">
              {list.map((j) => (
                <div key={j.id} className="glass rounded-2xl p-4">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{j.ref}</p>
                      <p className="font-semibold">{j.category} · {j.vehicle_make} {j.vehicle_model} {j.vehicle_year ?? ""}</p>
                    </div>
                    <span className="h-fit rounded-full bg-accent px-2 py-0.5 text-xs">{STATUS_LABEL[j.status]}</span>
                  </div>
                  <p className="mt-2 text-sm">{j.description}</p>
                  {j.contact_phone && j.status !== "sent" && <p className="mt-1 text-sm text-primary">📞 <a href={`tel:${j.contact_phone}`}>{j.contact_phone}</a></p>}
                  <div className="mt-3 flex gap-2">
                    {(NEXT[j.status] ?? []).map((n) => (
                      <Button key={n.to} size="sm" variant={n.to === "declined" ? "glass" : "hero"} onClick={() => move(j.id, n.to)}>{n.label}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Gate() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Mechanic workspace</h1>
      <p className="mt-2 text-muted-foreground">Sign in to manage your workshop or apply to join.</p>
      <Button asChild variant="hero" size="xl" className="mt-6"><Link to="/auth">Sign in</Link></Button>
    </div>
  );
}

function Apply() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", workshop: "", town: "", years: "3", bio: "" });
  const [spec, setSpec] = useState<string[]>([]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.workshop || !f.town || spec.length === 0) { toast.error("Fill in all fields and pick at least one specialty."); return; }
    const { error } = await supabase.from("mechanics").insert({
      user_id: user!.id, name: f.name.slice(0, 80), workshop: f.workshop.slice(0, 80), town: f.town.slice(0, 80),
      experience_years: Number(f.years) || 1, specialties: spec, bio: f.bio.slice(0, 300),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Application sent — an administrator will verify your workshop.");
    qc.invalidateQueries({ queryKey: ["my-mechanic"] });
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold">Join as a mechanic</h1>
      <p className="mt-1 text-muted-foreground">Tell us about your workshop. You'll appear to customers once verified.</p>
      <form onSubmit={submit} className="glass mt-5 space-y-4 rounded-2xl p-5">
        <div><Label>Your name</Label><Input className="mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Workshop name</Label><Input className="mt-1" value={f.workshop} onChange={(e) => setF({ ...f, workshop: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Town / area</Label><Input className="mt-1" placeholder="Maseru – Ha Abia" value={f.town} onChange={(e) => setF({ ...f, town: e.target.value })} /></div>
          <div><Label>Years of experience</Label><Input className="mt-1" type="number" min={0} max={50} value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })} /></div>
        </div>
        <div>
          <Label>Specialties</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setSpec(spec.includes(c) ? spec.filter((s) => s !== c) : [...spec, c])}
                className={cn("rounded-full border px-3 py-1 text-sm", spec.includes(c) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{c}</button>
            ))}
          </div>
        </div>
        <div><Label>Short bio</Label><Input className="mt-1" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <Button type="submit" variant="hero" size="xl" className="w-full">Submit application</Button>
      </form>
    </div>
  );
}

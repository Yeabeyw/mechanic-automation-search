import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getMechanicForUser,
  getMechanicRequests,
  setMechanicAvailability,
  submitMechanicApplication,
  updateServiceRequestStatus,
} from "@/lib/firebase-data";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, STATUS_LABEL, type RequestStatus } from "@/lib/mechanics";
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
  sent: [
    { to: "accepted", label: "Accept" },
    { to: "declined", label: "Decline" },
  ],
  accepted: [{ to: "in_progress", label: "Start job" }],
  in_progress: [{ to: "completed", label: "Mark completed" }],
};

function Workshop() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({
    queryKey: ["my-mechanic", user?.uid],
    enabled: !!user,
    queryFn: () => getMechanicForUser(user!.uid),
  });
  const {
    data: jobs,
    error: jobsError,
    isLoading: jobsLoading,
  } = useQuery({
    queryKey: ["my-jobs", me?.id],
    enabled: !!me?.verified,
    queryFn: () => getMechanicRequests(user!.uid),
  });

  if (!loading && !user) return <Gate />;
  if (isLoading || loading)
    return <div className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">Loading…</div>;
  if (!me) return <Apply />;
  if (!me.verified) {
    const suspended = me.status === "suspended";
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="glass space-y-3 rounded-2xl p-6">
          <h1 className="text-2xl font-bold">
            {suspended ? "Workshop suspended" : "Application pending"}
          </h1>
          <p className="text-muted-foreground">
            {suspended
              ? "Your listing and availability are disabled. Contact AutoHelp administration if this is unexpected."
              : "Your profile is under review. It will appear in the verified directory after an administrator approves it."}
          </p>
        </div>
      </div>
    );
  }

  async function setAvail(v: boolean) {
    try {
      await setMechanicAvailability(v);
      qc.invalidateQueries({ queryKey: ["my-mechanic"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update availability.");
    }
  }
  async function move(id: string, to: RequestStatus) {
    try {
      await updateServiceRequestStatus(id, to);
      toast.success(`Status → ${STATUS_LABEL[to]} — proof added to the Firebase ledger`);
      qc.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this request.");
    }
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
          <p className="text-sm text-muted-foreground">
            {me.verified
              ? "✓ Verified — visible to customers"
              : "Waiting for admin verification — not yet visible to customers"}
          </p>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Completed jobs" value={me.jobs_completed} />
          <Stat label="Rating" value={Number(me.rating).toFixed(1)} />
          <Stat
            label="Active jobs"
            value={
              jobsError
                ? "—"
                : (jobs ?? []).filter(
                    (job) => job.status === "accepted" || job.status === "in_progress",
                  ).length
            }
          />
        </div>
        <label className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm">
          Available now <Switch checked={me.available} onCheckedChange={setAvail} />
        </label>
      </div>
      {jobsError && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          The secure mechanic inbox could not be loaded: {jobsError.message}
        </p>
      )}
      {groups.map((g) => {
        const list = (jobs ?? []).filter((j) => g.filter(j.status));
        return (
          <section key={g.title} className="mt-8">
            <h2 className="text-lg font-semibold">
              {g.title} <span className="text-muted-foreground">({list.length})</span>
            </h2>
            <div className="mt-3 space-y-3">
              {jobsLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
              {list.map((j) => (
                <div key={j.id} className="glass rounded-2xl p-4">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{j.ref}</p>
                      <p className="font-semibold">
                        {j.category}
                        {j.vehicle_make
                          ? ` · ${j.vehicle_make} ${j.vehicle_model} ${j.vehicle_year ?? ""}`
                          : ""}
                      </p>
                    </div>
                    <span className="h-fit rounded-full bg-accent px-2 py-0.5 text-xs">
                      {STATUS_LABEL[j.status]}
                    </span>
                  </div>
                  {j.status === "sent" && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Customer, vehicle, and problem details are revealed only after you accept.
                    </p>
                  )}
                  {j.description && <p className="mt-2 text-sm">{j.description}</p>}
                  {j.customer_name && <p className="mt-1 text-sm">Customer: {j.customer_name}</p>}
                  {j.contact_phone && j.status !== "sent" && (
                    <p className="mt-1 text-sm text-primary">
                      📞 <a href={`tel:${j.contact_phone}`}>{j.contact_phone}</a>
                    </p>
                  )}
                  {j.returned_to_pool && (
                    <p className="mt-2 text-xs text-warning">
                      Returned to the available mechanic pool after a decline.
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {(NEXT[j.status] ?? [])
                      .filter((n) => !(n.to === "declined" && !j.mechanic_owner_id))
                      .map((n) => (
                        <Button
                          key={n.to}
                          size="sm"
                          variant={n.to === "declined" ? "glass" : "hero"}
                          onClick={() => move(j.id, n.to)}
                        >
                          {n.label}
                        </Button>
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
      <p className="mt-2 text-muted-foreground">
        Sign in to manage your workshop or apply to join.
      </p>
      <Button asChild variant="hero" size="xl" className="mt-6">
        <Link to="/auth">Sign in</Link>
      </Button>
    </div>
  );
}

function Apply() {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    workshop: "",
    town: "",
    years: "3",
    bio: "",
    idReference: "",
  });
  const [spec, setSpec] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.workshop || !f.town || !f.idReference.trim() || spec.length === 0) {
      toast.error("Fill in all fields, provide an ID reference, and pick at least one specialty.");
      return;
    }
    setBusy(true);
    try {
      await submitMechanicApplication({
        name: f.name.slice(0, 80),
        workshop: f.workshop.slice(0, 80),
        town: f.town.slice(0, 80),
        experience_years: Number(f.years) || 1,
        specialties: spec,
        bio: f.bio.slice(0, 300),
        id_reference: f.idReference.trim().slice(0, 100),
      });
      toast.success("Application sent — an administrator will verify your workshop.");
      qc.invalidateQueries({ queryKey: ["my-mechanic"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold">Join as a mechanic</h1>
      <p className="mt-1 text-muted-foreground">
        Tell us about your workshop. You'll appear to customers once verified.
      </p>
      <form onSubmit={submit} className="glass mt-5 space-y-4 rounded-2xl p-5">
        <div>
          <Label>Your name</Label>
          <Input
            className="mt-1"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Your full name as it will appear to customers.
          </p>
        </div>
        <div>
          <Label>Workshop name</Label>
          <Input
            className="mt-1"
            value={f.workshop}
            onChange={(e) => setF({ ...f, workshop: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The official name of your workshop or business.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Town / area</Label>
            <Input
              className="mt-1"
              placeholder="Maseru – Ha Abia"
              value={f.town}
              onChange={(e) => setF({ ...f, town: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">Help customers find you easily.</p>
          </div>
          <div>
            <Label>Years of experience</Label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={50}
              value={f.years}
              onChange={(e) => setF({ ...f, years: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">Total years working as a mechanic.</p>
          </div>
        </div>
        <div>
          <Label>Specialties</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() =>
                  setSpec(spec.includes(c) ? spec.filter((s) => s !== c) : [...spec, c])
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  spec.includes(c)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Select all repair types you handle.</p>
        </div>
        <div>
          <Label>Short bio</Label>
          <Input
            className="mt-1"
            value={f.bio}
            onChange={(e) => setF({ ...f, bio: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Brief description of your expertise (max 300 characters).
          </p>
        </div>
        <div>
          <Label htmlFor="id-reference">ID / permit reference</Label>
          <Input
            id="id-reference"
            className="mt-1"
            value={f.idReference}
            onChange={(e) => setF({ ...f, idReference: e.target.value })}
            maxLength={100}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Stored privately for administrator verification; never displayed in the public
            directory. Do not upload an ID image here.
          </p>
        </div>
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>
          {busy ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, MapPin, Star, ArrowLeft } from "lucide-react";
import { getMechanic, getMechanicReviews } from "@/lib/firebase-data";
import { MechanicAvatar, DemoTag } from "@/components/MechanicBits";
import { LedgerProof } from "@/components/LedgerProof";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mechanics/$id")({
  head: () => ({
    meta: [
      { title: "Mechanic profile — AutoHelp Lesotho" },
      { name: "description", content: "Verified mechanic profile: specialties, experience, rating and availability." },
      { property: "og:title", content: "Mechanic profile — AutoHelp Lesotho" },
      { property: "og:description", content: "See specialties, ratings and request help." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { id } = Route.useParams();
  const { data: m } = useQuery({
    queryKey: ["mechanic", id],
    queryFn: () => getMechanic(id),
  });
  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => getMechanicReviews(id),
  });

  if (!m) return <div className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/mechanics" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</Link>
      <div className="glass mt-4 overflow-hidden rounded-3xl">
        <div className="flex flex-col gap-5 p-6 sm:flex-row">
          <MechanicAvatar m={m} className="size-32 text-3xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{m.name}</h1>
              {m.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"><BadgeCheck className="size-3" /> Verified</span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Pending verification</span>
              )}
              {m.is_demo && <DemoTag />}
            </div>
            <p className="text-muted-foreground">{m.workshop}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{m.town}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Rating" value={<span className="inline-flex items-center gap-1"><Star className="size-4 fill-warning text-warning" />{Number(m.rating).toFixed(1)}</span>} />
              <Stat label="Jobs" value={m.jobs_completed} />
              <Stat label="Experience" value={`${m.experience_years} yrs`} />
            </div>
          </div>
        </div>
        <div className="space-y-4 border-t border-border p-6">
          <p className="text-sm">{m.bio}</p>
          <div className="flex flex-wrap gap-2">{m.specialties.map((s) => <span key={s} className="rounded-lg bg-accent px-3 py-1 text-sm">{s}</span>)}</div>
          <p className={m.available ? "text-sm font-medium text-success" : "text-sm text-muted-foreground"}>{m.available ? "● Available now" : "● Currently unavailable and removed from search"}</p>
          <LedgerProof recordRef={m.code} snapshot={{
            type: "mechanic",
            ref: m.code,
            name: m.name,
            workshop: m.workshop,
            town: m.town,
            specialties: m.specialties,
            experienceYears: m.experience_years,
            verified: m.verified,
          }} />
          {m.available ? (
            <Button asChild variant="hero" size="xl" className="w-full"><Link to="/request/$mechanicId" params={{ mechanicId: m.id }}>Request help</Link></Button>
          ) : (
            <Button variant="hero" size="xl" className="w-full" disabled>Currently unavailable</Button>
          )}
        </div>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Reviews</h2>
      <div className="mt-3 space-y-2">
        {(reviews ?? []).length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
        {(reviews ?? []).map((r, i) => (
          <div key={i} className="glass rounded-xl p-4 text-sm">
            <div className="flex gap-0.5">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="size-3 fill-warning text-warning" />)}</div>
            <p className="mt-1">{r.comment || "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Verified customer · {new Date(r.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-accent/60 p-3">
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

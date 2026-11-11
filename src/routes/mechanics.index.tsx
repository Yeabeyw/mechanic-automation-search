import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Brain } from "lucide-react";
import { listVerifiedMechanics } from "@/lib/firebase-data";
import { CATEGORIES, type Mechanic } from "@/lib/mechanics";
import { MechanicCard } from "@/components/MechanicBits";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";


type Search = { category?: string | undefined };

export const Route = createFileRoute("/mechanics/")({
  validateSearch: (s: Record<string, unknown>): Search => ({ category: typeof s["category"] === "string" ? s["category"] : undefined }),
  head: () => ({
    meta: [
      { title: "Find a mechanic in Lesotho — AutoHelp Lesotho" },
      { name: "description", content: "Search verified mechanics by problem, town and availability across Lesotho." },
      { property: "og:title", content: "Find a mechanic — AutoHelp Lesotho" },
      { property: "og:description", content: "Verified mechanics by specialty and town across Lesotho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FindMechanic,
});

function FindMechanic() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [aiSort, setAiSort] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["mechanics"],
    queryFn: listVerifiedMechanics,
  });

  const list = (data ?? []).filter(
    (m) =>
      (!onlyAvail || m.available) &&
      (q === "" || `${m.name} ${m.workshop} ${m.town}`.toLowerCase().includes(q.toLowerCase())),
  );
  const matchingSpecialty = list.filter((m) => !category || m.specialties.includes(category));
  const noSpecialtyMatch = Boolean(category && list.length > 0 && matchingSpecialty.length === 0);
  let displayedMechanics = noSpecialtyMatch ? list : matchingSpecialty;

  // AI sorting: calculate match score based on features
  if (aiSort) {
    displayedMechanics = [...displayedMechanics].map(m => {
      let score = 50;
      if (category && m.specialties.includes(category)) score += 30;
      if (m.verified) score += 15;
      if (m.available) score += 10;
      score += Math.min(m.rating * 5, 10); // Rating contribution
      score -= (m.jobs_completed > 0 ? Math.log(m.jobs_completed) : 0) * 2; // Experience bonus
      score = Math.max(0, Math.min(100, score));
      return { ...m, aiScore: score };
    }).sort((a, b) => (b as any).aiScore - (a as any).aiScore);
  }

  const chip = (active: boolean) =>
    cn("rounded-full border px-3 py-1.5 text-sm transition", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">Find a mechanic</h1>
      <p className="mt-1 text-sm text-muted-foreground">Verified workshops across Lesotho.</p>
      {noSpecialtyMatch && (
        <p className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          No verified mechanic lists {category} as a specialty. Showing all verified mechanics so
          you can still choose someone.
        </p>
      )}
      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, workshop or town (e.g. Maseru)" className="h-12 rounded-xl pl-10" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={chip(!category)} onClick={() => navigate({ search: {} })}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={chip(category === c)} onClick={() => navigate({ search: { category: c } })}>{c}</button>
        ))}
        <button className={chip(onlyAvail)} onClick={() => setOnlyAvail(!onlyAvail)}>Available now</button>
        <button className={chip(aiSort)} onClick={() => setAiSort(!aiSort)}>
          <Brain className="mr-1 inline size-3" />
          AI Recommended
        </button>
      </div>
      <div className="mt-6 grid gap-3">
        {isLoading && <p className="text-muted-foreground">Loading mechanics…</p>}
        {displayedMechanics.map((m) => (
          <MechanicCard 
            key={m.id} 
            m={m} 
            specialtyMayNotMatch={noSpecialtyMatch} 
            aiScore={aiSort ? (m as any).aiScore : undefined}
          />
        ))}
        {!isLoading && displayedMechanics.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">No verified mechanics match yet — try another search or town.</p>}
      </div>
    </div>
  );
}

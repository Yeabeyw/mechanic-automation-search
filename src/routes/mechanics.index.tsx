import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

  const { data, isLoading } = useQuery({
    queryKey: ["mechanics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mechanics").select("*").eq("verified", true).order("rating", { ascending: false });
      if (error) throw error;
      return data as Mechanic[];
    },
  });

  const list = (data ?? []).filter(
    (m) =>
      (!category || m.specialties.includes(category)) &&
      (!onlyAvail || m.available) &&
      (q === "" || `${m.name} ${m.workshop} ${m.town}`.toLowerCase().includes(q.toLowerCase())),
  );

  const chip = (active: boolean) =>
    cn("rounded-full border px-3 py-1.5 text-sm transition", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">Find a mechanic</h1>
      <p className="mt-1 text-sm text-muted-foreground">Verified workshops across Lesotho.</p>
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
      </div>
      <div className="mt-6 grid gap-3">
        {isLoading && <p className="text-muted-foreground">Loading mechanics…</p>}
        {list.map((m) => <MechanicCard key={m.id} m={m} />)}
        {!isLoading && list.length === 0 && <p className="glass rounded-2xl p-6 text-center text-muted-foreground">No mechanics match yet — try another filter.</p>}
      </div>
    </div>
  );
}

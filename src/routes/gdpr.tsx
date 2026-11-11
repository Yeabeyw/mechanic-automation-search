import { createFileRoute, Link } from "@tanstack/react-router";
import checklist from "../../security-console/src/data/gdpr-checklist.json";

export const Route = createFileRoute("/gdpr")({
  head: () => ({ meta: [{ title: "GDPR readiness — AutoHelp Lesotho" }] }),
  component: GDPRPage,
});

function GDPRPage() {
  const items = checklist as Array<{
    requirement: string;
    articles: string;
    level_today: "Implemented" | "Partially" | "Planned" | "N/A";
    gap: string;
    action: string;
  }>;
  const score = Math.round((items.filter((item) => item.level_today === "Implemented").length / items.length) * 100);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">GDPR compliance readiness</h1>
        <p className="mt-2 text-muted-foreground">Evidence-based implementation status; not a legal certification.</p>
        <Link to="/project" className="mt-3 inline-block text-primary underline">Back to Project evidence</Link>
      </header>
      <section className="glass rounded-xl p-5">
        <h2 className="font-semibold">Implemented checks: {score}%</h2>
        <p className="mt-1 text-sm text-muted-foreground">{items.filter((item) => item.level_today === "Implemented").length} of {items.length} checklist items are marked implemented. Planned or partial items are not counted as complete.</p>
      </section>
      <ul className="space-y-3">
        {items.map((item) => (
          <li className="glass rounded-xl p-4" key={item.articles}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-semibold">{item.requirement}</h2>
              <span className="rounded bg-muted px-2 py-1 text-xs">{item.level_today}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.articles}</p>
            {item.gap && <p className="mt-2 text-sm"><strong>Gap:</strong> {item.gap}</p>}
            {item.action && <p className="mt-1 text-sm"><strong>Next action:</strong> {item.action}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}

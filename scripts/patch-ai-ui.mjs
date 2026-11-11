// Makes AI explicit in the UI. Safe to re-run; every step reports OK or FAIL.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

let failed = 0;
const log = (ok, msg) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${msg}`);
  if (!ok) failed++;
};
function edit(file, label, fn) {
  if (!existsSync(file)) return log(false, `${label}: ${file} not found (run this from the AutoHelp project root)`);
  const raw = readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const out = fn(raw.replace(/\r\n/g, "\n"));
  if (out === null) return log(true, `${label}: already applied`);
  if (out === undefined) return log(false, `${label}: expected text not found`);
  writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out);
  log(true, `${label}: patched`);
}
const swap = (t, from, to) => {
  if (t === undefined) return undefined;
  const i = t.indexOf(from);
  return i === -1 ? undefined : t.slice(0, i) + to + t.slice(i + from.length);
};

// 1. Find page: replace the hand-written "AI Recommended" formula with the trained model.
edit("src/routes/mechanics.index.tsx", "Find page uses the trained model", (t) => {
  if (t.includes("bundledArtifact")) return null;
  let o = swap(t, 'import { createFileRoute } from "@tanstack/react-router";', 'import { createFileRoute, Link } from "@tanstack/react-router";');
  o = swap(o, 'import { cn } from "@/lib/utils";', 'import { cn } from "@/lib/utils";\nimport { bundledArtifact } from "@/lib/ai/load";\nimport { isProblemCategory, mechanicAsRecord, scoreRows } from "@/lib/ai/score";');
  const s = o?.indexOf("  // AI sorting: calculate match score based on features");
  const endMark = "(a as any).aiScore);\n  }\n";
  const e = o?.indexOf(endMark);
  if (o === undefined || s === -1 || e === -1) return undefined;
  const block = `  // AI ranking: every mechanic is scored by the trained model (see /ai-dashboards).
  const ai = bundledArtifact();
  const aiModel = ai.bundle.bestModel;
  const aiLabel = { baseline: "rule-based baseline", logistic: "Logistic Regression", forest: "Random Forest" }[aiModel];
  const aiMetrics = ai.bundle.models[aiModel].metrics;
  const aiScores = new Map<string, number>();
  if (aiSort) {
    const problem = category && isProblemCategory(category) ? category : "Other";
    const rows = displayedMechanics.map((m) => mechanicAsRecord(m, problem, "4-7 years"));
    const scores = scoreRows(ai.bundle, rows, aiModel);
    displayedMechanics.forEach((m, i) => aiScores.set(m.id, (scores[i] ?? 0) * 100));
    displayedMechanics = [...displayedMechanics].sort((a, b) => (aiScores.get(b.id) ?? 0) - (aiScores.get(a.id) ?? 0));
  }
`;
  o = o.slice(0, s) + block + o.slice(e + endMark.length);
  o = swap(o, "aiScore={aiSort ? (m as any).aiScore : undefined}", "{...(aiSort && aiScores.has(m.id) ? { aiScore: aiScores.get(m.id) ?? 0 } : {})}");
  o = swap(
    o,
    '      <div className="mt-6 grid gap-3">',
    `      {aiSort && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="font-semibold">
            <Brain className="mr-1 inline size-4" />
            AI-ranked results
          </p>
          <p className="mt-1 text-muted-foreground">
            Mechanics are ordered by their predicted chance of a successful match. The score comes from a {aiLabel} model trained on {ai.bundle.datasetSize} synthetic
            records (test accuracy {(aiMetrics.accuracy * 100).toFixed(1)}%, F1 {(aiMetrics.f1 * 100).toFixed(1)}%). It uses the problem type ({category ?? "general"}), specialty,
            verification, availability, experience and completion history; distance is estimated from the town.
          </p>
          <p className="mt-2 flex flex-wrap gap-4">
            <Link to="/ai-dashboards" className="text-primary underline">Model performance and saturation</Link>
            <Link to="/dataset" className="text-primary underline">Training dataset</Link>
          </p>
        </div>
      )}
      <div className="mt-6 grid gap-3">`,
  );
  return o;
});

// 2. AI dashboards: label which tab answers which Part D question.
edit("src/routes/ai-dashboards.tsx", "Dashboards show D1/D2/D3 mapping", (t) => {
  if (t.includes("D1 · Dataset")) return null;
  let o = swap(t, 'label: "Insights"', 'label: "Insights (D2)"');
  o = swap(o, 'label: "Match Predictor"', 'label: "Match Predictor (D2)"');
  o = swap(o, 'label: "Model Performance"', 'label: "Model Performance (D2)"');
  o = swap(o, 'label: "Accuracy & Saturation"', 'label: "Accuracy & Saturation (D3)"');
  o = swap(
    o,
    "1,000-record synthetic dataset.\n        </p>\n",
    `1,000-record synthetic dataset.
        </p>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">D1 · Dataset</p>
            <p className="text-muted-foreground">
              1,000 synthetic Lesotho records built for mechanic discovery.{" "}
              <a href="/dataset" className="text-primary underline">View the dataset</a>
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">D2 · Model and dashboards</p>
            <p className="text-muted-foreground">
              Baseline, Logistic Regression and Random Forest predict whether a match succeeds. Use the Insights, Predictor and Performance tabs.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">D3 · Accuracy and saturation</p>
            <p className="text-muted-foreground">
              F1 against training size, tree-count sweep and training loss.{" "}
              <button type="button" className="text-primary underline" onClick={() => setTab("saturation")}>Go to D3 charts</button>
            </p>
          </div>
        </div>
`,
  );
  return o;
});

// 3. Home page: explicit AI section with the real numbers.
edit("src/routes/index.tsx", "Home page AI section", (t) => {
  if (t.includes("bundledArtifact")) return null;
  let o = swap(t, "Link2, ArrowRight }", "Link2, ArrowRight, Brain }");
  o = swap(o, 'import { Button } from "@/components/ui/button";', 'import { Button } from "@/components/ui/button";\nimport { bundledArtifact } from "@/lib/ai/load";');
  o = swap(o, "function Index() {\n  return (", "function Index() {\n  const ai = bundledArtifact();\n  const best = ai.bundle.models[ai.bundle.bestModel].metrics;\n  return (");
  const tail = "      </section>\n    </div>\n  );\n}";
  const i = o?.lastIndexOf(tail);
  if (o === undefined || i === undefined || i === -1) return undefined;
  const section = `      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="glass rounded-2xl p-6">
          <Brain className="size-6 text-primary" />
          <h2 className="mt-3 text-xl font-bold">AI-powered mechanic discovery</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A model trained on {ai.bundle.datasetSize} synthetic Lesotho requests predicts which mechanic is most likely to give you a successful match
            (test accuracy {(best.accuracy * 100).toFixed(1)}%, F1 {(best.f1 * 100).toFixed(1)}%). Use “AI Recommended” on the Find page, or open the dashboards to see the dataset, model performance and saturation analysis.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="hero"><Link to="/mechanics">Try AI Recommended</Link></Button>
            <Button asChild variant="glass"><Link to="/ai-dashboards">AI dashboards</Link></Button>
            <Button asChild variant="glass"><Link to="/dataset">AI dataset</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}`;
  return o.slice(0, i) + section + o.slice(i + tail.length);
});

if (failed) {
  console.error(`\n${failed} step(s) failed. Nothing else was changed.`);
  process.exit(1);
}
console.log("\nUI patch complete.");
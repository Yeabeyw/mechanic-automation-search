// Checks every Part D requirement against the actual files. Exit code 1 if anything fails.
import { existsSync, readFileSync } from "node:fs";

const results = [];
const check = (group, name, ok, detail = "") =>
  results.push({ group, name, ok: Boolean(ok), detail });
const read = (f) => (existsSync(f) ? readFileSync(f, "utf8").replace(/\r\n/g, "\n") : "");
const json = (f) => {
  try {
    return JSON.parse(read(f));
  } catch {
    return null;
  }
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

// ---------- D1: dataset ----------
const D1 = "D1 dataset [5]";
const csv = read("AutoHelp_D1_Dataset.csv").trim();
const lines = csv ? csv.split("\n") : [];
const head = (lines[0] ?? "").split(",");
const rows = lines.slice(1).map((l) => l.split(","));
const col = (name) => rows.map((r) => r[head.indexOf(name)]);
const need = [
  "district",
  "problem_category",
  "vehicle_age_band",
  "specialty_match",
  "mechanic_verified",
  "mechanic_experience_years",
  "availability_status",
  "distance_km",
  "historical_completion_rate",
  "quoted_price_maloti",
  "successful_match",
  "is_synthetic",
];
check(D1, "CSV exists with at least 1000 records", rows.length >= 1000, `${rows.length} rows`);
check(
  D1,
  "all required columns present",
  need.every((c) => head.includes(c)),
  need.filter((c) => !head.includes(c)).join(", "),
);
check(
  D1,
  "no missing values",
  rows.every((r) => r.length === head.length && r.every((v) => v !== "")),
);
check(D1, "ids are unique", new Set(col("id")).size === rows.length);
check(
  D1,
  "target is binary",
  col("successful_match").every((v) => v === "0" || v === "1"),
);
const pos = col("successful_match").filter((v) => v === "1").length / Math.max(1, rows.length);
check(D1, "class balance between 30% and 70%", pos > 0.3 && pos < 0.7, pct(pos));
check(
  D1,
  "all 10 Lesotho districts present",
  new Set(col("district")).size === 10,
  `${new Set(col("district")).size} districts`,
);
check(
  D1,
  "synthetic rows are flagged is_synthetic",
  col("is_synthetic").every((v) => v === "TRUE" || v === "FALSE"),
);
check(
  D1,
  "public/ copy matches the CSV",
  read("public/AutoHelp_D1_Dataset.csv") === read("AutoHelp_D1_Dataset.csv"),
);
const card = read("AutoHelp_D1_Dataset_Card.md");
check(
  D1,
  "dataset card exists and is served from public/",
  card.length > 500 && read("public/AutoHelp_D1_Dataset_Card.md") === card,
);
check(
  D1,
  "card lists at least 3 public data sources with URLs",
  (card.match(/https?:\/\/\S+/g) ?? []).length >= 3,
);
check(
  D1,
  "card states the real record count and class balance",
  card.includes(`**Records**: ${rows.length}`) && card.includes(pct(pos)),
  `expects ${rows.length} and ${pct(pos)}`,
);
check(
  D1,
  "card documents the generation rule and limitations",
  /Target rule/.test(card) && /Limitations/.test(card),
);
check(
  D1,
  "generator script exists",
  existsSync("scripts/generate-dataset.cjs") && existsSync("src/lib/ai/dataset.ts"),
);

// ---------- D2: models and dashboards ----------
const D2 = "D2 models + dashboards [20+15+10]";
const art = json("src/lib/ai/trained-artifact.json");
const metricsJson = json("public/AutoHelp_D2_metrics.json");
const models = ["baseline", "logistic", "forest"];
check(
  D2,
  "trained artifact present with 3 models",
  art && models.every((m) => art.bundle?.models?.[m]?.metrics),
);
if (art) {
  const b = art.bundle;
  const tm = (m) => b.models[m].metrics;
  check(
    D2,
    "artifact was trained on the same number of rows as the CSV",
    b.datasetSize === rows.length,
    `${b.datasetSize} vs ${rows.length}`,
  );
  check(
    D2,
    "learned models beat the baseline on F1",
    tm("logistic").f1 > tm("baseline").f1 && tm("forest").f1 > tm("baseline").f1,
    `base ${pct(tm("baseline").f1)}, log ${pct(tm("logistic").f1)}, rf ${pct(tm("forest").f1)}`,
  );
  check(
    D2,
    "confusion matrices add up to the test size",
    models.every((m) => Object.values(tm(m).confusion).reduce((a, c) => a + c, 0) === b.testSize),
  );
  const bestByF1 = [...models].sort(
    (a, c) => tm(c).f1 - tm(a).f1 || tm(c).rocAuc - tm(a).rocAuc,
  )[0];
  check(
    D2,
    "bestModel equals the highest-F1 model",
    b.bestModel === bestByF1,
    `${b.bestModel} vs ${bestByF1}`,
  );
  check(
    D2,
    "5-fold cross-validation recorded for every model",
    models.every((m) => b.models[m].cvF1?.length === 5),
  );
  check(
    D2,
    "ROC curves recorded for every model",
    models.every((m) => b.models[m].roc?.length > 2),
  );
  check(
    D2,
    "feature importance recorded for learned models",
    b.models.logistic.importance?.length > 0 && b.models.forest.importance?.length > 0,
  );
  check(
    D2,
    "metrics file matches the artifact",
    metricsJson &&
      metricsJson.bestModel === b.bestModel &&
      models.every((m) => metricsJson.metrics[m].accuracy === tm(m).accuracy),
  );
}
const nb = json("AutoHelp_D2_Model_Training.ipynb");
const outputs = nb ? nb.cells.filter((c) => c.cell_type === "code" && c.outputs?.length).length : 0;
check(D2, "notebook exists", Boolean(nb));
check(
  D2,
  "notebook has been executed (cells contain outputs)",
  outputs >= 5,
  `${outputs} code cells with outputs; run: python -m jupyter nbconvert --to notebook --execute --inplace AutoHelp_D2_Model_Training.ipynb`,
);

const dash = read("src/routes/ai-dashboards.tsx");
check(
  D2,
  "dashboards read the trained artifact and records",
  /bundledArtifact/.test(dash) && /bundledRecords/.test(dash),
);
check(
  D2,
  "dashboards no longer query the blocked ai_training_data collection",
  !/ai_training_data/.test(dash) && !/ai_training_data/.test(read("src/routes/dataset.tsx")),
);
check(
  D2,
  "no hardcoded fake metrics in dashboards",
  !/confusionMatrix\s*=\s*\{/.test(dash) &&
    !/importance:\s*0\.\d+/.test(dash) &&
    !/Random Forest["'`]?\s*<\/div>/.test(dash),
);
check(
  D2,
  "dashboards have insights, predictor, performance and saturation views",
  [
    "Demand & Discovery Insights",
    "Match Predictor",
    "Model Performance",
    "Accuracy & Saturation",
  ].every((t) => dash.includes(t)),
);
check(
  D2,
  "dashboards use charts (bar, line, ROC, confusion, importance, learning)",
  ["BarInsight", "LineInsight", "RocChart", "HeatMatrix", "ImportanceBars", "LearningChart"].every(
    (c) => dash.includes(c),
  ),
);
check(
  D2,
  "dashboard predictor ranks mechanics with the model",
  /rankMechanics/.test(dash) && /scoreRows/.test(dash),
);
check(
  D2,
  "dashboard route is registered and linked in the nav",
  /ai-dashboards/.test(read("src/routeTree.gen.ts")) &&
    /ai-dashboards/.test(read("src/components/AppShell.tsx")),
);
check(
  D2,
  "dataset page reads bundled records",
  /bundledRecords/.test(read("src/routes/dataset.tsx")),
);
check(D2, "duplicate unused ML library removed", !existsSync("src/lib/ml.ts"));
check(
  D2,
  "AI tests exist",
  [
    "src/test/ai-metrics.test.ts",
    "src/test/ai-pipeline.test.ts",
    "src/test/ai-dashboards.test.tsx",
  ].every(existsSync),
);

// ---------- D3: accuracy and saturation ----------
const D3 = "D3 accuracy + saturation [5]";
if (art) {
  check(
    D3,
    "learning curves for all 3 models, 7 sizes each",
    models.every((m) => art.curves?.[m]?.length === 7),
  );
  check(
    D3,
    "curves record train and validation scores with spread",
    art.curves.logistic.every((p) => "trainF1Mean" in p && "valF1Mean" in p && "valF1Std" in p),
  );
  check(
    D3,
    "saturation result recorded for each model",
    models.every((m) => art.saturation?.[m]?.note),
  );
  const sat = art.saturation.logistic;
  const last = art.curves.logistic.at(-1);
  check(
    D3,
    "saturation is not claimed at the last point by default",
    !(sat.size === last.size && !/Not saturated/.test(sat.note)),
    sat.note,
  );
  check(
    D3,
    "random forest tree sweep and saturation recorded",
    art.treeSweep?.length >= 5 && art.treeSat?.nTrees > 0,
  );
  check(D3, "logistic training-loss curve recorded", art.logisticLoss?.length >= 100);
}
const report = read("AutoHelp_D4_Accuracy_and_Saturation_Report.md");
check(
  D3,
  "D4 report exists and is served from public/",
  report.length > 1000 && read("public/AutoHelp_D4_Accuracy_and_Saturation_Report.md") === report,
);
if (art) {
  const best = art.bundle.bestModel;
  const m = art.bundle.models[best].metrics;
  check(
    D3,
    "D4 report quotes the real best-model numbers",
    report.includes(pct(m.accuracy)) &&
      report.includes(pct(m.f1)) &&
      report.includes(m.rocAuc.toFixed(3)),
    `${best}: ${pct(m.accuracy)} / ${pct(m.f1)} / ${m.rocAuc.toFixed(3)}`,
  );
  check(
    D3,
    "D4 report agrees with the artifact on saturation",
    art.saturation.logistic.size
      ? report.includes(`Saturated at ${art.saturation.logistic.size} records`)
      : report.includes("not saturated by 800 records"),
  );
  check(
    D3,
    "D4 report is free of the old placeholder numbers",
    !/79\.3%|76\.6%|~500 records|Optimal Tree Count/.test(report),
  );
}
for (const [label, re] of [
  ["learning curves", /learning curve/i],
  ["saturation definition", /saturation/i],
  [
    "overfitting and underfitting",
    /overfitting[\s\S]*underfitting|underfitting[\s\S]*overfitting/i,
  ],
  ["accuracy misleading / class imbalance", /accuracy[\s\S]{0,40}mislead/i],
  ["convergence of training", /convergence/i],
  ["how to go beyond saturation", /go past it/i],
]) {
  check(D3, `D4 report covers ${label}`, re.test(report));
}
check(
  D3,
  "saturation dashboard view present",
  /SaturationDashboard/.test(dash) && /LearningChart/.test(dash),
);

// ---------- print ----------
let group = "";
let failed = 0;
for (const r of results) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n=== ${group} ===`);
  }
  if (!r.ok) failed++;
  console.log(
    `${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail && !r.ok ? `  -> ${r.detail}` : r.detail && r.ok ? `  (${r.detail})` : ""}`,
  );
}
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
if (failed) {
  console.log(`${failed} check(s) FAILED.`);
  process.exit(1);
}
console.log("Part D is fully implemented.");

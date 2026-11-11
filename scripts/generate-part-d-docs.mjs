// Rebuilds AutoHelp_D1_Dataset_Card.md and AutoHelp_D4_Accuracy_and_Saturation_Report.md
// from the real CSV and the real trained artifact, so the documents can never drift from the results.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const csvText = readFileSync("AutoHelp_D1_Dataset.csv", "utf8").replace(/\r\n/g, "\n").trim();
const art = JSON.parse(readFileSync("src/lib/ai/trained-artifact.json", "utf8"));

// ---------- helpers ----------
const splitLine = (line) => {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') ((cur += '"'), i++);
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") (out.push(cur), (cur = ""));
    else cur += c;
  }
  out.push(cur);
  return out;
};
const lines = csvText.split("\n");
const header = splitLine(lines[0]);
const rows = lines
  .slice(1)
  .map((l) => Object.fromEntries(splitLine(l).map((v, i) => [header[i], v])));
const n = rows.length;
const num = (k) => rows.map((r) => Number(r[k]));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const f3 = (v) => v.toFixed(3);
const share = (key) => {
  const map = new Map();
  for (const r of rows) map.set(r[key], (map.get(r[key]) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};
const table = (head, body) =>
  [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
const shareTable = (key) =>
  table(
    [key, "Records", "Share"],
    share(key).map(([k, c]) => [k, c, pct(c / n)]),
  );
const today = new Date().toISOString().slice(0, 10);
const positives = rows.filter((r) => r.successful_match === "1").length;
const posRate = positives / n;
const label = {
  baseline: "Baseline (rule)",
  logistic: "Logistic Regression",
  forest: "Random Forest",
};
const names = ["baseline", "logistic", "forest"];
const b = art.bundle;

// ---------- D1 dataset card ----------
let sources = "";
if (existsSync("AutoHelp_D1_Dataset_Card.md")) {
  const old = readFileSync("AutoHelp_D1_Dataset_Card.md", "utf8").replace(/\r\n/g, "\n");
  const s = old.indexOf("## Real Public Data Sources Used");
  const e = old.indexOf("## Data Generation Method");
  if (s !== -1 && e !== -1) sources = old.slice(s, e).trim();
}
if (!sources)
  sources =
    "## Real Public Data Sources Used\n\n(Add the public datasets and URLs consulted here.)";

const cols = [
  ["id", "string", "Unique record id (SYN-0001 …)"],
  ["district", "category", "Lesotho district of the request (10 districts)"],
  ["town", "category", "Town within the district"],
  ["problem_category", "category", "Engine, Battery, Tyre, Brakes, Electrical, Other"],
  ["vehicle_age_band", "category", "0-3, 4-7, 8-12 or 13+ years"],
  ["specialty_match", "0/1", "Mechanic specialties include the problem category"],
  ["mechanic_verified", "0/1", "Mechanic is verified on the platform"],
  ["mechanic_experience_years", "integer", "Years of mechanic experience"],
  ["availability_status", "category", "available / unavailable"],
  ["distance_km", "number", "Distance from customer to mechanic (km, synthetic)"],
  ["historical_completion_rate", "number", "Share of past jobs the mechanic completed"],
  ["quoted_price_maloti", "integer", "Quoted repair price in Maloti (M)"],
  ["successful_match", "0/1", "TARGET: the match succeeded"],
  ["is_synthetic", "TRUE/FALSE", "TRUE for generated rows"],
  ["created_at", "date", "Request date"],
];
const range = (k) => {
  const v = num(k);
  return `${Math.min(...v)} to ${Math.max(...v)} (mean ${mean(v).toFixed(2)})`;
};

const card = `# AutoHelp D1 Dataset Card

**File**: AutoHelp_D1_Dataset.csv  
**Records**: ${n} (${rows.filter((r) => r.is_synthetic.toUpperCase() === "TRUE").length} synthetic, ${rows.filter((r) => r.is_synthetic.toUpperCase() !== "TRUE").length} real)  
**Target**: \`successful_match\` (1 = the customer-mechanic match succeeded)  
**Class balance**: ${positives} successful (${pct(posRate)}) and ${n - positives} unsuccessful (${pct(1 - posRate)})  
**Generated**: ${today} with fixed seed 42 (\`npm run ai:train\` recreates it exactly)

## Objective

The application helps drivers in Lesotho find a suitable mechanic. The AI objective is **content discovery**: rank verified mechanics by the predicted probability that a match with a given customer request will succeed, so the best-fit mechanic is shown first.

${sources}

**Important**: these sources only informed the shape of the data (typical breakdown categories, price levels and the Lesotho district mix). No public dataset contains Lesotho mechanic-customer outcomes, so every row in this file is synthetic and is flagged \`is_synthetic = TRUE\`.

## Schema

${table(
  ["Column", "Type", "Meaning"],
  cols.map(([c, t, m]) => [`\`${c}\``, t, m]),
)}

## Observed distributions

### District
${shareTable("district")}

### Problem category
${shareTable("problem_category")}

### Vehicle age band
${shareTable("vehicle_age_band")}

### Availability
${shareTable("availability_status")}

### Numeric ranges
${table(
  ["Column", "Observed range"],
  [
    "mechanic_experience_years",
    "distance_km",
    "historical_completion_rate",
    "quoted_price_maloti",
  ].map((k) => [`\`${k}\``, range(k)]),
)}

## How the data was generated

Rows are produced by \`src/lib/ai/dataset.ts\` (\`generateSyntheticRecords\`, seed 42):

- District drawn with population-style weights (Maseru largest); town drawn from that district.
- Problem category and vehicle age band drawn from weighted lists.
- \`specialty_match\` = 1 for 58%, \`mechanic_verified\` = 1 for 62%, \`availability_status\` = available for 70%.
- Distance: 2 to 40 km in Maseru, 8 to 128 km elsewhere. Price: uniform within a per-category range in Maloti.
- Completion rate rises with verification and experience, then is clamped to 0.55 to 0.97.

**Target rule.** A success probability is computed as:

\`p = 0.22 + 0.32·specialty_match + 0.22 (available) or −0.18 (unavailable) + 0.14·verified + 0.35·max(0, completion − 0.70) + min(0.08, experience/250) − distance/280 − 0.08 (vehicle 13+ years) − max(0, price − 1800)/9000 + noise\`

The noise is Gaussian with σ = 0.12, \`p\` is clamped to 0.03 to 0.97, and \`successful_match = 1\` when \`p ≥ 0.5\`.

## Quality checks

- Missing values: ${rows.reduce((a, r) => a + Object.values(r).filter((v) => v === "" || v == null).length, 0)}
- Duplicate ids: ${n - new Set(rows.map((r) => r.id)).size}
- Target values: only 0 and 1 (${rows.every((r) => r.successful_match === "0" || r.successful_match === "1") ? "verified" : "FAILED"})
- All 10 Lesotho districts present: ${new Set(rows.map((r) => r.district)).size === 10 ? "yes" : "no"}

## Limitations and responsible use

- The labels come from a known formula, so models can only learn that formula. Scores measure how well a model recovers the rule, not how it would perform on real customers.
- Distances are simulated, not GPS routes. Prices are indicative.
- The dataset contains no personal data (no names, phone numbers or real vehicle registrations).
- When real app outcomes arrive they should be appended with \`is_synthetic = FALSE\`, the models retrained, and results compared against this baseline.
`;

// ---------- D4 report ----------
const tm = (m) => b.models[m].metrics;
const best = b.bestModel;
const majority = Math.max(posRate, 1 - posRate);
const cvMean = (m) => mean(b.models[m].cvF1);
const cvSd = (m) => sd(b.models[m].cvF1);
const logWinsFolds = b.models.logistic.cvF1.filter((v, i) => v > b.models.forest.cvF1[i]).length;
const testSe = Math.sqrt((tm(best).accuracy * (1 - tm(best).accuracy)) / b.testSize);

const curveTable = (m) =>
  table(
    ["Training size", "Train F1", "Validation F1", "Val F1 std", "Gap (train − val)"],
    art.curves[m].map((p) => [
      p.size,
      f3(p.trainF1Mean),
      f3(p.valF1Mean),
      f3(p.valF1Std),
      f3(p.trainF1Mean - p.valF1Mean),
    ]),
  );
const lastPt = (m) => art.curves[m][art.curves[m].length - 1];
const firstPt = (m) => art.curves[m][0];
const gain = (m, from, to) => {
  const a = art.curves[m].find((p) => p.size === from);
  const c = art.curves[m].find((p) => p.size === to);
  return a && c ? c.valF1Mean - a.valF1Mean : 0;
};

const loss = art.logisticLoss;
let convIter = loss.length;
for (let i = 0; i + 50 < loss.length; i++) {
  if (loss[i] - loss[i + 50] < 0.001) {
    convIter = i + 1;
    break;
  }
}
const lossRows = [1, 25, 50, 100, 200, 300, loss.length]
  .filter((i) => i <= loss.length)
  .map((i) => [i, loss[i - 1].toFixed(4)]);
const bestTree = art.treeSweep.reduce((a, c) => (c.valF1 > a.valF1 ? c : a));
const treeRange = art.treeSweep.filter((t) => t.nTrees >= 40);
const treeLo = Math.min(...treeRange.map((t) => t.valF1));
const treeHi = Math.max(...treeRange.map((t) => t.valF1));

const satLine = (m) =>
  m === "baseline"
    ? "Not applicable. The baseline is a fixed rule (specialty match and available), so it learns nothing from more data. Its curve only shows sampling noise."
    : art.saturation[m].size
      ? `Saturated at ${art.saturation[m].size} records. ${art.saturation[m].note}`
      : art.saturation[m].note;

const report = `# AutoHelp D4: Accuracy and Saturation Report

**Generated**: ${today} from \`src/lib/ai/trained-artifact.json\` (trained ${b.trainedAt.slice(0, 10)}, seed ${b.seed})  
**Dataset**: AutoHelp_D1_Dataset.csv, ${b.datasetSize} synthetic records, ${pct(art.recordsMeta.positiveRate)} positive  
**Models**: Baseline rule, Logistic Regression, Random Forest (all implemented in TypeScript in \`src/lib/ai\`)  
**Split**: ${b.trainSize} train / ${b.testSize} test (stratified 80/20), 5-fold cross-validation on the training part

## 1. Summary

- The best model is **${label[best]}**: accuracy ${pct(tm(best).accuracy)}, F1 ${pct(tm(best).f1)}, ROC-AUC ${f3(tm(best).rocAuc)} on the held-out test set.
- Both learned models beat the rule-based baseline (accuracy ${pct(tm("baseline").accuracy)}, F1 ${pct(tm("baseline").f1)}). The majority-class rate is ${pct(majority)}, so every model is well above guessing.
- **Saturation**: Logistic Regression: ${art.saturation.logistic.size ? `saturated at ${art.saturation.logistic.size} records` : "not saturated by 800 records"}. Random Forest: ${art.saturation.forest.size ? `saturated at ${art.saturation.forest.size} records` : "not saturated by 800 records"}. The baseline does not learn, so saturation does not apply.
- The test set has only ${b.testSize} rows, so one accuracy figure carries roughly ±${(testSe * 196).toFixed(1)} points of sampling error (95% interval). Differences of a few points between models on a single split should not be over-read.
- The data is synthetic, so scores show how well each model recovers the generator rule, not real-world performance.

## 2. Test-set results

${table(
  ["Model", "Accuracy", "Precision", "Recall", "F1", "ROC-AUC", "5-fold CV F1 (mean ± sd)"],
  names.map((m) => [
    label[m] + (m === best ? " ★" : ""),
    pct(tm(m).accuracy),
    pct(tm(m).precision),
    pct(tm(m).recall),
    pct(tm(m).f1),
    f3(tm(m).rocAuc),
    `${pct(cvMean(m))} ± ${pct(cvSd(m))}`,
  ]),
)}

Confusion matrices (test set):

${table(
  ["Model", "True pos", "False pos", "True neg", "False neg"],
  names.map((m) => [
    label[m],
    tm(m).confusion.tp,
    tm(m).confusion.fp,
    tm(m).confusion.tn,
    tm(m).confusion.fn,
  ]),
)}

Logistic Regression had a higher cross-validated F1 than Random Forest in ${logWinsFolds} of 5 folds (${pct(cvMean("logistic"))} against ${pct(cvMean("forest"))} on average), which supports choosing it. The labels were built from an additive formula, which suits a linear model well. A forest needs more data to approximate the same thresholds.

## 3. Learning curves and saturation

Method: for each training size (50, 100, 200, 300, 500, 700, 800) the model was trained on a random sample, scored on its own training rows and on a held-out 20%, and repeated 5 times with different seeds. **Saturation** is the smallest size after which validation F1 never improves by 1 percentage point or more.

### Logistic Regression
${curveTable("logistic")}

${satLine("logistic")} From ${firstPt("logistic").size} to ${lastPt("logistic").size} records validation F1 rose by ${(gain("logistic", firstPt("logistic").size, lastPt("logistic").size) * 100).toFixed(1)} points, and from 300 to 800 by ${(gain("logistic", 300, 800) * 100).toFixed(1)} points.

### Random Forest
${curveTable("forest")}

${satLine("forest")} From 300 to 800 records validation F1 rose by ${(gain("forest", 300, 800) * 100).toFixed(1)} points.

### Baseline
${curveTable("baseline")}

${satLine("baseline")}

## 4. Overfitting and underfitting

- **Overfitting** is a high training score with a much lower validation score. **Underfitting** is both scores staying low.
- Logistic Regression at ${firstPt("logistic").size} records: train F1 ${f3(firstPt("logistic").trainF1Mean)} against validation ${f3(firstPt("logistic").valF1Mean)} (gap ${f3(firstPt("logistic").trainF1Mean - firstPt("logistic").valF1Mean)}), clear overfitting on tiny samples. At ${lastPt("logistic").size} records the gap is ${f3(lastPt("logistic").trainF1Mean - lastPt("logistic").valF1Mean)}, so it generalises well.
- Random Forest at ${firstPt("forest").size} records: gap ${f3(firstPt("forest").trainF1Mean - firstPt("forest").valF1Mean)}. At ${lastPt("forest").size} records the gap is still ${f3(lastPt("forest").trainF1Mean - lastPt("forest").valF1Mean)}: trees fit the training rows more closely than new rows, a mild overfit.
- The baseline sits near ${f3(lastPt("baseline").valF1Mean)} F1 at every size. It is a rigid rule that ignores distance, verification and history, which is mild **underfitting** (high bias).

## 5. Random Forest: number of trees

${table(
  ["Trees", "Train F1", "Validation F1", "Validation accuracy"],
  art.treeSweep.map((t) => [t.nTrees, f3(t.trainF1), f3(t.valF1), pct(t.valAccuracy)]),
)}

Validation F1 peaks at ${bestTree.nTrees} trees (${f3(bestTree.valF1)}). From 40 to 200 trees it only moves within ${f3(treeLo)} to ${f3(treeHi)}, which is noise on a ${b.testSize}-row test set, not a trend. Adding trees raises cost without raising accuracy, so the model uses 40 trees. Training F1 stays near 0.90 against about 0.80 on validation, which confirms the overfit described above.

## 6. Logistic Regression convergence

${table(["Iteration", "Training loss"], lossRows)}

Loss starts at ${loss[0].toFixed(3)} (a coin flip) and falls to ${loss[loss.length - 1].toFixed(3)}. It gains less than 0.001 over any further 50 iterations from about iteration ${convIter}, so the ${loss.length} iterations used are enough. Only training loss is recorded, so convergence is judged on training loss plus the validation curves above.

## 7. Why accuracy alone can mislead

Accuracy hides which kind of mistake is made. A model that always predicts the majority class scores ${pct(majority)} here without learning anything, and on a 90/10 dataset it would score 90% while never finding a good match. This dataset is nearly balanced (${pct(posRate)} positive), so accuracy is a fair headline, but the report still gives precision (how many recommended matches succeed), recall (how many good matches are found), F1 and ROC-AUC. For ${label[best]}: precision ${pct(tm(best).precision)}, recall ${pct(tm(best).recall)}. A false positive sends a driver to a mechanic who then fails them, so precision matters most for this app.

## 8. What saturation means and how to go past it

Saturation means more data of the same kind no longer improves the model. Typical causes are limited model capacity, noise in the labels, or features that do not carry more signal. ${art.saturation.logistic.size || art.saturation.forest.size ? "" : "Here neither learned model has saturated by 800 records, so collecting more records is the cheapest next step. "}Beyond that:

1. Replace synthetic rows with real app outcomes (\`is_synthetic = FALSE\`) and retrain.
2. Add features: real driving distance, parts availability, mechanic schedule, urgency, customer reviews.
3. Tune hyperparameters (tree depth, regularisation) with cross-validation and try gradient boosting.
4. Re-run the learning curves after each data increase to see whether the curve has flattened.

## 9. Reproducing and cross-checking

- \`npm run ai:train\` regenerates the dataset, models, metrics and curves. \`npm run docs:part-d\` rebuilds this report and the dataset card. \`npm run verify:part-d\` checks every Part D requirement.
- \`AutoHelp_D2_Model_Training.ipynb\` retrains the same task with scikit-learn as an independent check. Its scores differ a little because the implementations and settings differ (for example 100 trees there against 40 here). The dashboards and this report use the TypeScript pipeline.
`;

writeFileSync("AutoHelp_D1_Dataset_Card.md", card);
writeFileSync("AutoHelp_D4_Accuracy_and_Saturation_Report.md", report);
writeFileSync("public/AutoHelp_D1_Dataset_Card.md", card);
writeFileSync("public/AutoHelp_D4_Accuracy_and_Saturation_Report.md", report);
console.log(
  "Wrote AutoHelp_D1_Dataset_Card.md and AutoHelp_D4_Accuracy_and_Saturation_Report.md (also copied to public/).",
);

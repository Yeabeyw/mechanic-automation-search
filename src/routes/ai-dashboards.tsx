import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Brain, Gauge, TrendingUp } from "lucide-react";
import {
  BarInsight,
  HeatMatrix,
  ImportanceBars,
  LearningChart,
  LineInsight,
  RocChart,
} from "@/components/ai/AiCharts";
import { PRICE_RANGE } from "@/lib/ai/dataset";
import {
  avgPriceByProblem,
  busiestTowns,
  categoriesOverTime,
  filterRecords,
  problemsByDistrict,
  successRateByFlag,
} from "@/lib/ai/insights";
import { bundledArtifact, bundledRecords } from "@/lib/ai/load";
import {
  explainRow,
  isProblemCategory,
  rankMechanics,
  scoreRows,
  type RankedMechanic,
} from "@/lib/ai/score";
import {
  DISTRICTS,
  PROBLEM_CATEGORIES,
  VEHICLE_AGE_BANDS,
  type District,
  type MatchRecord,
  type ModelName,
  type ProblemCategory,
  type VehicleAgeBand,
} from "@/lib/ai/types";
import { listVerifiedMechanics } from "@/lib/firebase-data";
import type { Mechanic } from "@/lib/mechanics";

export const Route = createFileRoute("/ai-dashboards")({
  head: () => ({
    meta: [
      { title: "AI Dashboards — AutoHelp Lesotho" },
      { name: "description", content: "AI model performance, insights and saturation dashboards." },
    ],
  }),
  component: AIDashboardsPage,
});

const MODEL_LABEL: Record<ModelName, string> = {
  baseline: "Baseline (rule)",
  logistic: "Logistic Regression",
  forest: "Random Forest",
};
const MODELS: ModelName[] = ["baseline", "logistic", "forest"];
const MODEL_COLOR: Record<ModelName, string> = {
  baseline: "#9eb3d1",
  logistic: "#3b9eff",
  forest: "#5ee0a8",
};
const CATEGORY_COLORS = ["#3b9eff", "#5ee0a8", "#f5c15c", "#f07178", "#c792ea", "#9eb3d1"];
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

type Tab = "insights" | "predictor" | "performance" | "saturation";

export function AIDashboardsPage() {
  const [tab, setTab] = useState<Tab>("insights");
  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "insights", label: "Insights (D2)", icon: BarChart3 },
    { id: "predictor", label: "Match Predictor (D2)", icon: Brain },
    { id: "performance", label: "Model Performance (D2)", icon: Gauge },
    { id: "saturation", label: "Accuracy & Saturation (D3)", icon: TrendingUp },
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="glass rounded-3xl p-8">
        <h1 className="mb-2 text-3xl font-bold">AI Dashboards</h1>
        <p className="mb-6 text-muted-foreground">
          Smart mechanic discovery for Lesotho: demand insights, match predictions, model
          performance and saturation. All figures come from the trained model artifact and the
          1,000-record synthetic dataset.
        </p>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">D1 · Dataset</p>
            <p className="text-muted-foreground">
              1,000 synthetic Lesotho records built for mechanic discovery.{" "}
              <a href="/dataset" className="text-primary underline">
                View the dataset
              </a>
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">D2 · Model and dashboards</p>
            <p className="text-muted-foreground">
              Baseline, Logistic Regression and Random Forest predict whether a match succeeds. Use
              the Insights, Predictor and Performance tabs.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">D3 · Accuracy and saturation</p>
            <p className="text-muted-foreground">
              F1 against training size, tree-count sweep and training loss.{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setTab("saturation")}
              >
                Go to D3 charts
              </button>
            </p>
          </div>
        </div>
        <div className="mb-8 flex flex-wrap gap-2 border-b pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md px-4 py-2 text-sm font-medium ${tab === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Icon className="mr-2 inline h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {tab === "insights" && <InsightsDashboard />}
        {tab === "predictor" && <PredictorDashboard />}
        {tab === "performance" && <PerformanceDashboard />}
        {tab === "saturation" && <SaturationDashboard />}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function InsightsDashboard() {
  const all = useMemo(() => bundledRecords(), []);
  const [district, setDistrict] = useState("all");
  const rows = useMemo(() => filterRecords(all, { district }), [all, district]);
  const specialty = successRateByFlag(rows, "specialty_match");
  const verified = successRateByFlag(rows, "mechanic_verified");
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Demand & Discovery Insights</h2>
        <label className="text-sm">
          District{" "}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="ml-2 rounded-md border bg-background px-3 py-2"
          >
            <option value="all">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} requests in view.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Requests by district">
          <BarInsight data={problemsByDistrict(rows)} xKey="district" yKey="count" />
        </Card>
        <Card title="Busiest towns">
          <BarInsight data={busiestTowns(rows)} xKey="town" yKey="count" color="#5ee0a8" />
        </Card>
        <Card title="Problem categories over time">
          <LineInsight
            data={categoriesOverTime(rows)}
            xKey="month"
            series={PROBLEM_CATEGORIES.map((key, i) => ({
              key,
              color: CATEGORY_COLORS[i] ?? "#9eb3d1",
            }))}
          />
        </Card>
        <Card title="Average quoted price by problem (Maloti)">
          <BarInsight data={avgPriceByProblem(rows)} xKey="category" yKey="avg" color="#f5c15c" />
        </Card>
        <Card title="Success rate (%) by specialty match">
          <BarInsight
            data={specialty.map((s) => ({
              label: `${s.label} (n=${s.n})`,
              rate: Math.round(s.rate * 1000) / 10,
            }))}
            xKey="label"
            yKey="rate"
            color="#3b9eff"
          />
        </Card>
        <Card title="Success rate (%) by verification">
          <BarInsight
            data={verified.map((s) => ({
              label: `${s.label} (n=${s.n})`,
              rate: Math.round(s.rate * 1000) / 10,
            }))}
            xKey="label"
            yKey="rate"
            color="#5ee0a8"
          />
        </Card>
      </div>
    </div>
  );
}

function describe(w: { feature: string; contribution: number }) {
  return `${w.feature} (${w.contribution >= 0 ? "+" : ""}${w.contribution.toFixed(2)})`;
}

function PredictorDashboard() {
  const bundle = useMemo(() => bundledArtifact().bundle, []);
  const [model, setModel] = useState<ModelName>(bundle.bestModel);
  const [district, setDistrict] = useState<District>("Maseru");
  const [problem, setProblem] = useState<ProblemCategory>("Engine");
  const [age, setAge] = useState<VehicleAgeBand>("4-7 years");
  const [mechanics, setMechanics] = useState<Mechanic[] | null>(null);
  const [whatIf, setWhatIf] = useState({
    specialty: true,
    verified: true,
    available: true,
    distance: 20,
    completion: 0.8,
    experience: 8,
  });

  useEffect(() => {
    let alive = true;
    listVerifiedMechanics()
      .then((list) => {
        if (alive) setMechanics(list);
      })
      .catch(() => {
        if (alive) setMechanics([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const ranked: RankedMechanic[] = useMemo(
    () =>
      mechanics && mechanics.length
        ? rankMechanics(bundle, mechanics, problem, age, district, model).slice(0, 5)
        : [],
    [bundle, mechanics, problem, age, district, model],
  );

  const [lo, hi] = PRICE_RANGE[problem];
  const row: MatchRecord = {
    id: "what-if",
    district,
    town: district,
    problem_category: problem,
    vehicle_age_band: age,
    specialty_match: whatIf.specialty ? 1 : 0,
    mechanic_verified: whatIf.verified ? 1 : 0,
    mechanic_experience_years: whatIf.experience,
    availability_status: whatIf.available ? "available" : "unavailable",
    distance_km: whatIf.distance,
    historical_completion_rate: whatIf.completion,
    quoted_price_maloti: Math.round((lo + hi) / 2),
    successful_match: 0,
    is_synthetic: true,
    created_at: new Date().toISOString().slice(0, 10),
  };
  const score = scoreRows(bundle, [row], model)[0] ?? 0;
  const why = explainRow(bundle, row, model);

  const select = "mt-1 w-full rounded-md border bg-background px-3 py-2";
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Match Predictor</h2>
      <div className="grid gap-4 md:grid-cols-4">
        <label className="text-sm font-medium">
          District
          <select
            className={select}
            value={district}
            onChange={(e) => setDistrict(e.target.value as District)}
          >
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Problem
          <select
            className={select}
            value={problem}
            onChange={(e) => {
              if (isProblemCategory(e.target.value)) setProblem(e.target.value);
            }}
          >
            {PROBLEM_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Vehicle age
          <select
            className={select}
            value={age}
            onChange={(e) => setAge(e.target.value as VehicleAgeBand)}
          >
            {VEHICLE_AGE_BANDS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Model
          <select
            className={select}
            value={model}
            onChange={(e) => setModel(e.target.value as ModelName)}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {MODEL_LABEL[m]}
                {m === bundle.bestModel ? " (best)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card title="Top verified mechanics for this request">
        {mechanics === null ? (
          <p className="text-sm text-muted-foreground">Loading mechanics…</p>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No verified mechanics could be loaded. Use the what-if scorer below.
          </p>
        ) : (
          <div className="space-y-3">
            {ranked.map((r) => (
              <div
                key={r.mechanic.id}
                className="flex items-center justify-between rounded-lg bg-muted p-4"
              >
                <div>
                  <div className="font-medium">
                    {r.mechanic.name} · {r.mechanic.workshop}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.mechanic.town} · {r.why.slice(0, 3).map(describe).join(", ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{pct(r.score)}</div>
                  <div className="text-xs text-muted-foreground">Match score</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="What-if scorer">
        <div className="grid gap-4 md:grid-cols-3">
          {(["specialty", "verified", "available"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={whatIf[k]}
                onChange={(e) => setWhatIf({ ...whatIf, [k]: e.target.checked })}
              />
              {k === "specialty"
                ? "Specialty matches problem"
                : k === "verified"
                  ? "Mechanic verified"
                  : "Mechanic available"}
            </label>
          ))}
          <label className="text-sm">
            Distance: {whatIf.distance} km
            <input
              type="range"
              min={2}
              max={128}
              value={whatIf.distance}
              onChange={(e) => setWhatIf({ ...whatIf, distance: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          <label className="text-sm">
            Completion rate: {pct(whatIf.completion)}
            <input
              type="range"
              min={0.55}
              max={0.97}
              step={0.01}
              value={whatIf.completion}
              onChange={(e) => setWhatIf({ ...whatIf, completion: Number(e.target.value) })}
              className="w-full"
            />
          </label>
          <label className="text-sm">
            Experience: {whatIf.experience} years
            <input
              type="range"
              min={1}
              max={25}
              value={whatIf.experience}
              onChange={(e) => setWhatIf({ ...whatIf, experience: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </div>
        <p className="mt-4 text-3xl font-bold text-primary">
          {pct(score)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            predicted match success ({MODEL_LABEL[model]})
          </span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Main drivers: {why.map(describe).join(", ")}
        </p>
      </Card>
    </div>
  );
}

function PerformanceDashboard() {
  const bundle = useMemo(() => bundledArtifact().bundle, []);
  const [model, setModel] = useState<ModelName>(bundle.bestModel);
  const m = bundle.models[model];
  const importance = model === "baseline" ? [] : bundle.models[model].importance;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Model Performance</h2>
        <label className="text-sm">
          Inspect model{" "}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelName)}
            className="ml-2 rounded-md border bg-background px-3 py-2"
          >
            {MODELS.map((n) => (
              <option key={n} value={n}>
                {MODEL_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card title={`Model comparison (held-out test set, n=${bundle.testSize})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {["Model", "Accuracy", "Precision", "Recall", "F1", "ROC-AUC", "5-fold CV F1"].map(
                  (h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {MODELS.map((n) => {
                const x = bundle.models[n];
                return (
                  <tr key={n} className="border-b">
                    <td className="px-4 py-2 font-medium">
                      {MODEL_LABEL[n]}
                      {n === bundle.bestModel ? " ★" : ""}
                    </td>
                    <td className="px-4 py-2">{pct(x.metrics.accuracy)}</td>
                    <td className="px-4 py-2">{pct(x.metrics.precision)}</td>
                    <td className="px-4 py-2">{pct(x.metrics.recall)}</td>
                    <td className="px-4 py-2">{pct(x.metrics.f1)}</td>
                    <td className="px-4 py-2">{x.metrics.rocAuc.toFixed(3)}</td>
                    <td className="px-4 py-2">{pct(mean(x.cvF1))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          ★ best model by test F1 (ties broken by ROC-AUC).
        </p>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title={`Confusion matrix (${MODEL_LABEL[model]})`}>
          <HeatMatrix matrix={m.metrics.confusion} />
        </Card>
        <Card title="ROC curves">
          <RocChart
            series={MODELS.map((n) => ({
              name: MODEL_LABEL[n],
              color: MODEL_COLOR[n],
              points: bundle.models[n].roc,
            }))}
          />
        </Card>
        <Card title={`Feature importance (${MODEL_LABEL[model]})`}>
          {importance.length ? (
            <ImportanceBars data={importance} />
          ) : (
            <p className="text-sm text-muted-foreground">
              The rule-based baseline has no learned features.
            </p>
          )}
        </Card>
        <Card title="Training information">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">Dataset size</dt>
            <dd className="font-semibold">{bundle.datasetSize} records</dd>
            <dt className="text-muted-foreground">Train / test</dt>
            <dd className="font-semibold">
              {bundle.trainSize} / {bundle.testSize}
            </dd>
            <dt className="text-muted-foreground">Random seed</dt>
            <dd className="font-semibold">{bundle.seed}</dd>
            <dt className="text-muted-foreground">Trained at</dt>
            <dd className="font-semibold">{new Date(bundle.trainedAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Best model</dt>
            <dd className="font-semibold">{MODEL_LABEL[bundle.bestModel]}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function SaturationDashboard() {
  const art = useMemo(() => bundledArtifact(), []);
  const [model, setModel] = useState<ModelName>("logistic");
  const points = art.curves[model] ?? [];
  const sat = art.saturation[model];
  const last = points[points.length - 1];
  const gap = last ? last.trainF1Mean - last.valF1Mean : 0;
  const lossData = art.logisticLoss
    .map((loss, i) => ({ iteration: i + 1, loss: Math.round(loss * 10000) / 10000 }))
    .filter((_, i) => i % 10 === 0 || i === art.logisticLoss.length - 1);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Accuracy & Saturation</h2>
        <label className="text-sm">
          Model{" "}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelName)}
            className="ml-2 rounded-md border bg-background px-3 py-2"
          >
            {MODELS.map((n) => (
              <option key={n} value={n}>
                {MODEL_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Card
        title={`Learning curve: ${MODEL_LABEL[model]} (F1 vs training size, mean of 5 repeats)`}
      >
        <LearningChart
          data={points.map((p) => ({ size: p.size, train: p.trainF1Mean, val: p.valF1Mean }))}
          yTrain="Training F1"
          yVal="Validation F1"
          saturationSize={model === "baseline" ? null : (sat?.size ?? null)}
        />
        <p className="mt-3 text-sm">
          {model === "baseline"
            ? "The baseline is a fixed rule with no training, so its curve only shows sampling noise and saturation does not apply."
            : sat?.note}
        </p>
        {model !== "baseline" && last && (
          <p className="mt-2 text-sm text-muted-foreground">
            At {last.size} records the train–validation F1 gap is {(gap * 100).toFixed(1)} points:{" "}
            {gap > 0.05
              ? "a noticeable gap, so the model is overfitting."
              : "a small gap, so it generalises well."}
          </p>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Random Forest: number of trees vs F1">
          <LineInsight
            data={art.treeSweep.map((t) => ({
              nTrees: t.nTrees,
              trainF1: Math.round(t.trainF1 * 1000) / 1000,
              valF1: Math.round(t.valF1 * 1000) / 1000,
            }))}
            xKey="nTrees"
            series={[
              { key: "trainF1", color: "#7ec8ff" },
              { key: "valF1", color: "#f5c15c" },
            ]}
          />
          <p className="mt-3 text-sm">
            Later tree counts add less than 1 F1 point after about {art.treeSat.nTrees} trees
            (validation F1 {pct(art.treeSat.f1)}).
          </p>
        </Card>
        <Card title="Logistic Regression: training loss per iteration">
          <LineInsight
            data={lossData}
            xKey="iteration"
            series={[{ key: "loss", color: "#3b9eff" }]}
          />
          <p className="mt-3 text-sm">
            Loss falls from 0.693 to{" "}
            {(art.logisticLoss[art.logisticLoss.length - 1] ?? 0).toFixed(3)} and flattens, which
            shows convergence.
          </p>
        </Card>
      </div>

      <Card title="How to read this">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <strong>Saturation</strong> means more training data no longer lifts validation F1 by 1
            point or more. Where no saturation line is drawn, the model was still improving at 800
            records, so more data would help.
          </li>
          <li>
            <strong>Overfitting</strong> shows as high training F1 with much lower validation F1
            (the gap above). <strong>Underfitting</strong> shows as both scores staying low.
          </li>
          <li>
            <strong>Accuracy can mislead</strong> on imbalanced data. Here{" "}
            {pct(art.recordsMeta.positiveRate)} of matches succeed, so classes are fairly balanced,
            but precision, recall, F1 and ROC-AUC are still reported next to accuracy.
          </li>
          <li>
            The data is synthetic, so these scores describe how well the models recover the
            generator rules, not real-world performance.
          </li>
        </ul>
      </Card>
    </div>
  );
}

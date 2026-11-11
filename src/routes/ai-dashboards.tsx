import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getFirebaseDb } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Brain, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/ai-dashboards")({
  head: () => ({
    meta: [
      { title: "AI Dashboards — AutoHelp Lesotho" },
      { name: "description", content: "AI model performance and insights dashboards." },
    ],
  }),
  component: AIDashboardsPage,
});

type DatasetRecord = {
  id: number;
  district: string;
  problem_category: string;
  vehicle_age_band: string;
  specialty_match: number;
  mechanic_verified: number;
  quoted_price_maloti: number;
  successful_match: number;
};

function AIDashboardsPage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<"insights" | "predictor" | "performance">("insights");
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const db = getFirebaseDb();
        const q = query(collection(db, "ai_training_data"), orderBy("id"), limit(1000));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data() as DatasetRecord);
        setRecords(data);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="text-center">Loading dashboards...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Dashboards</h1>
        <p className="text-muted-foreground">
          Model performance, insights, and predictions for AutoHelp Lesotho
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "insights"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="mr-2 inline h-4 w-4" />
          Demand & Discovery
        </button>
        <button
          onClick={() => setActiveTab("predictor")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "predictor"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain className="mr-2 inline h-4 w-4" />
          Match Predictor
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "performance"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="mr-2 inline h-4 w-4" />
          Model Performance
        </button>
      </div>

      <div className="glass rounded-3xl p-8">
        {activeTab === "insights" && <InsightsDashboard records={records} />}
        {activeTab === "predictor" && <PredictorDashboard records={records} />}
        {activeTab === "performance" && (
          <PerformanceDashboard records={records} isAdmin={hasRole("admin")} />
        )}
      </div>
    </div>
  );
}

function InsightsDashboard({ records }: { records: DatasetRecord[] }) {
  // Calculate statistics
  const districtCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const categoryPrices: Record<string, { sum: number; count: number }> = {};

  records.forEach(r => {
    districtCounts[r.district] = (districtCounts[r.district] || 0) + 1;
    categoryCounts[r.problem_category] = (categoryCounts[r.problem_category] || 0) + 1;
    
    if (!categoryPrices[r.problem_category]) {
      categoryPrices[r.problem_category] = { sum: 0, count: 0 };
    }
    categoryPrices[r.problem_category].sum += r.quoted_price_maloti;
    categoryPrices[r.problem_category].count += 1;
  });

  const avgPrices = Object.entries(categoryPrices).map(([cat, data]) => ({
    category: cat,
    avgPrice: data.sum / data.count,
  })).sort((a, b) => b.avgPrice - a.avgPrice);

  const specialtyMatchSuccess = records.filter(r => r.specialty_match === 1 && r.successful_match === 1).length;
  const specialtyMatchTotal = records.filter(r => r.specialty_match === 1).length;
  const specialtyMatchRate = specialtyMatchTotal > 0 ? (specialtyMatchSuccess / specialtyMatchTotal) * 100 : 0;

  const verifiedSuccess = records.filter(r => r.mechanic_verified === 1 && r.successful_match === 1).length;
  const verifiedTotal = records.filter(r => r.mechanic_verified === 1).length;
  const verifiedRate = verifiedTotal > 0 ? (verifiedSuccess / verifiedTotal) * 100 : 0;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Demand & Discovery Insights</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Problems by District</h3>
          <div className="space-y-3">
            {Object.entries(districtCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([district, count]) => (
                <div key={district} className="flex items-center gap-3">
                  <div className="w-24 text-sm">{district}</div>
                  <div className="flex-1 h-6 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / records.length) * 100}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm font-medium">{count}</div>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Problem Categories</h3>
          <div className="space-y-3">
            {Object.entries(categoryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => (
                <div key={category} className="flex items-center gap-3">
                  <div className="w-24 text-sm">{category}</div>
                  <div className="flex-1 h-6 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(count / records.length) * 100}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm font-medium">{count}</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-4">Average Quoted Price by Problem (Maloti)</h3>
        <div className="space-y-3">
          {avgPrices.map(({ category, avgPrice }) => (
            <div key={category} className="flex items-center gap-3">
              <div className="w-32 text-sm">{category}</div>
              <div className="flex-1 h-6 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${(avgPrice / 4000) * 100}%` }}
                />
              </div>
              <div className="w-20 text-right text-sm font-medium">M {avgPrice.toFixed(0)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Success Rate by Specialty Match</h3>
          <div className="text-4xl font-bold text-green-600">{specialtyMatchRate.toFixed(1)}%</div>
          <p className="text-sm text-muted-foreground mt-2">
            When mechanic specialty matches problem category
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Success Rate by Verification</h3>
          <div className="text-4xl font-bold text-blue-600">{verifiedRate.toFixed(1)}%</div>
          <p className="text-sm text-muted-foreground mt-2">
            When mechanic is verified
          </p>
        </div>
      </div>
    </div>
  );
}

function PredictorDashboard({ records }: { records: DatasetRecord[] }) {
  const [district, setDistrict] = useState("Maseru");
  const [problemCategory, setProblemCategory] = useState("Engine");
  const [vehicleAge, setVehicleAge] = useState("4-7 years");
  const [predictions, setPredictions] = useState<any[]>([]);

  const districts = [...new Set(records.map(r => r.district))];
  const categories = [...new Set(records.map(r => r.problem_category))];
  const ages = [...new Set(records.map(r => r.vehicle_age_band))];

  function predictMatch() {
    // Simple rule-based prediction for demo
    const matchingRecords = records.filter(
      r => r.district === district && r.problem_category === problemCategory
    );

    const predictions = matchingRecords.slice(0, 5).map(r => {
      let score = 50;
      if (r.specialty_match === 1) score += 30;
      if (r.mechanic_verified === 1) score += 15;
      if (r.historical_completion_rate > 0.8) score += 10;
      score -= r.distance_km * 0.1;
      score = Math.max(0, Math.min(100, score));

      return {
        mechanicId: r.id,
        score: score.toFixed(1),
        specialtyMatch: r.specialty_match === 1,
        verified: r.mechanic_verified === 1,
        completionRate: (r.historical_completion_rate * 100).toFixed(0),
        distance: r.distance_km.toFixed(1),
      };
    }).sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    setPredictions(predictions);
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Match Predictor</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium mb-2">District</label>
          <select
            value={district}
            onChange={e => setDistrict(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Problem Category</label>
          <select
            value={problemCategory}
            onChange={e => setProblemCategory(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Vehicle Age</label>
          <select
            value={vehicleAge}
            onChange={e => setVehicleAge(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            {ages.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <Button onClick={predictMatch} className="w-full md:w-auto">
        Predict Matches
      </Button>

      {predictions.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Top Mechanics for Your Request</h3>
          <div className="space-y-4">
            {predictions.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <div className="font-medium">Mechanic #{p.mechanicId}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.specialtyMatch ? "✓ Specialty match" : "✗ No specialty match"} · 
                    {p.verified ? " ✓ Verified" : " ✗ Unverified"} · 
                    {p.completionRate}% completion rate · 
                    {p.distance} km away
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{p.score}%</div>
                  <div className="text-xs text-muted-foreground">Match Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PerformanceDashboard({ records, isAdmin }: { records: DatasetRecord[]; isAdmin: boolean }) {
  // Mock model performance data (would come from actual training)
  const modelMetrics = [
    { model: "Baseline", accuracy: 0.542, precision: 0.523, recall: 0.612, f1: 0.489, rocAuc: 0.542 },
    { model: "Logistic Regression", accuracy: 0.766, precision: 0.748, recall: 0.762, f1: 0.743, rocAuc: 0.781 },
    { model: "Random Forest", accuracy: 0.793, precision: 0.778, recall: 0.789, f1: 0.764, rocAuc: 0.812 },
  ];

  const confusionMatrix = {
    tp: 79,
    tn: 80,
    fp: 21,
    fn: 20,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Model Performance</h2>
        {isAdmin && (
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retrain Model
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-4">Model Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Model</th>
                <th className="px-4 py-2 text-left font-medium">Accuracy</th>
                <th className="px-4 py-2 text-left font-medium">Precision</th>
                <th className="px-4 py-2 text-left font-medium">Recall</th>
                <th className="px-4 py-2 text-left font-medium">F1</th>
                <th className="px-4 py-2 text-left font-medium">ROC-AUC</th>
              </tr>
            </thead>
            <tbody>
              {modelMetrics.map((m) => (
                <tr key={m.model} className="border-b">
                  <td className="px-4 py-2 font-medium">{m.model}</td>
                  <td className="px-4 py-2">{(m.accuracy * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2">{(m.precision * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2">{(m.recall * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2">{(m.f1 * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2">{m.rocAuc.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Confusion Matrix (Random Forest)</h3>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-4 rounded bg-green-100 dark:bg-green-900/30">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{confusionMatrix.tp}</div>
              <div className="text-xs text-muted-foreground">True Positive</div>
            </div>
            <div className="p-4 rounded bg-red-100 dark:bg-red-900/30">
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">{confusionMatrix.fp}</div>
              <div className="text-xs text-muted-foreground">False Positive</div>
            </div>
            <div className="p-4 rounded bg-red-100 dark:bg-red-900/30">
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">{confusionMatrix.fn}</div>
              <div className="text-xs text-muted-foreground">False Negative</div>
            </div>
            <div className="p-4 rounded bg-green-100 dark:bg-green-900/30">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{confusionMatrix.tn}</div>
              <div className="text-xs text-muted-foreground">True Negative</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4">Feature Importance (Random Forest)</h3>
          <div className="space-y-3">
            {[
              { feature: "Specialty Match", importance: 0.32 },
              { feature: "Availability", importance: 0.24 },
              { feature: "Historical Completion Rate", importance: 0.18 },
              { feature: "Distance", importance: 0.12 },
              { feature: "Verification", importance: 0.08 },
              { feature: "Experience", importance: 0.06 },
            ].map((f) => (
              <div key={f.feature} className="flex items-center gap-3">
                <div className="w-32 text-sm">{f.feature}</div>
                <div className="flex-1 h-6 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${f.importance * 100}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-medium">{(f.importance * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-4">Training Information</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground">Dataset Size</div>
            <div className="text-xl font-bold">{records.length} records</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Last Training</div>
            <div className="text-xl font-bold">Nov 10, 2026</div>
          </div>
          <div>
            <div class="text-sm text-muted-foreground">Best Model</div>
            <div className="text-xl font-bold">Random Forest</div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore";
import { getFirebaseDb } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { Download, Database, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dataset")({
  head: () => ({
    meta: [
      { title: "AI Dataset — AutoHelp Lesotho" },
      { name: "description", content: "View the AutoHelp Lesotho AI training dataset." },
    ],
  }),
  component: DatasetPage,
});

type DatasetRecord = {
  id: number;
  district: string;
  town: string;
  problem_category: string;
  vehicle_age_band: string;
  specialty_match: number;
  mechanic_verified: number;
  mechanic_experience_years: number;
  availability_status: string;
  distance_km: number;
  historical_completion_rate: number;
  quoted_price_maloti: number;
  successful_match: number;
  is_synthetic: string;
};

function DatasetPage() {
  const [records, setRecords] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    successful: number;
    unsuccessful: number;
    districtCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    async function loadDataset() {
      try {
        const db = getFirebaseDb();
        const q = query(collection(db, "ai_training_data"), orderBy("id"), limit(100));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data() as DatasetRecord);
        setRecords(data);

        // Calculate statistics
        const successful = data.filter(r => r.successful_match === 1).length;
        const unsuccessful = data.filter(r => r.successful_match === 0).length;
        
        const districtCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};
        
        data.forEach(r => {
          districtCounts[r.district] = (districtCounts[r.district] || 0) + 1;
          categoryCounts[r.problem_category] = (categoryCounts[r.problem_category] || 0) + 1;
        });

        setStats({
          total: data.length,
          successful,
          unsuccessful,
          districtCounts,
          categoryCounts,
        });
      } catch (error) {
        console.error("Failed to load dataset:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDataset();
  }, []);

  const columnDescriptions = [
    { name: "district", description: "Lesotho district where the request originated" },
    { name: "town", description: "Specific town within the district" },
    { name: "problem_category", description: "Type of vehicle problem (Engine, Brakes, Electrical, etc.)" },
    { name: "vehicle_age_band", description: "Vehicle age category (0-3, 4-7, 8-12, 13+ years)" },
    { name: "specialty_match", description: "Whether mechanic's specialty matches the problem (0 or 1)" },
    { name: "mechanic_verified", description: "Whether mechanic is verified (0 or 1)" },
    { name: "mechanic_experience_years", description: "Years of mechanic experience (1-25)" },
    { name: "availability_status", description: "Mechanic's current availability (available/unavailable)" },
    { name: "distance_km", description: "Distance from customer to mechanic in kilometers" },
    { name: "historical_completion_rate", description: "Mechanic's historical job completion rate (0.60-0.95)" },
    { name: "quoted_price_maloti", description: "Quoted repair price in Maloti (200-4000 M)" },
    { name: "successful_match", description: "Target: was the match successful? (0 or 1)" },
    { name: "is_synthetic", description: "Whether record is synthetic (TRUE/FALSE)" },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="text-center">Loading dataset...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="glass rounded-3xl p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI Training Dataset</h1>
            <p className="text-muted-foreground">
              AutoHelp Lesotho Smart Mechanic Discovery dataset for ML model training
            </p>
          </div>
          <Button variant="outline" onClick={() => window.open('/AutoHelp_D1_Dataset.csv', '_blank')}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>

        <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Synthetic Data:</strong> This dataset contains 1000 synthetically generated records for training purposes.
            Real app data will be added as it becomes available. See the{" "}
            <a href="/AutoHelp_D1_Dataset_Card.md" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Dataset Card
            </a>{" "}
            for details.
          </p>
        </div>

        {stats && (
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Total Records</h3>
              </div>
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Preview (first 100)</p>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold mb-2">Class Balance</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Successful (1)</span>
                  <span className="font-semibold text-green-600">
                    {stats.successful} ({((stats.successful / stats.total) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Unsuccessful (0)</span>
                  <span className="font-semibold text-red-600">
                    {stats.unsuccessful} ({((stats.unsuccessful / stats.total) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold mb-2">Target Variable</h3>
              <p className="text-lg font-bold">successful_match</p>
              <p className="text-sm text-muted-foreground">Binary classification (0 or 1)</p>
            </div>
          </div>
        )}

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4">Records per District</h3>
            <div className="space-y-3">
              {stats &&
                Object.entries(stats.districtCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([district, count]) => (
                    <div key={district} className="flex items-center gap-3">
                      <div className="w-32 text-sm">{district}</div>
                      <div className="flex-1 h-6 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm font-medium">
                        {count} ({((count / stats.total) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4">Records per Problem Category</h3>
            <div className="space-y-3">
              {stats &&
                Object.entries(stats.categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center gap-3">
                      <div className="w-32 text-sm">{category}</div>
                      <div className="flex-1 h-6 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm font-medium">
                        {count} ({((count / stats.total) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-semibold mb-4">Column Descriptions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Column</th>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {columnDescriptions.map((col) => (
                  <tr key={col.name} className="border-b">
                    <td className="px-4 py-2 font-mono text-primary">{col.name}</td>
                    <td className="px-4 py-2">{col.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-4">Data Preview (First 20 Records)</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">ID</th>
                  <th className="px-3 py-2 text-left font-medium">District</th>
                  <th className="px-3 py-2 text-left font-medium">Problem</th>
                  <th className="px-3 py-2 text-left font-medium">Vehicle Age</th>
                  <th className="px-3 py-2 text-left font-medium">Specialty</th>
                  <th className="px-3 py-2 text-left font-medium">Verified</th>
                  <th className="px-3 py-2 text-left font-medium">Available</th>
                  <th className="px-3 py-2 text-left font-medium">Distance</th>
                  <th className="px-3 py-2 text-left font-medium">Price (M)</th>
                  <th className="px-3 py-2 text-left font-medium">Match</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="px-3 py-2">{record.id}</td>
                    <td className="px-3 py-2">{record.district}</td>
                    <td className="px-3 py-2">{record.problem_category}</td>
                    <td className="px-3 py-2">{record.vehicle_age_band}</td>
                    <td className="px-3 py-2">{record.specialty_match}</td>
                    <td className="px-3 py-2">{record.mechanic_verified}</td>
                    <td className="px-3 py-2">{record.availability_status === 'available' ? '✓' : '✗'}</td>
                    <td className="px-3 py-2">{record.distance_km.toFixed(1)}</td>
                    <td className="px-3 py-2">{record.quoted_price_maloti}</td>
                    <td className="px-3 py-2 font-bold">{record.successful_match}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

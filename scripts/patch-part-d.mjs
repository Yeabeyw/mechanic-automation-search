// Applies the Part D fixes. Safe to re-run: every step checks whether it is already applied.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

let failed = 0;
const log = (ok, msg) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${msg}`);
  if (!ok) failed++;
};

function edit(file, fn, label) {
  if (!existsSync(file)) return log(false, `${label}: ${file} not found`);
  const raw = readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const text = raw.replace(/\r\n/g, "\n");
  const out = fn(text);
  if (out === null) return log(true, `${label}: already applied`);
  if (out === undefined) return log(false, `${label}: expected text not found`);
  writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out);
  log(true, `${label}: patched`);
}

function replaceOnce(text, from, to) {
  const i = text.indexOf(from);
  if (i === -1) return undefined;
  return text.slice(0, i) + to + text.slice(i + from.length);
}

// 1. Saturation detector: never report "saturated" at the last point just because nothing comes after it.
edit(
  "src/lib/ai/curves.ts",
  (t) => {
    if (t.includes("Not saturated:")) return null;
    let out = replaceOnce(
      t,
      "    if (i === points.length - 1 || laterGain < 0.01) {\n      return {\n        model,",
      "    if (i < points.length - 1 && laterGain < 0.01) {\n      return {\n        model,",
    );
    if (out === undefined) return undefined;
    out = replaceOnce(
      out,
      '  return { model, size: null, note: "Validation F1 was still improving by at least 1 percentage point at the largest size tested." };',
      "  const last = points[points.length - 1]!;\n  return {\n    model,\n    size: null,\n    note: `Not saturated: validation F1 was still improving at the largest size tested (${last.size} records, F1 ${(last.valF1Mean * 100).toFixed(1)}%).`,\n  };",
    );
    return out;
  },
  "curves.ts saturation detector",
);

// 2. LearningChart drew only shaded areas (Line inside AreaChart is ignored by recharts). Use ComposedChart.
edit(
  "src/components/ai/AiCharts.tsx",
  (t) => {
    if (t.includes("ComposedChart")) return null;
    let out = replaceOnce(t, "  AreaChart,\n", "  ComposedChart,\n");
    if (out === undefined) return undefined;
    out = out.replace("  Area,\n", "");
    const start = out.indexOf("export function LearningChart");
    const end = out.indexOf("export function HeatMatrix");
    if (start === -1 || end === -1) return undefined;
    const fn = `export function LearningChart({
  data,
  yTrain,
  yVal,
  saturationSize,
}: {
  data: { size: number; train: number; val: number }[];
  yTrain: string;
  yVal: string;
  saturationSize?: number | null;
}) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="size" tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <YAxis domain={[0.4, 1]} tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="train" stroke="#7ec8ff" name={yTrain} strokeWidth={2} />
          <Line type="monotone" dataKey="val" stroke="#f5c15c" name={yVal} strokeWidth={2} />
          {saturationSize ? (
            <ReferenceLine x={saturationSize} stroke="#5ee0a8" strokeDasharray="4 4" label={{ value: "Saturation", fill: "#5ee0a8", fontSize: 11 }} />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

`;
    return out.slice(0, start) + fn + out.slice(end);
  },
  "AiCharts.tsx learning chart",
);

// 3. Dataset page: read the bundled 1000 records (the Firestore collection it used is blocked by your rules).
edit(
  "src/routes/dataset.tsx",
  (t) => {
    if (t.includes("bundledRecords")) return null;
    let out = t;
    out = replaceOnce(
      out,
      'import { collection, getDocs, query, limit, orderBy } from "firebase/firestore";\nimport { getFirebaseDb } from "@/integrations/firebase/client";\n',
      'import { bundledRecords } from "@/lib/ai/load";\nimport type { MatchRecord } from "@/lib/ai/types";\n',
    );
    if (out === undefined) return undefined;
    const ts = out.indexOf("type DatasetRecord = {");
    const te = out.indexOf("};", ts);
    if (ts === -1 || te === -1) return undefined;
    out = out.slice(0, ts) + "type DatasetRecord = MatchRecord;" + out.slice(te + 2);
    const es = out.indexOf("  useEffect(() => {\n    async function loadDataset()");
    const ee = out.indexOf("    loadDataset();\n  }, []);");
    if (es === -1 || ee === -1) return undefined;
    const effect = `  useEffect(() => {
    const data = bundledRecords();
    setRecords(data);
    const districtCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const r of data) {
      districtCounts[r.district] = (districtCounts[r.district] || 0) + 1;
      categoryCounts[r.problem_category] = (categoryCounts[r.problem_category] || 0) + 1;
    }
    const successful = data.filter((r) => r.successful_match === 1).length;
    setStats({ total: data.length, successful, unsuccessful: data.length - successful, districtCounts, categoryCounts });
    setLoading(false);
  }, []);`;
    out = out.slice(0, es) + effect + out.slice(ee + "    loadDataset();\n  }, []);".length);
    out = out.replace("Preview (first 100)", "All records in the dataset");
    out = out.replace("(0.60-0.95)", "(0.55-0.97)").replace("(200-4000 M)", "(about 200-2800 M)");
    out = out.replace(
      "Type of vehicle problem (Engine, Brakes, Electrical, etc.)",
      "Type of vehicle problem (Engine, Battery, Tyre, Brakes, Electrical, Other)",
    );
    return out;
  },
  "dataset.tsx bundled records",
);

// 4. npm scripts
edit(
  "package.json",
  (t) => {
    if (t.includes('"verify:part-d"')) return null;
    return replaceOnce(
      t,
      '    "test": "vitest run",',
      '    "test": "vitest run",\n    "ai:train": "vitest run src/test/ai-pipeline.test.ts",\n    "docs:part-d": "node scripts/generate-part-d-docs.mjs",\n    "verify:part-d": "node scripts/verify-part-d.mjs",',
    );
  },
  "package.json scripts",
);

// 5. Remove dead code: unused duplicate ML library and the loader for a collection your rules block.
for (const f of ["src/lib/ml.ts", "scripts/load-dataset-to-firebase.cjs"]) {
  if (existsSync(f)) {
    rmSync(f);
    log(true, `removed ${f}`);
  } else log(true, `${f} already removed`);
}

if (failed) {
  console.error(`\n${failed} step(s) failed.`);
  process.exit(1);
}
console.log("\nPatch complete.");

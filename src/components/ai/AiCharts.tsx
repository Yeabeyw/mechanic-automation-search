import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  ReferenceLine,
  Cell,
} from "recharts";

const tooltipStyle = {
  background: "rgba(12, 22, 40, 0.95)",
  border: "1px solid rgba(80, 160, 255, 0.35)",
  borderRadius: 12,
  fontSize: 12,
};

export function BarInsight({
  data,
  xKey,
  yKey,
  color = "#3b9eff",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  color?: string;
}) {
  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "#9eb3d1", fontSize: 11 }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineInsight({
  data,
  xKey,
  series,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; color: string }[];
}) {
  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey={xKey} tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <YAxis tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LearningChart({
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
            <ReferenceLine
              x={saturationSize}
              stroke="#5ee0a8"
              strokeDasharray="4 4"
              label={{ value: "Saturation", fill: "#5ee0a8", fontSize: 11 }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HeatMatrix({
  matrix,
}: {
  matrix: { tp: number; fp: number; tn: number; fn: number };
}) {
  const cells = [
    { label: "True pos", value: matrix.tp, color: "#3b9eff" },
    { label: "False pos", value: matrix.fp, color: "#f07178" },
    { label: "False neg", value: matrix.fn, color: "#f5c15c" },
    { label: "True neg", value: matrix.tn, color: "#5ee0a8" },
  ];
  const max = Math.max(...cells.map((c) => c.value), 1);
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-xl p-4 text-center"
          style={{
            background: `${c.color}${Math.round(40 + (c.value / max) * 80)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        >
          <p className="text-2xl font-bold">{c.value}</p>
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

export function RocChart({
  series,
}: {
  series: { name: string; color: string; points: { fpr: number; tpr: number }[] }[];
}) {
  const data: Record<string, number>[] = [];
  const n = 21;
  for (let i = 0; i < n; i++) {
    const fpr = i / (n - 1);
    const row: Record<string, number> = { fpr };
    for (const s of series) {
      let best = s.points[0]?.tpr ?? 0;
      for (const p of s.points) {
        if (p.fpr <= fpr) best = p.tpr;
      }
      row[s.name] = best;
    }
    data.push(row);
  }
  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="fpr" tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <YAxis domain={[0, 1]} tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ImportanceBars({ data }: { data: { feature: string; importance: number }[] }) {
  const top = data.slice(0, 8);
  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ left: 16, right: 12 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#9eb3d1", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="feature"
            width={120}
            tick={{ fill: "#9eb3d1", fontSize: 10 }}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
            {top.map((entry) => (
              <Cell key={entry.feature} fill="#3b9eff" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

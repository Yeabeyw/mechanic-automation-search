import type { MatchRecord } from "./types";

export function filterRecords(
  rows: MatchRecord[],
  filters: { district?: string; from?: string; to?: string },
) {
  return rows.filter((row) => {
    if (filters.district && filters.district !== "all" && row.district !== filters.district) return false;
    if (filters.from && row.created_at < filters.from) return false;
    if (filters.to && row.created_at > filters.to) return false;
    return true;
  });
}

export function problemsByDistrict(rows: MatchRecord[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.district, (map.get(row.district) ?? 0) + 1);
  return [...map.entries()].map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count);
}

export function categoriesOverTime(rows: MatchRecord[]) {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const month = row.created_at.slice(0, 7);
    const current = map.get(month) ?? {};
    current[row.problem_category] = (current[row.problem_category] ?? 0) + 1;
    map.set(month, current);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));
}

export function busiestTowns(rows: MatchRecord[], limit = 8) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.town, (map.get(row.town) ?? 0) + 1);
  return [...map.entries()]
    .map(([town, count]) => ({ town, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function avgPriceByProblem(rows: MatchRecord[]) {
  const map = new Map<string, { sum: number; n: number }>();
  for (const row of rows) {
    const cur = map.get(row.problem_category) ?? { sum: 0, n: 0 };
    cur.sum += row.quoted_price_maloti;
    cur.n += 1;
    map.set(row.problem_category, cur);
  }
  return [...map.entries()].map(([category, { sum, n }]) => ({
    category,
    avg: n === 0 ? 0 : Math.round(sum / n),
  }));
}

export function successRateByFlag(rows: MatchRecord[], flag: "specialty_match" | "mechanic_verified") {
  const groups = [0, 1] as const;
  return groups.map((value) => {
    const subset = rows.filter((row) => row[flag] === value);
    const ok = subset.filter((row) => row.successful_match === 1).length;
    return {
      label: value === 1 ? "Yes" : "No",
      rate: subset.length === 0 ? 0 : ok / subset.length,
      n: subset.length,
    };
  });
}

import { DISTRICTS, PROBLEM_CATEGORIES, VEHICLE_AGE_BANDS, type MatchRecord } from "./types";

export const NUMERIC_FEATURES = [
  "specialty_match",
  "mechanic_verified",
  "mechanic_experience_years",
  "available",
  "distance_km",
  "historical_completion_rate",
  "quoted_price_maloti",
] as const;

export type EncodedMatrix = {
  names: string[];
  X: number[][];
  y: number[];
};

function numericVector(row: MatchRecord) {
  return [
    row.specialty_match,
    row.mechanic_verified,
    row.mechanic_experience_years,
    row.availability_status === "available" ? 1 : 0,
    row.distance_km,
    row.historical_completion_rate,
    row.quoted_price_maloti,
  ];
}

export function encodeRecords(rows: MatchRecord[]): EncodedMatrix {
  const names = [
    ...NUMERIC_FEATURES,
    ...PROBLEM_CATEGORIES.map((c) => `cat_${c}`),
    ...VEHICLE_AGE_BANDS.map((a) => `age_${a}`),
    ...DISTRICTS.map((d) => `dist_${d}`),
  ];
  const X = rows.map((row) => {
    const cats = PROBLEM_CATEGORIES.map((c) => (row.problem_category === c ? 1 : 0));
    const ages = VEHICLE_AGE_BANDS.map((a) => (row.vehicle_age_band === a ? 1 : 0));
    const dists = DISTRICTS.map((d) => (row.district === d ? 1 : 0));
    return [...numericVector(row), ...cats, ...ages, ...dists];
  });
  return { names, X, y: rows.map((r) => r.successful_match) };
}

export function standardiseFit(X: number[][]) {
  const nFeat = X[0]?.length ?? 0;
  const means = Array.from({ length: nFeat }, () => 0);
  const stds = Array.from({ length: nFeat }, () => 1);
  if (X.length === 0) return { means, stds };
  for (let j = 0; j < nFeat; j++) {
    let sum = 0;
    for (const row of X) sum += row[j]!;
    means[j] = sum / X.length;
    let varSum = 0;
    for (const row of X) varSum += (row[j]! - means[j]!) ** 2;
    stds[j] = Math.sqrt(varSum / X.length) || 1;
  }
  return { means, stds };
}

export function applyStandardise(X: number[][], means: number[], stds: number[]) {
  return X.map((row) => row.map((v, j) => (v - means[j]!) / stds[j]!));
}

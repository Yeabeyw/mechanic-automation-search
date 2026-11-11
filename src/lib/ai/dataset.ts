import { gaussian, mulberry32, pick, randInt, weightedPick } from "./rng";
import {
  DISTRICTS,
  PROBLEM_CATEGORIES,
  VEHICLE_AGE_BANDS,
  type District,
  type MatchRecord,
  type ProblemCategory,
  type VehicleAgeBand,
} from "./types";

export const DATASET_SEED = 42;
export const DATASET_SIZE = 1000;

export const DISTRICT_TOWNS: Record<District, string[]> = {
  Maseru: ["Maseru", "Mazenod", "Roma", "Ha Thetsane", "Khubetsoana"],
  Berea: ["Teyateyaneng", "Mapoteng", "Sefikeng"],
  Leribe: ["Hlotse", "Maputsoe", "Peka"],
  "Butha-Buthe": ["Butha-Buthe", "Oxbow"],
  Mokhotlong: ["Mokhotlong", "Tlokoeng"],
  "Thaba-Tseka": ["Thaba-Tseka", "Katse"],
  "Qacha's Nek": ["Qacha's Nek", "Sehlabathebe"],
  Quthing: ["Quthing", "Mount Moorosi"],
  "Mohale's Hoek": ["Mohale's Hoek", "Mpharane"],
  Mafeteng: ["Mafeteng", "Qalabane"],
};

/** Approximate district demand share, following population concentration around Maseru. */
export const DISTRICT_WEIGHTS = [32, 12, 14, 6, 4, 4, 3, 7, 8, 10];

/**
 * Problem mix: JAF roadside data is battery/tyre-heavy; MOT failures add brakes/lights.
 * Shares are damped so marketplace jobs are not 43% battery.
 */
export const CATEGORY_WEIGHTS = [16, 22, 18, 18, 14, 12];

export const PRICE_RANGE: Record<ProblemCategory, [number, number]> = {
  Engine: [500, 2800],
  Battery: [250, 900],
  Tyre: [200, 800],
  Brakes: [300, 1500],
  Electrical: [350, 1600],
  Other: [200, 1200],
};

export const AGE_WEIGHTS = [18, 34, 32, 16];

export const COLUMN_DESCRIPTIONS: { key: keyof MatchRecord; label: string; meaning: string }[] = [
  { key: "id", label: "id", meaning: "Anonymous record identifier (no personal data)." },
  { key: "district", label: "district", meaning: "One of Lesotho's 10 districts." },
  { key: "town", label: "town", meaning: "Town within the district where the job is requested." },
  { key: "problem_category", label: "problem_category", meaning: "Customer's car problem, aligned with AutoHelp specialties." },
  { key: "vehicle_age_band", label: "vehicle_age_band", meaning: "Age band of the vehicle (0-3, 4-7, 8-12, 13+ years)." },
  { key: "specialty_match", label: "specialty_match", meaning: "1 if the mechanic lists this problem as a specialty." },
  { key: "mechanic_verified", label: "mechanic_verified", meaning: "1 if an AutoHelp admin has verified the mechanic." },
  { key: "mechanic_experience_years", label: "mechanic_experience_years", meaning: "Years of workshop experience (1-25)." },
  { key: "availability_status", label: "availability_status", meaning: "available or unavailable at request time." },
  { key: "distance_km", label: "distance_km", meaning: "Approximate customer-to-workshop distance in kilometres." },
  { key: "historical_completion_rate", label: "historical_completion_rate", meaning: "Share of past jobs this mechanic completed (0.55-0.97)." },
  { key: "quoted_price_maloti", label: "quoted_price_maloti", meaning: "Quoted repair price in Lesotho Loti (M)." },
  { key: "successful_match", label: "successful_match", meaning: "Target: 1 if the customer-mechanic match succeeded." },
  { key: "is_synthetic", label: "is_synthetic", meaning: "TRUE for generated rows; FALSE for anonymised app outcomes." },
  { key: "created_at", label: "created_at", meaning: "Request date (synthetic dates span 2025-01 to 2026-10)." },
];

function successProbability(row: Omit<MatchRecord, "successful_match" | "id">, noise: number) {
  let p = 0.22;
  p += row.specialty_match * 0.32;
  p += row.availability_status === "available" ? 0.22 : -0.18;
  p += row.mechanic_verified * 0.14;
  p += Math.max(0, row.historical_completion_rate - 0.7) * 0.35;
  p += Math.min(0.08, row.mechanic_experience_years / 250);
  p -= row.distance_km / 280;
  p -= row.vehicle_age_band === "13+ years" ? 0.08 : 0;
  p -= Math.max(0, row.quoted_price_maloti - 1800) / 9000;
  p += noise;
  return Math.min(0.97, Math.max(0.03, p));
}

export function generateSyntheticRecords(count = DATASET_SIZE, seed = DATASET_SEED): MatchRecord[] {
  const rng = mulberry32(seed);
  const rows: MatchRecord[] = [];
  for (let i = 1; i <= count; i++) {
    const district = weightedPick(rng, DISTRICTS, DISTRICT_WEIGHTS);
    const town = pick(rng, DISTRICT_TOWNS[district]);
    const problem_category = weightedPick(rng, PROBLEM_CATEGORIES, CATEGORY_WEIGHTS);
    const vehicle_age_band = weightedPick(rng, VEHICLE_AGE_BANDS, AGE_WEIGHTS);
    const specialty_match = rng() < 0.58 ? 1 : 0;
    const mechanic_verified = rng() < 0.62 ? 1 : 0;
    const mechanic_experience_years = Math.max(1, Math.min(25, Math.round(4 + Math.abs(gaussian(rng)) * 6)));
    const availability_status = rng() < 0.7 ? "available" : "unavailable";
    const distance_km = Math.round((district === "Maseru" ? 2 + rng() * 38 : 8 + rng() * 120) * 10) / 10;
    const historical_completion_rate =
      Math.round(
        (0.58 + mechanic_verified * 0.08 + mechanic_experience_years / 120 + rng() * 0.18) * 100,
      ) / 100;
    const [lo, hi] = PRICE_RANGE[problem_category];
    const quoted_price_maloti = randInt(rng, lo, hi);
    const monthOffset = randInt(rng, 0, 21);
    const day = randInt(rng, 1, 28);
    const created = new Date(Date.UTC(2025, monthOffset, day));
    const base = {
      district,
      town,
      problem_category,
      vehicle_age_band,
      specialty_match: specialty_match as 0 | 1,
      mechanic_verified: mechanic_verified as 0 | 1,
      mechanic_experience_years,
      availability_status: availability_status as "available" | "unavailable",
      distance_km,
      historical_completion_rate: Math.min(0.97, Math.max(0.55, historical_completion_rate)),
      quoted_price_maloti,
      is_synthetic: true,
      created_at: created.toISOString().slice(0, 10),
    };
    const p = successProbability(base, gaussian(rng) * 0.12);
    rows.push({
      id: `SYN-${String(i).padStart(4, "0")}`,
      ...base,
      successful_match: p >= 0.5 ? 1 : 0,
    });
  }
  return rows;
}

export function recordsToCsv(rows: MatchRecord[]) {
  const headers = [
    "id",
    "district",
    "town",
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
    "created_at",
  ];
  const escape = (value: string | number | boolean) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((key) => {
          const value = row[key as keyof MatchRecord];
          if (key === "is_synthetic") return value ? "TRUE" : "FALSE";
          return escape(value as string | number | boolean);
        })
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseDatasetCsv(csv: string): MatchRecord[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const at = (name: string) => cols[idx[name] ?? -1] ?? "";
    return {
      id: at("id"),
      district: at("district") as District,
      town: at("town"),
      problem_category: at("problem_category") as ProblemCategory,
      vehicle_age_band: at("vehicle_age_band") as VehicleAgeBand,
      specialty_match: Number(at("specialty_match")) as 0 | 1,
      mechanic_verified: Number(at("mechanic_verified")) as 0 | 1,
      mechanic_experience_years: Number(at("mechanic_experience_years")),
      availability_status: at("availability_status") as "available" | "unavailable",
      distance_km: Number(at("distance_km")),
      historical_completion_rate: Number(at("historical_completion_rate")),
      quoted_price_maloti: Number(at("quoted_price_maloti")),
      successful_match: Number(at("successful_match")) as 0 | 1,
      is_synthetic: at("is_synthetic").toUpperCase() === "TRUE",
      created_at: at("created_at") || "2025-06-01",
    };
  });
}

function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function classBalance(rows: MatchRecord[]) {
  const positives = rows.filter((r) => r.successful_match === 1).length;
  return {
    positives,
    negatives: rows.length - positives,
    positiveRate: rows.length === 0 ? 0 : positives / rows.length,
    synthetic: rows.filter((r) => r.is_synthetic).length,
    real: rows.filter((r) => !r.is_synthetic).length,
  };
}

export function countBy<K extends keyof MatchRecord>(rows: MatchRecord[], key: K) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[key]);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

export function mergeRealOutcomes(synthetic: MatchRecord[], real: MatchRecord[]) {
  return [...synthetic, ...real];
}

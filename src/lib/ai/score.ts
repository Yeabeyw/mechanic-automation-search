import { baselineExplain, baselineScores } from "./baseline";
import { DISTRICT_TOWNS, PRICE_RANGE } from "./dataset";
import { encodeRecords } from "./features";
import { forestContributions, forestScores } from "./forest";
import { logisticContributions, logisticScores } from "./logistic";
import type { TrainedBundle } from "./train";
import {
  DISTRICTS,
  PROBLEM_CATEGORIES,
  type District,
  type FeatureContribution,
  type MatchRecord,
  type ModelName,
  type ProblemCategory,
  type VehicleAgeBand,
} from "./types";
import type { Mechanic } from "@/lib/mechanics";

export type RankedMechanic = {
  mechanic: Mechanic;
  score: number;
  why: FeatureContribution[];
};

function townToDistrict(town: string): District {
  for (const district of DISTRICTS) {
    if (DISTRICT_TOWNS[district].some((t) => t.toLowerCase() === town.toLowerCase())) return district;
  }
  return "Maseru";
}

export function mechanicAsRecord(
  mechanic: Mechanic,
  problem: ProblemCategory,
  vehicleAge: VehicleAgeBand,
  district?: District,
): MatchRecord {
  const hist = Math.min(0.97, 0.58 + mechanic.jobs_completed / 220 + mechanic.experience_years / 200);
  const [lo, hi] = PRICE_RANGE[problem];
  return {
    id: mechanic.id,
    district: district ?? townToDistrict(mechanic.town),
    town: mechanic.town,
    problem_category: problem,
    vehicle_age_band: vehicleAge,
    specialty_match: mechanic.specialties.includes(problem) ? 1 : 0,
    mechanic_verified: mechanic.verified ? 1 : 0,
    mechanic_experience_years: mechanic.experience_years,
    availability_status: mechanic.available ? "available" : "unavailable",
    distance_km: mechanic.town.toLowerCase().includes("maseru") ? 8 : 28,
    historical_completion_rate: Math.round(hist * 100) / 100,
    quoted_price_maloti: Math.round((lo + hi) / 2),
    successful_match: 0,
    is_synthetic: true,
    created_at: new Date().toISOString().slice(0, 10),
  };
}

export function scoreRows(bundle: TrainedBundle, rows: MatchRecord[], modelName: ModelName) {
  if (modelName === "baseline") return baselineScores(rows);
  const encoded = encodeRecords(rows);
  if (modelName === "logistic") return logisticScores(bundle.models.logistic.model, encoded.X);
  return forestScores(bundle.models.forest.model, encoded.X);
}

export function explainRow(bundle: TrainedBundle, row: MatchRecord, modelName: ModelName): FeatureContribution[] {
  if (modelName === "baseline") return baselineExplain(row);
  const encoded = encodeRecords([row]);
  if (modelName === "logistic") return logisticContributions(bundle.models.logistic.model, encoded.X[0]!).slice(0, 5);
  return forestContributions(bundle.models.forest.model, encoded.X[0]!).slice(0, 5);
}

export function rankMechanics(
  bundle: TrainedBundle,
  mechanics: Mechanic[],
  problem: ProblemCategory,
  vehicleAge: VehicleAgeBand,
  district: District,
  modelName: ModelName,
): RankedMechanic[] {
  const rows = mechanics.map((m) => mechanicAsRecord(m, problem, vehicleAge, district));
  const scores = scoreRows(bundle, rows, modelName);
  return mechanics
    .map((mechanic, i) => ({
      mechanic,
      score: scores[i]!,
      why: explainRow(bundle, rows[i]!, modelName),
    }))
    .sort((a, b) => b.score - a.score);
}

export function isProblemCategory(value: string): value is ProblemCategory {
  return (PROBLEM_CATEGORIES as readonly string[]).includes(value);
}

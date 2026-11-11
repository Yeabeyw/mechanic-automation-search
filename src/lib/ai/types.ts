export const DISTRICTS = [
  "Maseru",
  "Berea",
  "Leribe",
  "Butha-Buthe",
  "Mokhotlong",
  "Thaba-Tseka",
  "Qacha's Nek",
  "Quthing",
  "Mohale's Hoek",
  "Mafeteng",
] as const;

export const PROBLEM_CATEGORIES = [
  "Engine",
  "Battery",
  "Tyre",
  "Brakes",
  "Electrical",
  "Other",
] as const;

export const VEHICLE_AGE_BANDS = ["0-3 years", "4-7 years", "8-12 years", "13+ years"] as const;

export type District = (typeof DISTRICTS)[number];
export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];
export type VehicleAgeBand = (typeof VEHICLE_AGE_BANDS)[number];

export type MatchRecord = {
  id: string;
  district: District;
  town: string;
  problem_category: ProblemCategory;
  vehicle_age_band: VehicleAgeBand;
  specialty_match: 0 | 1;
  mechanic_verified: 0 | 1;
  mechanic_experience_years: number;
  availability_status: "available" | "unavailable";
  distance_km: number;
  historical_completion_rate: number;
  quoted_price_maloti: number;
  successful_match: 0 | 1;
  is_synthetic: boolean;
  created_at: string;
};

export type ConfusionMatrix = {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
};

export type MetricSet = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  confusion: ConfusionMatrix;
};

export type RocPoint = { fpr: number; tpr: number };

export type FeatureContribution = { feature: string; value: number; contribution: number };

export type ModelName = "baseline" | "logistic" | "forest";

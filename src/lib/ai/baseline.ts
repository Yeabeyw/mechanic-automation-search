import type { MatchRecord } from "./types";

/** Recommend only when specialty matches and the mechanic is available. */
export function baselineScores(rows: MatchRecord[]) {
  return rows.map((row) => (row.specialty_match === 1 && row.availability_status === "available" ? 1 : 0));
}

export function baselineExplain(row: MatchRecord) {
  const reasons = [];
  if (row.specialty_match === 1) reasons.push({ feature: "specialty_match", value: 1, contribution: 1 });
  else reasons.push({ feature: "specialty_match", value: 0, contribution: -1 });
  if (row.availability_status === "available") reasons.push({ feature: "availability_status", value: 1, contribution: 1 });
  else reasons.push({ feature: "availability_status", value: 0, contribution: -1 });
  return reasons;
}

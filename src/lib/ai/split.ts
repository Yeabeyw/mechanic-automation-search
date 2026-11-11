import { shuffleInPlace } from "./rng";
import type { MatchRecord } from "./types";

export function stratifiedSplit(rows: MatchRecord[], testFraction: number, rng: () => number) {
  const byClass: Record<0 | 1, MatchRecord[]> = { 0: [], 1: [] };
  for (const row of rows) byClass[row.successful_match].push(row);
  const train: MatchRecord[] = [];
  const test: MatchRecord[] = [];
  for (const label of [0, 1] as const) {
    const group = shuffleInPlace(rng, [...byClass[label]]);
    const nTest = Math.max(1, Math.round(group.length * testFraction));
    test.push(...group.slice(0, nTest));
    train.push(...group.slice(nTest));
  }
  return { train: shuffleInPlace(rng, train), test: shuffleInPlace(rng, test) };
}

export function stratifiedKFold(rows: MatchRecord[], k: number, rng: () => number) {
  const byClass: Record<0 | 1, MatchRecord[]> = { 0: [], 1: [] };
  for (const row of rows) byClass[row.successful_match].push(row);
  shuffleInPlace(rng, byClass[0]);
  shuffleInPlace(rng, byClass[1]);
  const folds: MatchRecord[][] = Array.from({ length: k }, () => []);
  for (const label of [0, 1] as const) {
    byClass[label].forEach((row, i) => folds[i % k]!.push(row));
  }
  return folds.map((holdout, i) => ({
    test: holdout,
    train: folds.flatMap((fold, j) => (j === i ? [] : fold)),
  }));
}

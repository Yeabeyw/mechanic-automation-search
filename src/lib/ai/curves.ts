import { baselineScores } from "./baseline";
import { encodeRecords } from "./features";
import { forestScores, trainForest } from "./forest";
import { logisticScores, trainLogistic } from "./logistic";
import { mean, metricSet, stdev } from "./metrics";
import { mulberry32, shuffleInPlace } from "./rng";
import { stratifiedSplit } from "./split";
import type { MatchRecord, ModelName } from "./types";

export const LEARNING_SIZES = [50, 100, 200, 300, 500, 700, 800] as const;
export const TREE_COUNTS = [1, 5, 10, 20, 40, 80, 120, 160, 200] as const;

export type CurvePoint = {
  size: number;
  trainAccMean: number;
  trainAccStd: number;
  valAccMean: number;
  valAccStd: number;
  trainF1Mean: number;
  trainF1Std: number;
  valF1Mean: number;
  valF1Std: number;
};

export type Saturation = {
  model: ModelName;
  size: number | null;
  note: string;
};

function subsample(rows: MatchRecord[], n: number, rng: () => number) {
  const copy = shuffleInPlace(rng, [...rows]);
  return copy.slice(0, Math.min(n, copy.length));
}

function scoresFor(name: ModelName, train: MatchRecord[], evalRows: MatchRecord[], seed: number) {
  if (name === "baseline") return baselineScores(evalRows);
  const tr = encodeRecords(train);
  const ev = encodeRecords(evalRows);
  if (name === "logistic") {
    const model = trainLogistic(tr.X, tr.y, tr.names, { iterations: 250 });
    return logisticScores(model, ev.X);
  }
  const model = trainForest(tr.X, tr.y, tr.names, { nTrees: 20, maxDepth: 5, seed });
  return forestScores(model, ev.X);
}

export function learningCurve(
  rows: MatchRecord[],
  name: ModelName,
  repeats = 5,
  seed = 42,
): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (const size of LEARNING_SIZES) {
    const trainAcc: number[] = [];
    const valAcc: number[] = [];
    const trainF1: number[] = [];
    const valF1: number[] = [];
    for (let r = 0; r < repeats; r++) {
      const rng = mulberry32(seed + size * 17 + r * 13);
      const sample = subsample(rows, size, rng);
      const split = stratifiedSplit(sample, 0.2, rng);
      const trScores = scoresFor(name, split.train, split.train, seed + r);
      const vaScores = scoresFor(name, split.train, split.test, seed + r);
      const trY = split.train.map((row) => row.successful_match);
      const vaY = split.test.map((row) => row.successful_match);
      const trM = metricSet(trY, trScores);
      const vaM = metricSet(vaY, vaScores);
      trainAcc.push(trM.accuracy);
      valAcc.push(vaM.accuracy);
      trainF1.push(trM.f1);
      valF1.push(vaM.f1);
    }
    points.push({
      size,
      trainAccMean: mean(trainAcc),
      trainAccStd: stdev(trainAcc),
      valAccMean: mean(valAcc),
      valAccStd: stdev(valAcc),
      trainF1Mean: mean(trainF1),
      trainF1Std: stdev(trainF1),
      valF1Mean: mean(valF1),
      valF1Std: stdev(valF1),
    });
  }
  return points;
}

/** Smallest size after which validation F1 never improves by 1 percentage point or more. */
export function detectSaturation(points: CurvePoint[], model: ModelName): Saturation {
  if (points.length === 0) return { model, size: null, note: "No learning-curve points." };
  for (let i = 0; i < points.length; i++) {
    const base = points[i]!.valF1Mean;
    let laterGain = 0;
    for (let j = i + 1; j < points.length; j++) {
      laterGain = Math.max(laterGain, points[j]!.valF1Mean - base);
    }
    if (i < points.length - 1 && laterGain < 0.01) {
      return {
        model,
        size: points[i]!.size,
        note: `Validation F1 at ${points[i]!.size} records is ${(base * 100).toFixed(1)}%. Later sizes improve it by less than 1 percentage point.`,
      };
    }
  }
  const last = points[points.length - 1]!;
  return {
    model,
    size: null,
    note: `Not saturated: validation F1 was still improving at the largest size tested (${last.size} records, F1 ${(last.valF1Mean * 100).toFixed(1)}%).`,
  };
}

export function forestTreeSweep(rows: MatchRecord[], seed = 42) {
  const { train, test } = stratifiedSplit(rows, 0.2, mulberry32(seed));
  const tr = encodeRecords(train);
  const te = encodeRecords(test);
  return TREE_COUNTS.map((nTrees) => {
    const model = trainForest(tr.X, tr.y, tr.names, { nTrees, maxDepth: 6, seed });
    const val = metricSet(te.y, forestScores(model, te.X));
    const trm = metricSet(tr.y, forestScores(model, tr.X));
    return { nTrees, trainF1: trm.f1, valF1: val.f1, valAccuracy: val.accuracy };
  });
}

export function detectTreeSaturation(points: { nTrees: number; valF1: number }[]) {
  for (let i = 0; i < points.length; i++) {
    const base = points[i]!.valF1;
    let laterGain = 0;
    for (let j = i + 1; j < points.length; j++)
      laterGain = Math.max(laterGain, points[j]!.valF1 - base);
    if (i === points.length - 1 || laterGain < 0.01) {
      return { nTrees: points[i]!.nTrees, f1: base };
    }
  }
  return {
    nTrees: points[points.length - 1]?.nTrees ?? 0,
    f1: points[points.length - 1]?.valF1 ?? 0,
  };
}

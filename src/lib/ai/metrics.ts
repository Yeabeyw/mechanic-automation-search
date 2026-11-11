import type { ConfusionMatrix, MetricSet, RocPoint } from "./types";

export function confusionFromPredictions(yTrue: number[], yPred: number[]): ConfusionMatrix {
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const t = yTrue[i] === 1;
    const p = yPred[i] === 1;
    if (t && p) tp += 1;
    else if (!t && p) fp += 1;
    else if (!t && !p) tn += 1;
    else fn += 1;
  }
  return { tp, fp, tn, fn };
}

export function precisionFromConfusion(c: ConfusionMatrix) {
  const den = c.tp + c.fp;
  return den === 0 ? 0 : c.tp / den;
}

export function recallFromConfusion(c: ConfusionMatrix) {
  const den = c.tp + c.fn;
  return den === 0 ? 0 : c.tp / den;
}

export function f1FromConfusion(c: ConfusionMatrix) {
  const p = precisionFromConfusion(c);
  const r = recallFromConfusion(c);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

export function accuracyFromConfusion(c: ConfusionMatrix) {
  const n = c.tp + c.fp + c.tn + c.fn;
  return n === 0 ? 0 : (c.tp + c.tn) / n;
}

/** Wilcoxon-Mann-Whitney form of ROC-AUC. Ties count as 0.5. */
export function rocAuc(yTrue: number[], scores: number[]) {
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === 1) pos.push(scores[i]!);
    else neg.push(scores[i]!);
  }
  if (pos.length === 0 || neg.length === 0) return 0.5;
  let rankSum = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) rankSum += 1;
      else if (p === n) rankSum += 0.5;
    }
  }
  return rankSum / (pos.length * neg.length);
}

export function rocCurve(yTrue: number[], scores: number[]): RocPoint[] {
  const pairs = yTrue.map((y, i) => ({ y, s: scores[i]! })).sort((a, b) => b.s - a.s);
  const P = pairs.filter((p) => p.y === 1).length;
  const N = pairs.length - P;
  const points: RocPoint[] = [{ fpr: 0, tpr: 0 }];
  let tp = 0;
  let fp = 0;
  for (const pair of pairs) {
    if (pair.y === 1) tp += 1;
    else fp += 1;
    points.push({ fpr: N === 0 ? 0 : fp / N, tpr: P === 0 ? 0 : tp / P });
  }
  return points;
}

export function metricSet(yTrue: number[], scores: number[], threshold = 0.5): MetricSet {
  const yPred = scores.map((s) => (s >= threshold ? 1 : 0));
  const confusion = confusionFromPredictions(yTrue, yPred);
  return {
    accuracy: accuracyFromConfusion(confusion),
    precision: precisionFromConfusion(confusion),
    recall: recallFromConfusion(confusion),
    f1: f1FromConfusion(confusion),
    rocAuc: rocAuc(yTrue, scores),
    confusion,
  };
}

export function mean(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

export function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

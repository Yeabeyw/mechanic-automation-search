import { applyStandardise, standardiseFit } from "./features";
import type { FeatureContribution } from "./types";

export type LogisticModel = {
  kind: "logistic";
  weights: number[];
  bias: number;
  means: number[];
  stds: number[];
  names: string[];
  lossCurve: number[];
  iterations: number;
};

function sigmoid(z: number) {
  if (z >= 20) return 1;
  if (z <= -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function trainLogistic(
  X: number[][],
  y: number[],
  names: string[],
  options?: { lr?: number; iterations?: number; l2?: number },
): LogisticModel {
  const lr = options?.lr ?? 0.15;
  const iterations = options?.iterations ?? 400;
  const l2 = options?.l2 ?? 0.01;
  const { means, stds } = standardiseFit(X);
  const Xs = applyStandardise(X, means, stds);
  const n = Xs.length;
  const d = names.length;
  const weights = Array.from({ length: d }, () => 0);
  let bias = 0;
  const lossCurve: number[] = [];

  for (let iter = 0; iter < iterations; iter++) {
    const gradW = Array.from({ length: d }, () => 0);
    let gradB = 0;
    let loss = 0;
    for (let i = 0; i < n; i++) {
      const row = Xs[i]!;
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j]! * row[j]!;
      const p = sigmoid(z);
      const err = p - y[i]!;
      loss -= y[i]! * Math.log(p + 1e-9) + (1 - y[i]!) * Math.log(1 - p + 1e-9);
      for (let j = 0; j < d; j++) gradW[j]! += err * row[j]!;
      gradB += err;
    }
    for (let j = 0; j < d; j++) {
      gradW[j]! = gradW[j]! / n + l2 * weights[j]!;
      weights[j]! -= lr * gradW[j]!;
    }
    bias -= lr * (gradB / n);
    lossCurve.push(loss / n + (l2 / 2) * weights.reduce((a, w) => a + w * w, 0));
  }

  return { kind: "logistic", weights, bias, means, stds, names, lossCurve, iterations };
}

export function logisticScores(model: LogisticModel, X: number[][]) {
  const Xs = applyStandardise(X, model.means, model.stds);
  return Xs.map((row) => {
    let z = model.bias;
    for (let j = 0; j < row.length; j++) z += model.weights[j]! * row[j]!;
    if (z >= 20) return 1;
    if (z <= -20) return 0;
    return 1 / (1 + Math.exp(-z));
  });
}

export function logisticContributions(model: LogisticModel, x: number[]): FeatureContribution[] {
  const zrow = x.map((v, j) => (v - model.means[j]!) / model.stds[j]!);
  return model.names
    .map((feature, j) => ({
      feature,
      value: x[j]!,
      contribution: model.weights[j]! * zrow[j]!,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

export function logisticImportance(model: LogisticModel) {
  return model.names
    .map((feature, j) => ({ feature, importance: Math.abs(model.weights[j]!) }))
    .sort((a, b) => b.importance - a.importance);
}

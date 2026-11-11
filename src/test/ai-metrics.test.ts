import { describe, expect, it } from "vitest";
import {
  accuracyFromConfusion,
  confusionFromPredictions,
  f1FromConfusion,
  precisionFromConfusion,
  recallFromConfusion,
  rocAuc,
} from "@/lib/ai/metrics";

describe("metric calculations from a known confusion matrix", () => {
  // TP=2, FP=1, FN=1, TN=1  →  accuracy 3/5, precision 2/3, recall 2/3, F1 2/3
  const yTrue = [1, 1, 1, 0, 0];
  const yPred = [1, 1, 0, 1, 0];
  const matrix = confusionFromPredictions(yTrue, yPred);

  it("counts TP/FP/TN/FN", () => {
    expect(matrix).toEqual({ tp: 2, fp: 1, tn: 1, fn: 1 });
  });

  it("computes precision, recall, F1 and accuracy", () => {
    expect(precisionFromConfusion(matrix)).toBeCloseTo(2 / 3, 10);
    expect(recallFromConfusion(matrix)).toBeCloseTo(2 / 3, 10);
    expect(f1FromConfusion(matrix)).toBeCloseTo(2 / 3, 10);
    expect(accuracyFromConfusion(matrix)).toBeCloseTo(3 / 5, 10);
  });

  it("returns 0 precision when there are no predicted positives", () => {
    expect(precisionFromConfusion({ tp: 0, fp: 0, tn: 4, fn: 2 })).toBe(0);
  });

  it("returns 0 F1 when precision and recall are both 0", () => {
    expect(f1FromConfusion({ tp: 0, fp: 3, tn: 2, fn: 1 })).toBe(0);
  });

  it("computes ROC-AUC for a perfect ranking", () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9])).toBe(1);
  });
});

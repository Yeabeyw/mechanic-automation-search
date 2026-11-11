import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectSaturation, detectTreeSaturation, forestTreeSweep, learningCurve } from "@/lib/ai/curves";
import { classBalance, generateSyntheticRecords, recordsToCsv } from "@/lib/ai/dataset";
import { compactMetrics, trainAllModels } from "@/lib/ai/train";
import { DISTRICTS } from "@/lib/ai/types";

describe("AutoHelp D1–D4 training pipeline", () => {
  it(
    "generates 1000 seeded records, trains models, and writes artifacts",
    () => {
      const records = generateSyntheticRecords(1000, 42);
      expect(records).toHaveLength(1000);
      expect(new Set(records.map((r) => r.district)).size).toBe(DISTRICTS.length);
      expect(records.every((r) => r.is_synthetic)).toBe(true);
      const balance = classBalance(records);
      expect(balance.positives + balance.negatives).toBe(1000);
      expect(balance.positiveRate).toBeGreaterThan(0.4);
      expect(balance.positiveRate).toBeLessThan(0.85);

      const root = path.resolve(import.meta.dirname, "../..");
      const csv = recordsToCsv(records);
      writeFileSync(path.join(root, "AutoHelp_D1_Dataset.csv"), csv);
      mkdirSync(path.join(root, "public"), { recursive: true });
      writeFileSync(path.join(root, "public", "AutoHelp_D1_Dataset.csv"), csv);
      writeFileSync(path.join(root, "src", "lib", "ai", "generated-records.json"), JSON.stringify(records));

      const bundle = trainAllModels(records, 42);
      expect(bundle.datasetSize).toBe(1000);
      expect(bundle.testSize).toBeGreaterThan(150);
      for (const name of ["baseline", "logistic", "forest"] as const) {
        const m = bundle.models[name].metrics;
        expect(m.accuracy).toBeGreaterThan(0);
        expect(m.accuracy).toBeLessThanOrEqual(1);
        expect(m.confusion.tp + m.confusion.fp + m.confusion.tn + m.confusion.fn).toBe(bundle.testSize);
      }

      const curves = {
        baseline: learningCurve(records, "baseline", 5, 42),
        logistic: learningCurve(records, "logistic", 5, 42),
        forest: learningCurve(records, "forest", 5, 42),
      };
      const saturation = {
        baseline: detectSaturation(curves.baseline, "baseline"),
        logistic: detectSaturation(curves.logistic, "logistic"),
        forest: detectSaturation(curves.forest, "forest"),
      };
      const treeSweep = forestTreeSweep(records, 42);
      const treeSat = detectTreeSaturation(treeSweep);

      const artifact = {
        recordsMeta: {
          n: records.length,
          ...balance,
          districts: Object.fromEntries(
            DISTRICTS.map((d) => [d, records.filter((r) => r.district === d).length]),
          ),
        },
        bundle: {
          ...bundle,
          models: {
            ...bundle.models,
            baseline: { ...bundle.models.baseline, metrics: compactMetrics(bundle.models.baseline.metrics) },
            logistic: { ...bundle.models.logistic, metrics: compactMetrics(bundle.models.logistic.metrics) },
            forest: { ...bundle.models.forest, metrics: compactMetrics(bundle.models.forest.metrics) },
          },
        },
        curves,
        saturation,
        treeSweep,
        treeSat,
        logisticLoss: bundle.models.logistic.model.lossCurve,
      };

      writeFileSync(path.join(root, "src", "lib", "ai", "trained-artifact.json"), JSON.stringify(artifact));
      writeFileSync(path.join(root, "public", "AutoHelp_D2_metrics.json"), JSON.stringify({
        bestModel: bundle.bestModel,
        testSize: bundle.testSize,
        trainSize: bundle.trainSize,
        trainingMs: bundle.trainingMs,
        trainedAt: bundle.trainedAt,
        metrics: {
          baseline: compactMetrics(bundle.models.baseline.metrics),
          logistic: compactMetrics(bundle.models.logistic.metrics),
          forest: compactMetrics(bundle.models.forest.metrics),
        },
        cvF1: {
          baseline: bundle.models.baseline.cvF1,
          logistic: bundle.models.logistic.cvF1,
          forest: bundle.models.forest.cvF1,
        },
        saturation,
        treeSat,
      }, null, 2));

      expect(artifact.curves.forest.length).toBe(7);
      expect(treeSweep[0]?.nTrees).toBe(1);
    },
    180_000,
  );
});

import { baselineScores } from "./baseline";
import { encodeRecords } from "./features";
import { forestImportance, forestScores, trainForest, type ForestModel } from "./forest";
import { logisticImportance, logisticScores, trainLogistic, type LogisticModel } from "./logistic";
import { mean, metricSet, rocCurve, round4 } from "./metrics";
import { stratifiedKFold, stratifiedSplit } from "./split";
import { mulberry32 } from "./rng";
import type { MatchRecord, MetricSet, ModelName, RocPoint } from "./types";

export type TrainedBundle = {
  trainedAt: string;
  trainingMs: number;
  datasetSize: number;
  seed: number;
  testSize: number;
  trainSize: number;
  models: {
    baseline: { metrics: MetricSet; cvF1: number[]; roc: RocPoint[] };
    logistic: { metrics: MetricSet; cvF1: number[]; roc: RocPoint[]; model: LogisticModel; importance: { feature: string; importance: number }[] };
    forest: { metrics: MetricSet; cvF1: number[]; roc: RocPoint[]; model: ForestModel; importance: { feature: string; importance: number }[] };
  };
  bestModel: ModelName;
};

function pickBest(bundle: TrainedBundle["models"]): ModelName {
  const scores: { name: ModelName; f1: number; auc: number }[] = [
    { name: "baseline", f1: bundle.baseline.metrics.f1, auc: bundle.baseline.metrics.rocAuc },
    { name: "logistic", f1: bundle.logistic.metrics.f1, auc: bundle.logistic.metrics.rocAuc },
    { name: "forest", f1: bundle.forest.metrics.f1, auc: bundle.forest.metrics.rocAuc },
  ];
  scores.sort((a, b) => b.f1 - a.f1 || b.auc - a.auc);
  return scores[0]!.name;
}

export function trainAllModels(rows: MatchRecord[], seed = 42): TrainedBundle {
  const started = Date.now();
  const rng = mulberry32(seed);
  const { train, test } = stratifiedSplit(rows, 0.2, rng);
  const folds = stratifiedKFold(train, 5, mulberry32(seed + 1));

  const testEnc = encodeRecords(test);

  const baseTestScores = baselineScores(test);
  const baseMetrics = metricSet(testEnc.y, baseTestScores);
  const baseCv = folds.map((fold) => metricSet(fold.test.map((r) => r.successful_match), baselineScores(fold.test)).f1);

  const cvLog: number[] = [];
  const cvRf: number[] = [];
  for (const fold of folds) {
    const tr = encodeRecords(fold.train);
    const te = encodeRecords(fold.test);
    const lr = trainLogistic(tr.X, tr.y, tr.names, { iterations: 250 });
    cvLog.push(metricSet(te.y, logisticScores(lr, te.X)).f1);
    const rf = trainForest(tr.X, tr.y, tr.names, { nTrees: 20, maxDepth: 5, seed: seed + 9 });
    cvRf.push(metricSet(te.y, forestScores(rf, te.X)).f1);
  }

  const trainEnc = encodeRecords(train);
  const logistic = trainLogistic(trainEnc.X, trainEnc.y, trainEnc.names, { iterations: 400 });
  const logScores = logisticScores(logistic, testEnc.X);
  const logMetrics = metricSet(testEnc.y, logScores);

  const forest = trainForest(trainEnc.X, trainEnc.y, trainEnc.names, { nTrees: 40, maxDepth: 6, seed: seed + 3 });
  const rfScores = forestScores(forest, testEnc.X);
  const rfMetrics = metricSet(testEnc.y, rfScores);

  const models: TrainedBundle["models"] = {
    baseline: { metrics: baseMetrics, cvF1: baseCv, roc: rocCurve(testEnc.y, baseTestScores) },
    logistic: {
      metrics: logMetrics,
      cvF1: cvLog,
      roc: rocCurve(testEnc.y, logScores),
      model: logistic,
      importance: logisticImportance(logistic),
    },
    forest: {
      metrics: rfMetrics,
      cvF1: cvRf,
      roc: rocCurve(testEnc.y, rfScores),
      model: forest,
      importance: forestImportance(forest),
    },
  };

  return {
    trainedAt: new Date().toISOString(),
    trainingMs: Date.now() - started,
    datasetSize: rows.length,
    seed,
    testSize: test.length,
    trainSize: train.length,
    models,
    bestModel: pickBest(models),
  };
}

export function compactMetrics(m: MetricSet) {
  return {
    accuracy: round4(m.accuracy),
    precision: round4(m.precision),
    recall: round4(m.recall),
    f1: round4(m.f1),
    rocAuc: round4(m.rocAuc),
    confusion: m.confusion,
  };
}

export function cvSummary(values: number[]) {
  return { mean: round4(mean(values)), values: values.map(round4) };
}

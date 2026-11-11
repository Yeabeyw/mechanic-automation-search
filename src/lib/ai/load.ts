import recordsJson from "./generated-records.json";
import artifactJson from "./trained-artifact.json";
import type { MatchRecord } from "./types";
import type { TrainedBundle } from "./train";
import type { CurvePoint, Saturation } from "./curves";

export type AiArtifact = {
  recordsMeta: {
    n: number;
    positives: number;
    negatives: number;
    positiveRate: number;
    synthetic: number;
    real: number;
    districts: Record<string, number>;
  };
  bundle: TrainedBundle;
  curves: Record<string, CurvePoint[]>;
  saturation: Record<string, Saturation>;
  treeSweep: { nTrees: number; trainF1: number; valF1: number; valAccuracy: number }[];
  treeSat: { nTrees: number; f1: number };
  logisticLoss: number[];
};

export function bundledRecords(): MatchRecord[] {
  return recordsJson as MatchRecord[];
}

export function bundledArtifact(): AiArtifact {
  return artifactJson as unknown as AiArtifact;
}

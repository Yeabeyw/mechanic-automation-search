import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/integrations/firebase/client";
import { publishAiDataset, publishAiModels } from "@/lib/firebase-data";
import type { MatchRecord } from "./types";
import type { TrainedBundle } from "./train";

export async function loadFirestoreDataset(): Promise<MatchRecord[] | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "ai_dataset", "current"));
    if (!snap.exists()) return null;
    const records = snap.data()["records"];
    return Array.isArray(records) ? (records as MatchRecord[]) : null;
  } catch {
    return null;
  }
}

export async function loadFirestoreModels(): Promise<TrainedBundle | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "ai_models", "latest"));
    if (!snap.exists()) return null;
    const bundle = snap.data()["bundle"];
    return bundle ? (bundle as TrainedBundle) : null;
  } catch {
    return null;
  }
}

export async function saveDatasetToFirestore(records: MatchRecord[]) {
  return publishAiDataset({
    records,
    n_synthetic: records.filter((r) => r.is_synthetic).length,
    n_real: records.filter((r) => !r.is_synthetic).length,
  });
}

export async function saveModelsToFirestore(bundle: TrainedBundle) {
  return publishAiModels({
    bundle,
    dataset_size: bundle.datasetSize,
    trained_at: bundle.trainedAt,
    best_model: bundle.bestModel,
  });
}

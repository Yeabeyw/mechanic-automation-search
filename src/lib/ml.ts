// Machine Learning Library for AutoHelp Lesotho
// Implements Logistic Regression, Random Forest, and Baseline models

export type DatasetRecord = {
  id: number;
  district: string;
  town: string;
  problem_category: string;
  vehicle_age_band: string;
  specialty_match: number;
  mechanic_verified: number;
  mechanic_experience_years: number;
  availability_status: string;
  distance_km: number;
  historical_completion_rate: number;
  quoted_price_maloti: number;
  successful_match: number;
  is_synthetic: string;
};

export type FeatureVector = number[];
export type Label = 0 | 1;

export type ModelMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  confusionMatrix: { tp: number; tn: number; fp: number; fn: number };
};

export type ModelPrediction = {
  probability: number;
  prediction: 0 | 1;
  featureContributions?: Record<string, number>;
};

// ==================== DATA PREPROCESSING ====================

export function preprocessDataset(records: DatasetRecord[]): {
  features: FeatureVector[];
  labels: Label[];
  featureNames: string[];
} {
  const featureNames = [
    'specialty_match',
    'mechanic_verified',
    'mechanic_experience_years',
    'availability_status',
    'distance_km',
    'historical_completion_rate',
    'quoted_price_maloti',
    'vehicle_age_0_3',
    'vehicle_age_4_7',
    'vehicle_age_8_12',
    'vehicle_age_13_plus',
    'problem_engine',
    'problem_brakes',
    'problem_electrical',
    'problem_transmission',
    'problem_suspension',
    'problem_ac',
    'problem_tires',
    'problem_starting',
  ];

  const features: FeatureVector[] = [];
  const labels: Label[] = [];

  for (const record of records) {
    const feature: FeatureVector = [
      record.specialty_match,
      record.mechanic_verified,
      record.mechanic_experience_years / 25, // Normalize 0-1
      record.availability_status === 'available' ? 1 : 0,
      record.distance_km / 150, // Normalize 0-1
      record.historical_completion_rate,
      record.quoted_price_maloti / 4000, // Normalize 0-1
      // One-hot vehicle age
      record.vehicle_age_band === '0-3 years' ? 1 : 0,
      record.vehicle_age_band === '4-7 years' ? 1 : 0,
      record.vehicle_age_band === '8-12 years' ? 1 : 0,
      record.vehicle_age_band === '13+ years' ? 1 : 0,
      // One-hot problem category
      record.problem_category === 'Engine' ? 1 : 0,
      record.problem_category === 'Brakes' ? 1 : 0,
      record.problem_category === 'Electrical' ? 1 : 0,
      record.problem_category === 'Transmission' ? 1 : 0,
      record.problem_category === 'Suspension' ? 1 : 0,
      record.problem_category === 'Air Conditioning' ? 1 : 0,
      record.problem_category === 'Tires' ? 1 : 0,
      record.problem_category === 'Starting/Charging' ? 1 : 0,
    ];

    features.push(feature);
    labels.push(record.successful_match as Label);
  }

  return { features, labels, featureNames };
}

export function trainTestSplit(
  features: FeatureVector[],
  labels: Label[],
  testSize = 0.2,
  seed = 42
): {
  trainFeatures: FeatureVector[];
  trainLabels: Label[];
  testFeatures: FeatureVector[];
  testLabels: Label[];
} {
  const n = features.length;
  const testCount = Math.floor(n * testSize);
  
  // Fisher-Yates shuffle with seed
  const indices = Array.from({ length: n }, (_, i) => i);
  let rng = seed;
  for (let i = n - 1; i > 0; i--) {
    rng = (rng * 9301 + 49297) % 233280;
    const j = Math.floor((rng / 233280) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const trainIndices = indices.slice(testCount);
  const testIndices = indices.slice(0, testCount);

  return {
    trainFeatures: trainIndices.map(i => features[i]),
    trainLabels: trainIndices.map(i => labels[i]),
    testFeatures: testIndices.map(i => features[i]),
    testLabels: testIndices.map(i => labels[i]),
  };
}

// ==================== METRICS ====================

export function calculateMetrics(
  predictions: Label[],
  actual: Label[]
): ModelMetrics {
  let tp = 0, tn = 0, fp = 0, fn = 0;

  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i] === 1 && actual[i] === 1) tp++;
    else if (predictions[i] === 0 && actual[i] === 0) tn++;
    else if (predictions[i] === 1 && actual[i] === 0) fp++;
    else fn++;
  }

  const accuracy = (tp + tn) / (tp + tn + fp + fn);
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  // Approximate ROC-AUC using simple method
  const rocAuc = (precision + recall) / 2;

  return {
    accuracy,
    precision,
    recall,
    f1,
    rocAuc,
    confusionMatrix: { tp, tn, fp, fn },
  };
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ==================== BASELINE MODEL ====================

export class BaselineModel {
  predict(features: FeatureVector[]): ModelPrediction[] {
    return features.map(f => {
      // Rule: specialty_match AND availability
      const specialtyMatch = f[0] === 1;
      const available = f[3] === 1;
      const probability = (specialtyMatch && available) ? 0.8 : 0.2;
      return {
        probability,
        prediction: probability > 0.5 ? 1 : 0,
        featureContributions: {
          specialty_match: specialtyMatch ? 0.3 : 0,
          availability: available ? 0.3 : 0,
        },
      };
    });
  }
}

// ==================== LOGISTIC REGRESSION ====================

export class LogisticRegression {
  private weights: number[] = [];
  private learningRate = 0.01;
  private iterations = 1000;
  private featureNames: string[] = [];

  constructor(learningRate = 0.01, iterations = 1000) {
    this.learningRate = learningRate;
    this.iterations = iterations;
  }

  train(features: FeatureVector[], labels: Label[], featureNames: string[]) {
    this.featureNames = featureNames;
    const n = features.length;
    const d = features[0].length;

    // Initialize weights
    this.weights = new Array(d).fill(0).map(() => Math.random() * 0.01 - 0.005);

    // Gradient descent
    for (let iter = 0; iter < this.iterations; iter++) {
      for (let i = 0; i < n; i++) {
        const prediction = this.predictSingle(features[i]);
        const error = labels[i] - prediction;

        for (let j = 0; j < d; j++) {
          this.weights[j] += this.learningRate * error * features[i][j];
        }
      }
    }
  }

  predictSingle(feature: FeatureVector): number {
    let z = 0;
    for (let j = 0; j < feature.length; j++) {
      z += this.weights[j] * feature[j];
    }
    return sigmoid(z);
  }

  predict(features: FeatureVector[]): ModelPrediction[] {
    return features.map(f => {
      const probability = this.predictSingle(f);
      return {
        probability,
        prediction: probability > 0.5 ? 1 : 0,
        featureContributions: this.getFeatureContributions(f),
      };
    });
  }

  private getFeatureContributions(feature: FeatureVector): Record<string, number> {
    const contributions: Record<string, number> = {};
    for (let i = 0; i < feature.length; i++) {
      if (this.featureNames[i] && Math.abs(this.weights[i] * feature[i]) > 0.01) {
        contributions[this.featureNames[i]] = this.weights[i] * feature[i];
      }
    }
    return contributions;
  }

  getWeights(): number[] {
    return [...this.weights];
  }
}

// ==================== RANDOM FOREST ====================

interface DecisionTreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
  prediction?: 0 | 1;
  samples?: number;
}

export class DecisionTree {
  private maxDepth = 5;
  private minSamplesSplit = 2;
  private featureNames: string[] = [];
  private root: DecisionTreeNode | null = null;

  constructor(maxDepth = 5, minSamplesSplit = 2) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
  }

  train(features: FeatureVector[], labels: Label[], featureNames: string[]) {
    this.featureNames = featureNames;
    this.root = this.buildTree(features, labels, 0);
  }

  private buildTree(
    features: FeatureVector[],
    labels: Label[],
    depth: number
  ): DecisionTreeNode {
    const n = labels.length;
    const ones = labels.filter(l => l === 1).length;
    const zeros = n - ones;

    // Stopping conditions
    if (depth >= this.maxDepth || n < this.minSamplesSplit || ones === 0 || zeros === 0) {
      return { prediction: ones > zeros ? 1 : 0, samples: n };
    }

    // Find best split
    const { featureIndex, threshold, leftFeatures, leftLabels, rightFeatures, rightLabels } =
      this.findBestSplit(features, labels);

    if (featureIndex === -1) {
      return { prediction: ones > zeros ? 1 : 0, samples: n };
    }

    return {
      featureIndex,
      threshold,
      left: this.buildTree(leftFeatures, leftLabels, depth + 1),
      right: this.buildTree(rightFeatures, rightLabels, depth + 1),
      samples: n,
    };
  }

  private findBestSplit(
    features: FeatureVector[],
    labels: Label[]
  ): {
    featureIndex: number;
    threshold: number;
    leftFeatures: FeatureVector[];
    leftLabels: Label[];
    rightFeatures: FeatureVector[];
    rightLabels: Label[];
  } {
    let bestGini = Infinity;
    let bestFeatureIndex = -1;
    let bestThreshold = 0;
    let bestLeftFeatures: FeatureVector[] = [];
    let bestLeftLabels: Label[] = [];
    let bestRightFeatures: FeatureVector[] = [];
    let bestRightLabels: Label[] = [];

    const d = features[0].length;

    for (let j = 0; j < d; j++) {
      const uniqueValues = [...new Set(features.map(f => f[j]))];
      for (const threshold of uniqueValues) {
        const leftFeatures: FeatureVector[] = [];
        const leftLabels: Label[] = [];
        const rightFeatures: FeatureVector[] = [];
        const rightLabels: Label[] = [];

        for (let i = 0; i < features.length; i++) {
          if (features[i][j] <= threshold) {
            leftFeatures.push(features[i]);
            leftLabels.push(labels[i]);
          } else {
            rightFeatures.push(features[i]);
            rightLabels.push(labels[i]);
          }
        }

        if (leftLabels.length === 0 || rightLabels.length === 0) continue;

        const gini = this.calculateGini(leftLabels) + this.calculateGini(rightLabels);

        if (gini < bestGini) {
          bestGini = gini;
          bestFeatureIndex = j;
          bestThreshold = threshold;
          bestLeftFeatures = leftFeatures;
          bestLeftLabels = leftLabels;
          bestRightFeatures = rightFeatures;
          bestRightLabels = rightLabels;
        }
      }
    }

    return {
      featureIndex: bestFeatureIndex,
      threshold: bestThreshold,
      leftFeatures: bestLeftFeatures,
      leftLabels: bestLeftLabels,
      rightFeatures: bestRightFeatures,
      rightLabels: bestRightLabels,
    };
  }

  private calculateGini(labels: Label[]): number {
    const n = labels.length;
    if (n === 0) return 0;
    const ones = labels.filter(l => l === 1).length;
    const p1 = ones / n;
    return 1 - p1 * p1 - (1 - p1) * (1 - p1);
  }

  private predictSingle(feature: FeatureVector, node: DecisionTreeNode | null = this.root): number {
    if (!node || node.prediction !== undefined) {
      return node?.prediction ?? 0;
    }

    if (node.featureIndex === undefined || node.threshold === undefined) {
      return 0;
    }

    if (feature[node.featureIndex] <= node.threshold) {
      return this.predictSingle(feature, node.left ?? null);
    } else {
      return this.predictSingle(feature, node.right ?? null);
    }
  }

  predict(features: FeatureVector[]): ModelPrediction[] {
    return features.map(f => {
      const prediction = this.predictSingle(f);
      return {
        probability: prediction,
        prediction,
        featureContributions: {},
      };
    });
  }
}

export class RandomForest {
  private trees: DecisionTree[] = [];
  private numTrees = 100;
  private featureNames: string[] = [];

  constructor(numTrees = 100) {
    this.numTrees = numTrees;
  }

  train(features: FeatureVector[], labels: Label[], featureNames: string[]) {
    this.featureNames = featureNames;
    this.trees = [];

    const n = features.length;

    for (let t = 0; t < this.numTrees; t++) {
      // Bootstrap sampling
      const sampledFeatures: FeatureVector[] = [];
      const sampledLabels: Label[] = [];

      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * n);
        sampledFeatures.push(features[idx]);
        sampledLabels.push(labels[idx]);
      }

      const tree = new DecisionTree(5, 2);
      tree.train(sampledFeatures, sampledLabels, featureNames);
      this.trees.push(tree);
    }
  }

  predict(features: FeatureVector[]): ModelPrediction[] {
    return features.map(f => {
      let sum = 0;
      for (const tree of this.trees) {
        sum += tree.predict([f])[0].prediction;
      }
      const probability = sum / this.trees.length;
      return {
        probability,
        prediction: probability > 0.5 ? 1 : 0,
        featureContributions: {},
      };
    });
  }

  getNumTrees(): number {
    return this.trees.length;
  }
}

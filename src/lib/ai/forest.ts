import { mulberry32, randInt } from "./rng";

export type TreeNode =
  | { t: "leaf"; v: number }
  | { t: "split"; f: number; th: number; l: TreeNode; r: TreeNode };

export type ForestModel = {
  kind: "forest";
  trees: TreeNode[];
  names: string[];
  nTrees: number;
  maxDepth: number;
};

type Sample = { x: number[]; y: number };

function gini(rows: Sample[]) {
  if (rows.length === 0) return 0;
  let p = 0;
  for (const r of rows) p += r.y;
  p /= rows.length;
  return 2 * p * (1 - p);
}

function leafValue(rows: Sample[]) {
  if (rows.length === 0) return 0.5;
  return rows.reduce((a, r) => a + r.y, 0) / rows.length;
}

function thresholds(values: number[]) {
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  if (uniq.length <= 12) {
    const out: number[] = [];
    for (let i = 0; i < uniq.length - 1; i++) out.push((uniq[i]! + uniq[i + 1]!) / 2);
    return out;
  }
  const qs: number[] = [];
  for (let q = 1; q <= 11; q++) {
    const idx = Math.floor((q / 12) * (uniq.length - 1));
    qs.push(uniq[idx]!);
  }
  return [...new Set(qs)];
}

function grow(rows: Sample[], depth: number, maxDepth: number, minLeaf: number, rng: () => number): TreeNode {
  const majority = leafValue(rows);
  if (depth >= maxDepth || rows.length < minLeaf * 2 || gini(rows) < 0.02) {
    return { t: "leaf", v: majority };
  }
  const nFeat = rows[0]!.x.length;
  const nTry = Math.max(2, Math.round(Math.sqrt(nFeat)));
  const features: number[] = [];
  while (features.length < nTry) {
    const f = randInt(rng, 0, nFeat - 1);
    if (!features.includes(f)) features.push(f);
  }
  let bestGain = 0;
  let bestF = 0;
  let bestTh = 0;
  let bestL: Sample[] = [];
  let bestR: Sample[] = [];
  const parent = gini(rows);
  for (const f of features) {
    for (const th of thresholds(rows.map((r) => r.x[f]!))) {
      const left: Sample[] = [];
      const right: Sample[] = [];
      for (const row of rows) (row.x[f]! <= th ? left : right).push(row);
      if (left.length < minLeaf || right.length < minLeaf) continue;
      const gain = parent - (left.length / rows.length) * gini(left) - (right.length / rows.length) * gini(right);
      if (gain > bestGain) {
        bestGain = gain;
        bestF = f;
        bestTh = th;
        bestL = left;
        bestR = right;
      }
    }
  }
  if (bestGain < 1e-4) return { t: "leaf", v: majority };
  return {
    t: "split",
    f: bestF,
    th: bestTh,
    l: grow(bestL, depth + 1, maxDepth, minLeaf, rng),
    r: grow(bestR, depth + 1, maxDepth, minLeaf, rng),
  };
}

function walk(node: TreeNode, x: number[]): number {
  if (node.t === "leaf") return node.v;
  return x[node.f]! <= node.th ? walk(node.l, x) : walk(node.r, x);
}

export function trainForest(
  X: number[][],
  y: number[],
  names: string[],
  options?: { nTrees?: number; maxDepth?: number; minLeaf?: number; seed?: number },
): ForestModel {
  const nTrees = options?.nTrees ?? 40;
  const maxDepth = options?.maxDepth ?? 6;
  const minLeaf = options?.minLeaf ?? 6;
  const rng = mulberry32(options?.seed ?? 7);
  const samples: Sample[] = X.map((x, i) => ({ x, y: y[i]! }));
  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    const bag: Sample[] = [];
    for (let i = 0; i < samples.length; i++) bag.push(samples[randInt(rng, 0, samples.length - 1)]!);
    trees.push(grow(bag, 0, maxDepth, minLeaf, rng));
  }
  return { kind: "forest", trees, names, nTrees, maxDepth };
}

export function forestScores(model: ForestModel, X: number[][]) {
  return X.map((x) => {
    let s = 0;
    for (const tree of model.trees) s += walk(tree, x);
    return s / model.trees.length;
  });
}

function addImportance(node: TreeNode, acc: number[]) {
  if (node.t === "leaf") return;
  acc[node.f]! += 1;
  addImportance(node.l, acc);
  addImportance(node.r, acc);
}

export function forestImportance(model: ForestModel) {
  const acc = Array.from({ length: model.names.length }, () => 0);
  for (const tree of model.trees) addImportance(tree, acc);
  const total = acc.reduce((a, b) => a + b, 0) || 1;
  return model.names
    .map((feature, i) => ({ feature, importance: acc[i]! / total }))
    .sort((a, b) => b.importance - a.importance);
}

export function forestContributions(model: ForestModel, x: number[]) {
  const score = forestScores(model, [x])[0]!;
  return model.names
    .map((feature, j) => {
      const perturbed = x.map((v, i) => (i === j ? 0 : v));
      const dropped = forestScores(model, [perturbed])[0]!;
      return { feature, value: x[j]!, contribution: score - dropped };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

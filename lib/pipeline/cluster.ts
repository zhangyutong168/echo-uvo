import type { CleanFeedback } from "../types";

export interface KMeansResult {
  /** cluster index per input row. */
  assignments: number[];
  /** Sum of squared distances to centroids (for elbow). */
  inertia: number;
  /** Mean silhouette score (-1..1) computed on a sample for speed. */
  silhouette: number;
  k: number;
}

/** Cosine distance = 1 - cos_sim, for L2-normalized vectors. */
function cosDist(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return 1 - dot;
}

/** L2-normalize rows in place-ish (returns normalized copy). */
export function normalizeRows(vectors: Float32Array[]): Float32Array[] {
  return vectors.map((v) => {
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    const out = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
  });
}

/** KMeans with k-means++ init and several restarts; cosine distance. */
export function kmeans(
  vectors: Float32Array[],
  k: number,
  seed = 42,
  iterations = 25,
): KMeansResult {
  const n = vectors.length;
  if (n === 0 || k <= 0) return { assignments: [], inertia: 0, silhouette: 0, k };
  const kEff = Math.min(k, n);
  const rand = mulberry32(seed);
  const dims = vectors[0].length;

  let best: { assignments: number[]; inertia: number } | null = null;
  const restarts = 3;

  for (let r = 0; r < restarts; r++) {
    const centroids = kmeansPlusPlus(vectors, kEff, rand);
    const assignments = new Array<number>(n).fill(0);

    for (let it = 0; it < iterations; it++) {
      let moved = false;
      // Assignment step
      for (let i = 0; i < n; i++) {
        let bestC = 0;
        let bestD = Infinity;
        for (let c = 0; c < kEff; c++) {
          const d = cosDist(vectors[i], centroids[c]);
          if (d < bestD) {
            bestD = d;
            bestC = c;
          }
        }
        if (assignments[i] !== bestC) moved = true;
        assignments[i] = bestC;
      }
      // Update step
      const sums: Float64Array[] = Array.from({ length: kEff }, () => new Float64Array(dims));
      const counts = new Array<number>(kEff).fill(0);
      for (let i = 0; i < n; i++) {
        const c = assignments[i];
        counts[c]++;
        const v = vectors[i];
        const s = sums[c];
        for (let d = 0; d < dims; d++) s[d] += v[d];
      }
      for (let c = 0; c < kEff; c++) {
        if (counts[c] === 0) {
          // Re-seed dead centroid at the farthest point.
          let far = 0;
          let farD = -1;
          for (let i = 0; i < n; i++) {
            const d = cosDist(vectors[i], centroids[c]);
            if (d > farD) {
              farD = d;
              far = i;
            }
          }
          centroids[c] = Float32Array.from(vectors[far]);
        } else {
          const cent = centroids[c];
          const s = sums[c];
          let norm = 0;
          for (let d = 0; d < dims; d++) {
            cent[d] = s[d] / counts[c];
            norm += cent[d] * cent[d];
          }
          norm = Math.sqrt(norm) || 1;
          for (let d = 0; d < dims; d++) cent[d] /= norm;
        }
      }
      if (!moved) break;
    }

    let inertia = 0;
    for (let i = 0; i < n; i++) {
      inertia += cosDist(vectors[i], centroids[assignments[i]]) ** 2;
    }
    if (!best || inertia < best.inertia) {
      best = { assignments: Array.from(assignments), inertia };
    }
  }

  const assignments = best!.assignments;
  const silhouette = sampleSilhouette(vectors, assignments, kEff);
  return { assignments, inertia: best!.inertia, silhouette, k: kEff };
}

/**
 * Choose k automatically: elbow on inertia via max second-difference,
 * bounded by a silhouette sanity check when feasible.
 */
export function chooseK(n: number, inertias: number[]): number {
  const ks = inertias.map((_, idx) => idx + 2); // k = 2..len+1
  let bestK = ks[0];
  let bestScore = -Infinity;
  for (let i = 0; i < inertias.length; i++) {
    const prev = i > 0 ? inertias[i - 1] : inertias[0];
    const next = i < inertias.length - 1 ? inertias[i + 1] : inertias[inertias.length - 1];
    // Second-difference elbow score: how sharp the bend is here.
    const score = (prev - inertias[i]) - (inertias[i] - next);
    // Slight preference for smaller k to avoid fragmentation.
    const penalized = score - i * 0.01;
    if (penalized > bestScore) {
      bestScore = penalized;
      bestK = ks[i];
    }
  }
  return Math.min(bestK, Math.max(2, Math.min(12, Math.ceil(n / 8))));
}

function kmeansPlusPlus(
  vectors: Float32Array[],
  k: number,
  rand: () => number,
): Float32Array[] {
  const n = vectors.length;
  const centroids: Float32Array[] = [];
  centroids.push(Float32Array.from(vectors[Math.floor(rand() * n)]));
  const dists = new Float64Array(n).fill(Infinity);

  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = cosDist(vectors[i], last);
      dists[i] = Math.min(dists[i], d);
      sum += dists[i] * dists[i];
    }
    let target = rand() * sum;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      target -= dists[i] * dists[i];
      if (target <= 0) {
        pick = i;
        break;
      }
    }
    centroids.push(Float32Array.from(vectors[pick]));
  }
  return centroids;
}

/** Silhouette on a random sample (max 400 points) for speed. */
function sampleSilhouette(
  vectors: Float32Array[],
  assignments: number[],
  k: number,
): number {
  const n = vectors.length;
  if (n < 3 || k < 2) return 0;
  const stride = Math.max(1, Math.ceil(n / 400));
  const idx: number[] = [];
  for (let i = 0; i < n; i += stride) idx.push(i);

  let total = 0;
  let count = 0;
  for (const i of idx) {
    const ci = assignments[i];
    const same: number[] = [];
    const others = new Map<number, number[]>();
    for (const j of idx) {
      if (j === i) continue;
      if (assignments[j] === ci) same.push(j);
      else {
        if (!others.has(assignments[j])) others.set(assignments[j], []);
        others.get(assignments[j])!.push(j);
      }
    }
    if (same.length === 0 || others.size === 0) continue;
    const a =
      same.reduce((s, j) => s + cosDist(vectors[i], vectors[j]), 0) / same.length;
    let b = Infinity;
    for (const [, js] of others) {
      const m =
        js.reduce((s, j) => s + cosDist(vectors[i], vectors[j]), 0) / js.length;
      if (m < b) b = m;
    }
    total += (b - a) / Math.max(a, b);
    count++;
  }
  return count > 0 ? total / count : 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Representative items: closest to centroid per cluster (medoids). */
export function representativeItems(
  vectors: Float32Array[],
  items: CleanFeedback[],
  assignments: number[],
  k: number,
  perCluster = 3,
): string[][] {
  const out: string[][] = Array.from({ length: k }, () => []);
  const dims = vectors[0]?.length ?? 0;
  for (let c = 0; c < k; c++) {
    const members = items
      .map((item, i) => ({ item, i }))
      .filter(({ i }) => assignments[i] === c);
    if (members.length === 0) continue;
    // Medoid = member minimizing mean distance to other members (cap 60 for speed).
    const pool = members.slice(0, 60);
    let bestIdx = pool[0].i;
    let bestScore = Infinity;
    for (const cand of pool) {
      let s = 0;
      for (const other of pool) {
        if (other.i === cand.i) continue;
        s += cosDist(vectors[cand.i], vectors[other.i]);
      }
      if (s < bestScore) {
        bestScore = s;
        bestIdx = cand.i;
      }
    }
    // Quotes: medoid + up to perCluster-1 random members (varied voices).
    const quotes = [items[bestIdx].id];
    const rest = members.filter((m) => m.item.id !== items[bestIdx].id);
    shuffleInPlace(rest, mulberry32(7));
    for (const m of rest) {
      if (quotes.length >= perCluster) break;
      quotes.push(m.item.id);
    }
    out[c] = quotes;
    void dims;
  }
  return out;
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

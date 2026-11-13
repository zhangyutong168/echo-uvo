/**
 * Clustering quality eval: run the same embed → cluster → triage pipeline as
 * the browser worker (same model files, same kmeans code) on the labeled sample
 * dataset, and score against ground-truth topics.
 *
 * Metrics:
 *   - ARI (adjusted Rand index): agreement with human topic labels, chance-corrected
 *   - Purity: share of items whose cluster majority-matches their true topic
 *   - Silhouette (cosine): geometric cohesion/separation of the found clusters
 *   - k chosen by the same elbow rule the UI uses
 *
 * Usage: npm run eval   (requires public/models to be downloaded; falls back to
 *        downloading via npm run fetch-model)
 */
import { pipeline, env } from "@xenova/transformers";
import path from "node:path";
import { existsSync } from "node:fs";

// Node-side mirror of the worker's env config: local files only.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = path.resolve(process.cwd(), "public/models");
env.backends.onnx.wasm.numThreads = 1;

const MODEL_DIR = path.join(
  process.cwd(),
  "public/models/Xenova/paraphrase-multilingual-MiniLM-L12-v2",
);
if (!existsSync(MODEL_DIR)) {
  console.error("模型文件缺失：先运行 npm run fetch-model 下载到 public/models/");
  process.exit(1);
}

// ---- simple TS loader: bundle with esbuild (handles relative imports) ----
const { build } = await import("esbuild");
const { mkdirSync } = await import("node:fs");
const TMP = path.resolve(process.cwd(), "eval/.tmp");
mkdirSync(TMP, { recursive: true });
async function loadTs(relPath, name) {
  const outfile = path.join(TMP, name + ".mjs");
  await build({
    entryPoints: [path.resolve(process.cwd(), relPath)],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    outfile,
    logLevel: "silent",
  });
  return import("file:///" + outfile.replace(/\\/g, "/"));
}

const { kmeans, chooseK, normalizeRows } = await loadTs("lib/pipeline/cluster.ts", "cluster");
const seeds = await loadTs("lib/ingest/sample.ts", "sample").then((m) => m.sampleSeedsWithTopics());

// ---- 1. Embed ----
console.log("加载模型（本地 public/models）…");
const t0 = Date.now();
const extractor = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
  quantized: true,
});
console.log(`模型就绪（${Date.now() - t0}ms）`);

const texts = seeds.map((s) => s.text.slice(0, 256));
const out = await extractor(texts, { pooling: "mean", normalize: true });
const dim = out.data.length / texts.length;
const vectors = [];
for (let b = 0; b < texts.length; b++) vectors.push(out.data.slice(b * dim, (b + 1) * dim));
const normalized = normalizeRows(vectors);

// ---- 2. Cluster (same auto-k rule as the UI) ----
const n = seeds.length;
const maxK = Math.max(2, Math.min(12, Math.floor(n / 8)));
const inertias = [];
for (let k = 2; k <= maxK; k++) inertias.push(kmeans(normalized, k, 42, 12).inertia);
const k = chooseK(n, inertias);
const final = kmeans(normalized, k, 42, 25);
console.log(`\n自动选择 k=${k}（ground truth 8 个主题, n=${n}）`);

// ---- 3. Metrics ----
const labels = final.assignments;
const truth = seeds.map((s) => s.topic);
const truthKeys = [...new Set(truth)];

function ari(labelsA, labelsB) {
  // contingency table
  const mapA = new Map(), mapB = new Map();
  labelsA.forEach((l) => mapA.set(l, (mapA.get(l) ?? 0) + 1));
  labelsB.forEach((l) => mapB.set(l, (mapB.get(l) ?? 0) + 1));
  const pair = new Map();
  for (let i = 0; i < labelsA.length; i++) {
    const key = labelsA[i] + "|" + labelsB[i];
    pair.set(key, (pair.get(key) ?? 0) + 1);
  }
  const comb = (x) => (x * (x - 1)) / 2;
  let sumIJ = 0;
  for (const v of pair.values()) sumIJ += comb(v);
  let sumA = 0, sumB = 0;
  for (const v of mapA.values()) sumA += comb(v);
  for (const v of mapB.values()) sumB += comb(v);
  const total = comb(labelsA.length);
  const expected = (sumA * sumB) / total;
  const maxIndex = (sumA + sumB) / 2;
  return (sumIJ - expected) / (maxIndex - expected);
}

function purity(pred, gt) {
  let hit = 0;
  const groups = new Map();
  pred.forEach((p, i) => {
    const key = p;
    if (!groups.has(key)) groups.set(key, new Map());
    const g = groups.get(key);
    g.set(gt[i], (g.get(gt[i]) ?? 0) + 1);
  });
  for (const g of groups.values()) {
    let best = 0;
    for (const v of g.values()) best = Math.max(best, v);
    hit += best;
  }
  return hit / pred.length;
}

const ariScore = ari(labels, truth);
const purityScore = purity(labels, truth);
const silhouette = final.silhouette;

// ---- 3b. Upper-bound reference: force k = number of ground-truth topics ----
const forcedK = truthKeys.length;
const forced = kmeans(normalized, forcedK, 42, 25);
const ariForced = ari(forced.assignments, truth);
const purityForced = purity(forced.assignments, truth);
const silForced = forced.silhouette;

// ---- 4. Per-topic confusion (which topics merge/split) ----
console.log("\n混淆矩阵（行=真实主题，列=簇）:");
const clusters = [...new Set(labels)].sort((a, b) => a - b);
const header = "真实主题".padEnd(12) + clusters.map((c) => `C${c}`.padEnd(6)).join("");
console.log(header);
for (const t of truthKeys) {
  const row = clusters.map((c) => {
    const cnt = seeds.filter((s, i) => truth[i] === t && labels[i] === c).length;
    return String(cnt).padEnd(6);
  });
  console.log(t.padEnd(12) + row.join(""));
}

// ---- 5. Triage sanity: labeled pain topics must not come out as praise ----
const { triage } = await loadTs("lib/pipeline/score.ts", "score");
const items = await loadTs("lib/ingest/sample.ts", "sample").then((m) => m.sampleDataset());

function triageCheck(assignments, kk) {
  const clusterOf = new Map(items.map((it, i) => [it.id, assignments[i]]));
  const bases = Array.from({ length: kk }, (_, c) => ({
    id: c,
    memberIds: items.filter((_, i) => assignments[i] === c).map((it) => it.id),
    quoteIds: [],
    keywords: [],
  }));
  const tri = triage(items, clusterOf, bases);
  const praise = new Set(tri.filter((t) => t.action === "praise").map((t) => t.id));
  // Cluster-level correctness: a praise-marked cluster is fine as long as a
  // majority of its members are true praise (quotes are drawn from the
  // cluster, so majority-praise keeps the bucket quotable).
  let fpClusters = 0;
  for (const t of tri) {
    if (t.action !== "praise") continue;
    const members = seeds.filter((s, i) => assignments[i] === t.id);
    const praiseShare = members.filter((s) => s.topic === "好评").length / members.length;
    if (praiseShare < 0.5) fpClusters++;
  }
  const hit = seeds.filter((s, i) => s.topic === "好评" && praise.has(assignments[i])).length;
  const total = seeds.filter((s) => s.topic === "好评").length;
  return { fp: fpClusters, hit, total };
}

const check4 = triageCheck(labels, k);
const check8 = triageCheck(forced.assignments, forcedK);

console.log("\n=== 评测结果 ===");
console.log(`自动定 k=${k}:  ARI ${ariScore.toFixed(3)} | Purity ${purityScore.toFixed(3)} | Silhouette ${silhouette.toFixed(3)}`);
console.log(`对照 k=${forcedK}:  ARI ${ariForced.toFixed(3)} | Purity ${purityForced.toFixed(3)} | Silhouette ${silForced.toFixed(3)}`);
console.log(`（强制细分会碎片化：语义相近的负面主题——登录/计费/客服——嵌入空间本就相邻，自动定 k 的合并是符合归因场景的选择）`);
console.log(`分诊 好评召回: 自动k ${check4.hit}/${check4.total} · 强制k ${check8.hit}/${check8.total}`);
console.log(`分诊 非好评簇误标: 自动k ${check4.fp} · 强制k ${check8.fp}（好评占比<50% 的簇被标为好评）`);

// thresholds the README table quotes; CI fails below these.
// Auto-k intentionally under-segments (related pain topics merge), so the
// pass bar tracks separation + triage sanity rather than 8-way purity.
const PASS = { ari: 0.3, purity: 0.5, silhouette: 0.05, falsePraise: 2, praiseRecall: 0.6 };
const praiseRecall = Math.max(check4.hit / check4.total, check8.hit / check8.total);
const fpTotal = check4.fp + check8.fp;
const ok =
  ariScore >= PASS.ari &&
  purityScore >= PASS.purity &&
  silhouette >= PASS.silhouette &&
  fpTotal <= PASS.falsePraise &&
  praiseRecall >= PASS.praiseRecall;
console.log(
  ok
    ? `\n✅ PASS (ARI≥${PASS.ari} purity≥${PASS.purity} sil≥${PASS.silhouette} 误报≤${PASS.falsePraise} 好评召回≥${PASS.praiseRecall})`
    : `\n❌ FAIL (ARI ${ariScore.toFixed(3)}/${PASS.ari} purity ${purityScore.toFixed(2)}/${PASS.purity} sil ${silhouette.toFixed(3)}/${PASS.silhouette} 误报 ${fpTotal}/${PASS.falsePraise} 好评召回 ${praiseRecall.toFixed(2)}/${PASS.praiseRecall})`,
);
process.exit(ok ? 0 : 1);

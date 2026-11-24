// Precompute the "featured real-data case study" from the scraped Microsoft
// Store reviews (Minecraft Launcher, 236 rows). Mirrors the browser worker's
// pipeline exactly: embed (same local model) -> kmeans/chooseK -> keywords ->
// triage -> timeline -> kpis -> template report. Output is a static JSON
// consumed by /case-study so the online demo always shows a full real-data
// result without any visitor-side compute.
//
// Run: node scripts/precompute-case-study.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline, env } from "@xenova/transformers";
import Papa from "papaparse";

env.allowLocalModels = true;
env.localModelPath = path.resolve(process.cwd(), "public/models");
env.remoteHost = "https://hf-mirror.com/";
env.allowRemoteModels = false; // local-only, mirrors scripts/smoke-model.mjs

// ---- pipeline imports (plain TS-free modules; cluster/text/score are .ts) --
// Node 22+ can't import .ts directly here, so we use the same algorithm via
// the compiled Next build? Simpler: re-implement the tiny glue by importing
// through a dynamic tsx-free loader is overkill — instead duplicate the calls
// using the exported functions via a tiny esbuild-free trick: import them as
// text is fragile. The project has no ts-node; but Next ships one? Use the
// simplest robust path: inline the exact worker logic with functions imported
// from the TS files using node's built-in type-stripping (Node >= 22.6 with
// --experimental-strip-types). Check version at runtime and fail loudly.
if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error("Need Node >= 22.6 for --experimental-strip-types");
  process.exit(1);
}

const { normalizeRows, kmeans, chooseK, representativeItems } = await import(
  "../lib/pipeline/cluster.ts"
);
const { clusterKeywords, buildTimeline } = await import("../lib/pipeline/text.ts");
const { triage, corpusKpis } = await import("../lib/pipeline/score.ts");
const { cleanRows, toIsoDate } = await import("../lib/pipeline/clean.ts");
const { templateReport, fallbackTitle, fallbackSummary } = await import(
  "../lib/llm/fallback.ts"
);

// ---- load CSV --------------------------------------------------------------
const csvPath = path.resolve(process.cwd(), "data/samples/minecraft-launcher-reviews.csv");
const csvText = await readFile(csvPath, "utf8");
const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
const rows = parsed.data.filter((r) => (r["评论内容"] ?? "").trim() !== "");
console.log("csv rows:", rows.length);

const raw = rows.map((r, i) => {
  const ratingNum = Number.parseFloat(r["评分"]);
  return {
    id: `r${i}`,
    text: (r["评论内容"] ?? "").trim(),
    rating: Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : undefined,
    date: toIsoDate(r["日期"]),
    author: r["作者"] || undefined,
  };
});
const { items, dropped } = cleanRows(raw);
console.log("clean items:", items.length, "dropped:", JSON.stringify(dropped));

// ---- embed -----------------------------------------------------------------
console.log("loading model...");
const extractor = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
  quantized: true,
});
console.log("model ready");
const t0 = Date.now();
const vectors = [];
const BATCH = 32;
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH).map((it) => it.text.slice(0, 256));
  const output = await extractor(batch, { pooling: "mean", normalize: true });
  const dim = output.data.length / batch.length;
  for (let b = 0; b < batch.length; b++) vectors.push(output.data.slice(b * dim, (b + 1) * dim));
  process.stdout.write(`\rembed ${Math.min(i + BATCH, items.length)}/${items.length}`);
}
console.log("\nembed ms:", Date.now() - t0);

// ---- cluster + score (identical to embed.worker.ts) -------------------------
const normalized = normalizeRows(vectors);
const maxK = Math.max(2, Math.min(12, Math.floor(items.length / 8)));
const inertias = [];
for (let k = 2; k <= maxK; k++) inertias.push(kmeans(normalized, k, 42, 12).inertia);
const k = chooseK(items.length, inertias);
console.log("chosen k:", k);
const final = kmeans(normalized, k, 42, 25);

const clusterOf = new Map();
items.forEach((item, i) => clusterOf.set(item.id, final.assignments[i]));
const keywords = clusterKeywords(items, clusterOf, k);
const quotes = representativeItems(normalized, items, final.assignments, k, 3);
const bases = Array.from({ length: k }, (_, c) => ({
  id: c,
  memberIds: items.filter((_, i) => final.assignments[i] === c).map((it) => it.id),
  quoteIds: quotes[c],
  keywords: keywords[c],
}));
let clusters = triage(items, clusterOf, bases).sort((a, b) => b.priority - a.priority);
const idRemap = new Map(clusters.map((c, i) => [c.id, i]));
clusters = clusters.map((c) => ({ ...c, id: idRemap.get(c.id) ?? c.id }));
const remapClusterOf = new Map();
for (const [itemId, cId] of clusterOf) remapClusterOf.set(itemId, idRemap.get(cId) ?? cId);

const timeline = buildTimeline(items, remapClusterOf, k);
const kpis = corpusKpis(items);
const byId = new Map(items.map((i) => [i.id, i]));
for (const c of clusters) {
  const members = c.memberIds.map((id) => byId.get(id)).filter(Boolean);
  c.title = fallbackTitle(c, members);
  c.summary = fallbackSummary(c);
}
const report = templateReport(clusters, (c) => c.memberIds.map((id) => byId.get(id)).filter(Boolean));

// AnalysisResult shape minus createdAt (page adds a fixed display id).
const result = {
  sourceName: "微软商店 · Minecraft Launcher 真实评论",
  items,
  clusters,
  dropped,
  namingMode: "fallback",
  embeddingMs: Date.now() - t0,
  silhouette: final.silhouette,
  k,
  timeline,
  kpis,
  report,
};

const outDir = path.resolve(process.cwd(), "data/case-studies");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "minecraft-launcher.json");
await writeFile(outPath, JSON.stringify(result), "utf8");
console.log("wrote", outPath, Math.round(JSON.stringify(result).length / 1024), "KB");
console.log("clusters:", clusters.map((c) => `${c.id}:${c.title}(${c.memberIds.length},${c.action})`).join(" | "));

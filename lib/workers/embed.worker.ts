/// <reference lib="webworker" />
// Embedding worker: runs transformers.js (multilingual MiniLM, int8-quantized)
// entirely in the browser so user feedback never leaves the device.

import { pipeline, env } from "@xenova/transformers";
import { normalizeRows, kmeans, chooseK, representativeItems } from "../pipeline/cluster";
import { clusterKeywords, buildTimeline } from "../pipeline/text";
import { triage, corpusKpis } from "../pipeline/score";
import type { CleanFeedback, Cluster } from "../types";

env.allowLocalModels = false;

export interface EmbedRequest {
  type: "embed";
  items: CleanFeedback[];
}

export interface EmbedProgress {
  type: "progress";
  done: number;
  total: number;
  stage: "model" | "embed" | "cluster" | "score";
  message?: string;
}

export interface EmbedResultMsg {
  type: "done";
  assignments: number[];
  k: number;
  silhouette: number;
  clusters: Cluster[];
  timeline: ReturnType<typeof buildTimeline>;
  kpis: ReturnType<typeof corpusKpis>;
  embeddingMs: number;
}

let extractorPromise: Promise<unknown> | null = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/multilingual-MiniLM-L6-v2", {
      quantized: true,
    });
  }
  return extractorPromise as ReturnType<typeof pipeline>;
}

self.addEventListener("message", async (event: MessageEvent<EmbedRequest>) => {
  if (event.data?.type !== "embed") return;
  const items = event.data.items;
  const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);

  try {
    post({ type: "progress", done: 0, total: items.length, stage: "model", message: "加载语义模型（首次约 30MB，之后有缓存）" } satisfies EmbedProgress);
    const extractor = await getExtractor();

    post({ type: "progress", done: 0, total: items.length, stage: "embed" } satisfies EmbedProgress);
    const t0 = performance.now();

    // Batch embedding; report progress every batch.
    const vectors: Float32Array[] = [];
    const BATCH = 32;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH).map((it) => it.text.slice(0, 256));
      const output = (await (extractor as unknown as (texts: string[], opts: Record<string, unknown>) => Promise<{ data: Float32Array }>)(
        batch,
        { pooling: "mean", normalize: true },
      ));
      const dim = output.data.length / batch.length;
      for (let b = 0; b < batch.length; b++) {
        vectors.push(output.data.slice(b * dim, (b + 1) * dim));
      }
      post({
        type: "progress",
        done: Math.min(i + BATCH, items.length),
        total: items.length,
        stage: "embed",
      } satisfies EmbedProgress);
    }
    const embeddingMs = performance.now() - t0;

    const normalized = normalizeRows(vectors);

    // Elbow over k = 2..min(12, n/8), then pick k.
    post({ type: "progress", done: items.length, total: items.length, stage: "cluster", message: "语义聚类中" } satisfies EmbedProgress);
    const maxK = Math.max(2, Math.min(12, Math.floor(items.length / 8)));
    const inertias: number[] = [];
    for (let k = 2; k <= maxK; k++) {
      const r = kmeans(normalized, k, 42, 12);
      inertias.push(r.inertia);
    }
    const k = chooseK(items.length, inertias);
    const final = kmeans(normalized, k, 42, 25);

    const clusterOf = new Map<string, number>();
    items.forEach((item, i) => clusterOf.set(item.id, final.assignments[i]));

    const keywords = clusterKeywords(items, clusterOf, k);
    const quotes = representativeItems(normalized, items, final.assignments, k, 3);

    const bases = Array.from({ length: k }, (_, c) => ({
      id: c,
      memberIds: items.filter((_, i) => final.assignments[i] === c).map((it) => it.id),
      quoteIds: quotes[c],
      keywords: keywords[c],
    }));

    post({ type: "progress", done: items.length, total: items.length, stage: "score", message: "打分与分诊中" } satisfies EmbedProgress);
    const clusters = triage(items, clusterOf, bases).sort((a, b) => b.priority - a.priority);
    // Re-index cluster ids by priority order so UI lists match charts.
    const idRemap = new Map<number, number>();
    clusters.forEach((c, i) => idRemap.set(c.id, i));
    const remapped = clusters.map((c) => ({ ...c, id: idRemap.get(c.id) ?? c.id }));
    const remapClusterOf = new Map<string, number>();
    for (const [itemId, cId] of clusterOf) remapClusterOf.set(itemId, idRemap.get(cId) ?? cId);

    const timeline = buildTimeline(items, remapClusterOf, k);
    const kpis = corpusKpis(items);

    const done: EmbedResultMsg = {
      type: "done",
      assignments: items.map((it) => remapClusterOf.get(it.id) ?? 0),
      k,
      silhouette: final.silhouette,
      clusters: remapped,
      timeline,
      kpis,
      embeddingMs: Math.round(embeddingMs),
    };
    post(done);
  } catch (err) {
    post({ type: "error", message: String(err) });
  }
});

export {};

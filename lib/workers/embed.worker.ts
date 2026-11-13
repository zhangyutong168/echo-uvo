/// <reference lib="webworker" />
// Embedding worker: runs transformers.js (multilingual MiniLM, int8-quantized)
// entirely in the browser so user feedback never leaves the device.

import { pipeline, env } from "@xenova/transformers";
import { normalizeRows, kmeans, chooseK, representativeItems } from "../pipeline/cluster";
import { clusterKeywords, buildTimeline } from "../pipeline/text";
import { triage, corpusKpis } from "../pipeline/score";
import type { CleanFeedback, Cluster } from "../types";

// Model loading strategy:
// 1. Same-origin: public/models/<repo-id>/<file> is fetched first (browser
//    default localModelPath is "/models/"), so the self-hosted copy in the
//    repo is used whenever present — no third-party request at all.
// 2. Fallback: hf-mirror.com, reachable from mainland-China networks where
//    huggingface.co is not. We never touch huggingface.co directly.
// A watchdog rejects if no download progress arrives for 60s, so failures
// surface in the UI instead of hanging at "分析中…".
// Dev-mode workers may run from a blob URL without a base origin, where
// relative fetch URLs fail to parse — always use absolute URLs.
env.allowLocalModels = true;
env.remoteHost = "https://hf-mirror.com/";
const ORIGIN = self.location.origin;
env.localModelPath = `${ORIGIN}/models/`;
// ORT wasm runtime: self-hosted at /wasm (copied from onnxruntime-web by
// scripts/copy-wasm.mjs). transformers.js defaults to cdn.jsdelivr.net,
// which is unreachable from some networks and silently stalls the worker.
// Guarded: a missing backend object must not kill module init (that would
// leave the message listener unregistered and the UI hanging forever).
if (env.backends.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = `${ORIGIN}/wasm/`;
  // Single-threaded: avoids spawning nested ort workers inside the bundled
  // worker (threaded loader resolves relative to the blob URL).
  env.backends.onnx.wasm.numThreads = 1;
}

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

const MODEL_STALL_MS = 60_000;

function loadExtractor(
  onProgress: (msg: EmbedProgress) => void,
): ReturnType<typeof pipeline> {
  let lastActivity = Date.now();
  let watchdog: ReturnType<typeof setInterval> | undefined;

  const download = pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
    quantized: true,
    progress_callback: (p: { status?: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
      lastActivity = Date.now();
      if (p.status === "progress" && typeof p.total === "number" && p.total > 1_000_000) {
        const pct = Math.round((p.progress ?? 0));
        onProgress({
          type: "progress",
          done: pct,
          total: 100,
          stage: "model",
          message: `加载语义模型 ${pct}%（${Math.round((p.loaded ?? 0) / 1048576)}/${Math.round(p.total / 1048576)} MB，仅首次）`,
        });
      }
    },
  }).finally(() => {
    if (watchdog) clearInterval(watchdog);
  });

  // Reject if no download activity for MODEL_STALL_MS so the UI shows an
  // error instead of spinning forever on a blocked network.
  const stall = new Promise<never>((_, reject) => {
    watchdog = setInterval(() => {
      if (Date.now() - lastActivity > MODEL_STALL_MS) {
        reject(
          new Error(
            `模型下载超过 ${MODEL_STALL_MS / 1000} 秒无进展：网络可能无法访问模型源。请检查网络后重试。`,
          ),
        );
      }
    }, 5_000);
  });

  return Promise.race([download, stall]) as ReturnType<typeof pipeline>;
}

async function getExtractor(onProgress: (msg: EmbedProgress) => void) {
  if (!extractorPromise) {
    extractorPromise = loadExtractor(onProgress).catch((e) => {
      extractorPromise = null; // allow a fresh download on retry
      throw e;
    });
  }
  return extractorPromise as ReturnType<typeof pipeline>;
}

self.addEventListener("message", async (event: MessageEvent<EmbedRequest>) => {
  if (event.data?.type !== "embed") return;
  const items = event.data.items;
  const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);

  try {
    post({ type: "progress", done: 0, total: items.length, stage: "model", message: "加载语义模型（首次约 118MB，之后有缓存）" } satisfies EmbedProgress);
    const extractor = await getExtractor(post);

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

/**
 * Download the paraphrase-multilingual-MiniLM-L12-v2 ONNX model into
 * public/models/ so the browser loads it same-origin (no huggingface.co
 * dependency at runtime — required for mainland-China networks and nice
 * for privacy too).
 *
 * Tries huggingface.co first (works from CI/Vercel), then hf-mirror.com /
 * modelscope.cn (reachable from mainland-China networks for local dev).
 * Total ~135MB; the int8 model is 115MB of that. Downloaded at prebuild
 * time and gitignored (exceeds GitHub's 100MB file limit); Vercel runs
 * prebuild so the files are served same-origin in production too.
 *
 * Usage: node scripts/fetch-model.mjs
 */
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const REPO = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
// Source order: huggingface.co works from CI/Vercel (US); hf-mirror.com and
// modelscope.cn work from mainland-China networks for local dev.
const SOURCES = [
  (rel) => `https://huggingface.co/${REPO}/resolve/main/${rel}`,
  (rel) => `https://hf-mirror.com/${REPO}/resolve/main/${rel}`,
  (rel) =>
    `https://modelscope.cn/api/v1/models/${REPO}/repo?Revision=master&FilePath=${rel}`,
];
// Must mirror the HF layout: transformers.js requests
// /models/<repo-id>/<file> same-origin first (env.localModelPath default).
const OUT_DIR = path.resolve(process.cwd(), "public/models", REPO);

const FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_quantized.onnx",
];

const MIN_SIZES = {
  "onnx/model_quantized.onnx": 100_000_000,
  "tokenizer.json": 10_000_000,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      const res = await fetch(url, { redirect: "follow", signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok && res.body) return res;
      lastErr = new Error(`HTTP ${res.status}`);
      clearTimeout(timer);
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    console.log(`  attempt ${i} failed (${String(lastErr).slice(0, 60)}), retrying...`);
    await sleep(3000);
  }
  throw lastErr;
}

async function download(rel) {
  const out = path.join(OUT_DIR, ...rel.split("/"));
  if (existsSync(out)) {
    const size = statSync(out).size;
    const need = MIN_SIZES[rel];
    if (need === undefined || size >= need) {
      console.log(`skip (exists, ${Math.round(size / 1024 / 1024)}MB): ${rel}`);
      return;
    }
    console.log(`re-download (too small: ${size} bytes): ${rel}`);
  }
  let saved = false;
  for (const makeUrl of SOURCES) {
    const url = makeUrl(rel);
    console.log(`GET ${url}`);
    try {
      const res = await fetchWithRetry(url);
      mkdirSync(path.dirname(out), { recursive: true });
      const tmp = `${out}.part`;
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      renameSync(tmp, out);
      const size = statSync(out).size;
      console.log(`  saved ${Math.round(size / 1024)}KB -> ${out}`);
      saved = true;
      break;
    } catch (e) {
      console.log(`  source failed: ${String(e).slice(0, 80)}`);
      if (existsSync(`${out}.part`)) unlinkSync(`${out}.part`);
    }
  }
  if (!saved) throw new Error(`all sources failed for ${rel}`);
}

console.log(`Downloading model files into ${OUT_DIR}`);
for (const rel of FILES) {
  await download(rel);
}
console.log("Done.");

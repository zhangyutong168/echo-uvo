/**
 * Copy the onnxruntime-web wasm runtime into public/wasm so the embedding
 * worker loads it same-origin. transformers.js defaults to cdn.jsdelivr.net
 * for these files, which is unreachable from some (e.g. mainland-China)
 * networks and silently stalls the worker.
 *
 * Usage: node scripts/copy-wasm.mjs   (wired as a postinstall hook)
 */
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "node_modules/onnxruntime-web/dist");
const OUT = path.resolve(process.cwd(), "public/wasm");

const FILES = [
  "ort-wasm.wasm",
  "ort-wasm-simd.wasm",
  "ort-wasm-threaded.wasm",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-threaded.worker.js",
];

mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  copyFileSync(path.join(SRC, f), path.join(OUT, f));
}
console.log(`copied ${FILES.length} wasm files -> public/wasm/`);

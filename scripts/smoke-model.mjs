// Node-side smoke test: can transformers.js load the local model files and
// embed two strings? Mirrors the worker's env config.
process.env.NODE_BACKEND ??= "onnxruntime-node" in process.env ? process.env.NODE_BACKEND : undefined;
import { pipeline, env } from "@xenova/transformers";
import path from "node:path";

env.allowLocalModels = true;
env.localModelPath = path.resolve(process.cwd(), "public/models");
env.remoteHost = "https://hf-mirror.com/";
env.allowRemoteModels = false; // force local-only for this test

const t0 = Date.now();
const extractor = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", {
  quantized: true,
});
console.log("model loaded in", Date.now() - t0, "ms");

const out = await extractor(["这个应用老闪退，客服也不理人", "界面很好看，用起来很流畅"], {
  pooling: "mean",
  normalize: true,
});
console.log("output dims:", out.data.length / 2, "per vector");
console.log("sample values:", out.data.slice(0, 4));

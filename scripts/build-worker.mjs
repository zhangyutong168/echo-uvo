/**
 * Bundle lib/workers/embed.worker.ts into a self-contained classic worker at
 * public/embed.worker.js (esbuild, browser field honored so onnxruntime-web is
 * selected instead of onnxruntime-node).
 *
 * Why not `new Worker(new URL("./embed.worker.ts", import.meta.url))`:
 * Turbopack serves that through a bootstrap that importScripts a chain of
 * runtime chunks; in this project that chain silently dies before the worker's
 * message listener registers (no error surfaced anywhere). A plain same-origin
 * static file has no bootstrap at all and behaves identically in dev and prod.
 *
 * Usage: node scripts/build-worker.mjs   (wired as predev/prebuild)
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "public/embed.worker.js");
mkdirSync(path.dirname(OUT), { recursive: true });

await build({
  entryPoints: [path.resolve(process.cwd(), "lib/workers/embed.worker.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: OUT,
  // transformers.js ships ESM src with a browser field mapping
  // onnxruntime-node -> onnxruntime-web; esbuild resolves it natively.
  resolveExtensions: [".ts", ".js", ".json"],
  conditions: ["browser", "module", "import"],
  // Node-only imports that remain in the graph (sharp/canvas optional deps,
  // fs/path inside CJS guards) must resolve to empty stubs — leaving them
  // external makes esbuild emit `require("fs")` calls that throw at runtime
  // in the worker ("Dynamic require of fs is not supported").
  plugins: [
    {
      name: "node-stubs",
      setup(b) {
        b.onResolve(
          { filter: /^(fs|path|url|crypto|os|util|events|stream|zlib|http|https|net|tls|child_process|worker_threads|sharp|canvas|onnxruntime-node)$/ },
          (args) => ({ path: args.path, namespace: "stub" }),
        );
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "module.exports = {};",
          loader: "js",
        }));
      },
    },
  ],
  legalComments: "none",
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
console.log("worker bundled -> public/embed.worker.js");

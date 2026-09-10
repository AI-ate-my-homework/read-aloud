import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

// kokoro-js's package.json "exports" map only exposes ".", not "./dist/kokoro.web.js"
// (the browser-optimized prebuilt bundle we actually want), so esbuild can't resolve
// a deep import straight from node_modules. Vendor it into src/ first so offscreen.js
// can pull it in as a plain relative import instead.
mkdirSync("src/vendor", { recursive: true });
copyFileSync("node_modules/kokoro-js/dist/kokoro.web.js", "src/vendor/kokoro.web.js");

const targets = [
  { entry: "src/background.js", out: "extension/background.js", format: "esm" },
  { entry: "src/offscreen.js", out: "extension/offscreen.js", format: "esm" },
  { entry: "src/content.js", out: "extension/content.bundle.js", format: "iife" },
  { entry: "src/pdf-viewer.js", out: "extension/pdf/viewer.bundle.js", format: "esm" },
];

for (const t of targets) {
  await esbuild.build({
    entryPoints: [t.entry],
    outfile: t.out,
    bundle: true,
    format: t.format,
    platform: "browser",
    target: "chrome110",
    minify: false,
    logLevel: "info",
  });
}

mkdirSync("extension/vendor/wasm", { recursive: true });
for (const f of ["ort-wasm-simd-threaded.jsep.wasm", "ort-wasm-simd-threaded.jsep.mjs"]) {
  copyFileSync(`node_modules/@huggingface/transformers/dist/${f}`, `extension/vendor/wasm/${f}`);
}
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.mjs", "extension/pdf/pdf.worker.mjs");

console.log("Build complete → extension/");

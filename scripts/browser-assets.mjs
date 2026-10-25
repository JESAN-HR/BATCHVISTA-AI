import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
const destination = path.resolve("public/ocr");
await mkdir(destination, { recursive: true });
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js",
  path.join(destination, "worker.min.js"),
);
await copyFile(
  "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt",
  path.join(destination, "worker.LICENSE.txt"),
);
for (const name of await readdir("node_modules/tesseract.js-core")) {
  if (name.endsWith(".wasm.js") || name.endsWith(".wasm") || name === "LICENSE")
    await copyFile(
      path.join("node_modules/tesseract.js-core", name),
      path.join(destination, name),
    );
}
await copyFile(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  path.join(destination, "eng.traineddata.gz"),
);
console.log(
  "Browser OCR worker, WASM and English model copied to public/ocr (same-origin assets).",
);

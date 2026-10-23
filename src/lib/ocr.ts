import path from "node:path";
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import type { OCRResult, Word } from "./domain";

let busy = false;
export async function extractText(
  image: Buffer,
  width: number,
  height: number,
): Promise<OCRResult> {
  if (busy)
    throw new Error(
      "The local OCR worker is busy. Please retry when the current inspection finishes.",
    );
  busy = true;
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  try {
    return await Promise.race([
      (async () => {
        worker = await createWorker("eng", OEM.LSTM_ONLY, {
          workerPath: path.join(
            process.cwd(),
            "node_modules/tesseract.js/src/worker-script/node/index.js",
          ),
          langPath: path.join(
            process.cwd(),
            "node_modules/@tesseract.js-data/eng/4.0.0_best_int",
          ),
          cacheMethod: "none",
          gzip: true,
        });
        if (expired) {
          await worker.terminate();
          throw new Error("OCR timed out.");
        }
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        const { data } = await worker.recognize(
          image,
          {},
          { text: true, blocks: true },
        );
        const words: Word[] = (data.blocks || []).flatMap((b) =>
          b.paragraphs.flatMap((p) =>
            p.lines.flatMap((l) =>
              l.words.map((w) => ({
                text: w.text,
                confidence: w.confidence,
                bbox: w.bbox,
              })),
            ),
          ),
        );
        const warnings: string[] = [];
        if (Math.min(width, height) < 400)
          warnings.push(
            "Low-resolution image. Capture a closer, sharply focused label.",
          );
        if (data.confidence < 65)
          warnings.push(
            "OCR recognition is uncertain. Human transcription is needed.",
          );
        if (!data.text.trim()) warnings.push("No readable text was extracted.");
        return {
          text: data.text,
          confidence: data.confidence,
          words,
          width,
          height,
          warnings,
        };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("OCR exceeded the 90-second processing limit."));
        }, 90_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (worker) await worker.terminate();
    busy = false;
  }
}

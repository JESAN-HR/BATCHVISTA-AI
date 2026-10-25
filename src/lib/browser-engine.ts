import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import {
  sampleProduct,
  type Product,
  type Inspection,
  type OCRResult,
} from "./domain";

export type BrowserRecord = Inspection & {
  image: string;
  reference: string | null;
};
export type BrowserProduct = Product & { reference: string | null };
export type BrowserState = {
  version: 1;
  revision: number;
  products: BrowserProduct[];
  inspections: BrowserRecord[];
};
const databaseName = "batchvista-browser-v1";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Enable site storage or use a regular browser window.",
        ),
      );
  });
}
export async function loadBrowserState(): Promise<BrowserState> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readonly");
    const request = tx.objectStore("workspace").get("state");
    tx.oncomplete = () => {
      db.close();
      resolve(
        request.result || {
          version: 1,
          revision: 0,
          products: [
            {
              ...sampleProduct,
              id: "aster-demo",
              referenceId: null,
              reference: null,
              createdAt: new Date().toISOString(),
            },
          ],
          inspections: [],
        },
      );
    };
    tx.onabort = () => {
      db.close();
      reject(new Error("Cannot read browser records."));
    };
  });
}
// Revision checking prevents a second tab from silently overwriting newer records.
export async function saveBrowserState(
  state: BrowserState,
): Promise<BrowserState> {
  const db = await openDatabase();
  const next = { ...state, revision: state.revision + 1 };
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    let conflict = false;
    const current = store.get("state");
    current.onsuccess = () => {
      if ((current.result?.revision || 0) !== state.revision) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put(next, "state");
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onabort = () => {
      db.close();
      reject(
        new Error(
          conflict
            ? "Another tab changed these records. Reload this page before continuing."
            : "Could not save to browser storage. Storage may be full or disabled. Export existing records and free space; this change was not saved.",
        ),
      );
    };
  });
}

export async function decodeBrowserImage(
  file: Blob,
): Promise<{ image: string; width: number; height: number }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG or WebP image.");
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("Images must be between 1 byte and 10 MB.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This image could not be decoded. Try another photograph.");
  });
  try {
    if (bitmap.width * bitmap.height > 24_000_000)
      throw new Error("Image exceeds the 24 megapixel limit. Resize it first.");
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas image processing is unavailable.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {
      image: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}

export async function browserOCR(
  input: { image: string; width: number; height: number },
  progress: (message: string) => void,
): Promise<OCRResult> {
  let worker: Worker | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectWorkerError: (reason: Error) => void = () => {};
  const workerFailure = new Promise<never>((_, reject) => {
    rejectWorkerError = reject;
  });
  try {
    return await Promise.race([
      workerFailure,
      (async () => {
        worker = await createWorker("eng", OEM.LSTM_ONLY, {
          workerPath: "/ocr/worker.min.js",
          workerBlobURL: false,
          corePath: "/ocr",
          langPath: "/ocr",
          gzip: true,
          errorHandler: (reason) =>
            rejectWorkerError(
              new Error(`OCR could not initialize: ${String(reason)}`),
            ),
          logger: (m) =>
            progress(
              `${m.status}${typeof m.progress === "number" ? ` · ${Math.round(m.progress * 100)}%` : ""}`,
            ),
        });
        if (expired) {
          await worker.terminate();
          throw new Error("OCR timed out.");
        }
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        const { data } = await worker.recognize(
          input.image,
          {},
          { text: true, blocks: true },
        );
        const warnings: string[] = [];
        if (Math.min(input.width, input.height) < 400)
          warnings.push("Low resolution. Recapture a closer, sharper label.");
        if (data.confidence < 65)
          warnings.push(
            "OCR recognition is uncertain; human verification is required.",
          );
        if (!data.text.trim()) warnings.push("No readable text was extracted.");
        return {
          text: data.text,
          confidence: data.confidence,
          width: input.width,
          height: input.height,
          warnings,
          words: (data.blocks || []).flatMap((b) =>
            b.paragraphs.flatMap((p) =>
              p.lines.flatMap((l) =>
                l.words.map((w) => ({
                  text: w.text,
                  confidence: w.confidence,
                  bbox: w.bbox,
                })),
              ),
            ),
          ),
        };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(
            new Error("OCR exceeded 90 seconds. Try a sharper, smaller image."),
          );
        }, 90_000);
      }),
    ]);
  } catch (error) {
    throw new Error(
      `OCR could not complete. Check that this site's /ocr assets are available, then retry. ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    if (timer) clearTimeout(timer);
    if (worker) await worker.terminate();
  }
}

export function downloadJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

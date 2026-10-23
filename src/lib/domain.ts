import { z } from "zod";
import type { Batch, StationEvidence } from "./station-types";

const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(new Date(v).getTime()) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Use a valid YYYY-MM-DD date",
  );
export const productSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    sku: z.string().trim().min(2).max(50),
    variant: z.string().trim().max(100),
    batch: z.string().trim().min(1).max(60),
    manufactured: date,
    expiry: date,
    quantity: z.string().trim().min(1).max(60),
    requiredText: z.array(z.string().trim().min(1).max(120)).max(12),
    visualRequired: z.boolean().default(false),
  })
  .refine((p) => !p.manufactured || !p.expiry || p.expiry > p.manufactured, {
    message: "Expiry must follow manufacturing date",
    path: ["expiry"],
  });
export type ProductInput = z.infer<typeof productSchema>;
export type Product = ProductInput & {
  id: string;
  referenceId: string | null;
  createdAt: string;
};
export const fields = [
  "name",
  "variant",
  "batch",
  "manufactured",
  "expiry",
  "quantity",
] as const;
export type Field = (typeof fields)[number];
export const labels: Record<Field, string> = {
  name: "Product name",
  variant: "Variant",
  batch: "Batch number",
  manufactured: "Manufacturing date",
  expiry: "Expiry date",
  quantity: "Net quantity",
};
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Word = { text: string; confidence: number; bbox: Box };
export type OCRResult = {
  text: string;
  confidence: number;
  words: Word[];
  width: number;
  height: number;
  warnings: string[];
};
export type Comparison = {
  field: string;
  expected: string;
  observed: string | null;
  status: "match" | "mismatch" | "uncertain";
  evidence: string;
  source: "ocr" | "human";
  box?: Box;
};
export type Recommendation = "PASS" | "FAIL" | "REVIEW";
export type Decision = "ACCEPTED" | "REJECTED" | "HOLD";
export type Analysis = {
  comparisons: Comparison[];
  recommendation: Recommendation;
  uncertaintyNotes: string[];
};
export const reviewSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED", "HOLD"]),
  note: z.string().trim().min(8).max(2000),
  corrections: z
    .partialRecord(z.enum(fields), z.string().trim().max(160))
    .default({}),
});
export const cloudSchema = z.object({
  observations: z
    .array(
      z.object({
        category: z.enum(["text", "printing", "appearance"]),
        description: z.string().max(1000),
        evidence: z.string().max(1000),
      }),
    )
    .max(20),
  uncertaintyNotes: z.array(z.string().max(1000)).max(20),
});
export type CloudResult = z.infer<typeof cloudSchema> & { model: string };
export type Review = {
  id: string;
  decision: Decision;
  note: string;
  corrections: Partial<Record<Field, string>>;
  reviewer: string;
  createdAt: string;
  analysis: Analysis;
};
export type Inspection = {
  batchSnapshot?: Batch;
  stationEvidence?: StationEvidence;
  id: string;
  productId: string;
  product: Product;
  imageId: string;
  createdAt: string;
  ocr: OCRResult;
  analysis: Analysis;
  cloud: CloudResult | null;
  cloudError: string | null;
  processingMethod: string;
  reviews: Review[];
  finalStatus: Decision | null;
};

export const normalize = (v: string) =>
  v
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const patterns: Record<Field, RegExp> = {
  name: /^(?:PRODUCT(?: NAME)?|NAME)\s*[:=]\s*(.+)$/i,
  variant: /^(?:VARIANT|FLAVOU?R)\s*[:=]\s*(.+)$/i,
  batch: /^(?:BATCH(?: NO| NUMBER)?|LOT(?: NO)?)\s*[:=#]?\s+(.+)$/i,
  manufactured:
    /^(?:MFG|MANUFACTURED|MFG DATE|MANUFACTURING DATE)\s*[:=]?\s+(.+)$/i,
  expiry: /^(?:EXP|EXPIRY|EXP DATE|BEST BEFORE)\s*[:=]?\s+(.+)$/i,
  quantity: /^(?:NET(?: WEIGHT| QUANTITY| WT)?|QUANTITY)\s*[:=]?\s+(.+)$/i,
};
function contains(text: string, value: string) {
  return ` ${normalize(text)} `.includes(` ${normalize(value)} `);
}

// OCR confidence is a recognition signal, not a probability of product compliance.
export function verify(
  product: ProductInput,
  ocr: OCRResult,
  corrections: Partial<Record<Field, string>> = {},
): Analysis {
  const lines = ocr.text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const comparisons: Comparison[] = [];
  const uncertaintyNotes = [...ocr.warnings];
  for (const field of fields) {
    const expected = product[field];
    if (!expected) continue;
    const candidates = lines
      .map((line) => ({ line, match: line.match(patterns[field]) }))
      .filter((x) => x.match);
    const corrected = Object.hasOwn(corrections, field);
    const exactLine = lines.find((l) => contains(l, expected));
    const candidate = candidates[0];
    const observed = corrected
      ? corrections[field] || null
      : candidate?.match?.[1]?.trim() || (exactLine ? expected : null);
    const evidence = corrected
      ? "Operator transcription; see original OCR and review audit."
      : candidate?.line || exactLine || "No readable matching evidence found.";
    const words = ocr.words.filter(
      (w) => contains(evidence, w.text) && normalize(w.text).length > 1,
    );
    const reliable =
      corrected ||
      (ocr.confidence >= 65 &&
        words.length > 0 &&
        words.every((w) => w.confidence >= 60));
    const ambiguous = !corrected && (candidates.length > 1 || !reliable);
    let status: Comparison["status"] = "uncertain";
    if (observed && !ambiguous)
      status =
        normalize(observed) === normalize(expected) ? "match" : "mismatch";
    // Dates must be in the explicit ISO format to establish a mismatch; locale ambiguity is review.
    if (
      !corrected &&
      ["expiry", "manufactured"].includes(field) &&
      observed &&
      !/^\d{4}-\d{2}-\d{2}$/.test(observed)
    )
      status = "uncertain";
    const box =
      !corrected && words.length
        ? {
            x0: Math.min(...words.map((w) => w.bbox.x0)),
            y0: Math.min(...words.map((w) => w.bbox.y0)),
            x1: Math.max(...words.map((w) => w.bbox.x1)),
            y1: Math.max(...words.map((w) => w.bbox.y1)),
          }
        : undefined;
    comparisons.push({
      field: labels[field],
      expected,
      observed,
      status,
      evidence,
      source: corrected ? "human" : "ocr",
      box,
    });
  }
  for (const required of product.requiredText) {
    const line = lines.find((l) => contains(l, required));
    const words = ocr.words.filter((w) => line && contains(line, w.text));
    const match =
      !!line &&
      ocr.confidence >= 65 &&
      words.length > 0 &&
      words.every((w) => w.confidence >= 60);
    comparisons.push({
      field: "Required label text",
      expected: required,
      observed: line || null,
      status: match ? "match" : "uncertain",
      evidence:
        line ||
        "Text not found. Absence in OCR does not prove absence on the package.",
      source: "ocr",
    });
  }
  if (product.visualRequired) {
    comparisons.push({
      field: "Physical / visual inspection",
      expected: "Human visual check required",
      observed: null,
      status: "uncertain",
      evidence:
        "Physical damage, seals, geometry and print quality are not verified by OCR.",
      source: "ocr",
    });
  }
  if (comparisons.some((c) => c.status === "uncertain"))
    uncertaintyNotes.push(
      "Unreadable, missing or unsupported evidence needs human review.",
    );
  const recommendation: Recommendation = comparisons.some(
    (c) => c.status === "mismatch",
  )
    ? "FAIL"
    : comparisons.every((c) => c.status === "match") && comparisons.length > 0
      ? "PASS"
      : "REVIEW";
  return { comparisons, recommendation, uncertaintyNotes };
}

export const sampleProduct: ProductInput = {
  name: "Aster Oat Drink",
  sku: "AST-OAT-250",
  variant: "Original",
  batch: "BV-2026-042",
  manufactured: "2026-10-01",
  expiry: "2027-04-01",
  quantity: "250 ml",
  requiredText: ["Store in a cool dry place", "Shake well before use"],
  visualRequired: false,
};

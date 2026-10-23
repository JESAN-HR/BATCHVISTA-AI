import { z } from "zod";
const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Use YYYY-MM-DD",
  );
export const batchSchema = z
  .object({
    productId: z.string().min(1),
    code: z.string().trim().min(1).max(60),
    manufactured: date,
    expiry: date,
  })
  .refine((v) => !v.manufactured || !v.expiry || v.expiry > v.manufactured, {
    path: ["expiry"],
    message: "Expiry must follow manufacturing date",
  });
export type Batch = z.infer<typeof batchSchema> & {
  id: string;
  status: "OPEN" | "CLOSED";
  createdAt: string;
};
export type CaptureQuality = {
  width: number;
  height: number;
  laplacianVariance: number;
  brightness: number;
  contrast: number;
  warnings: string[];
  usable: boolean;
};
export type VisualComparison = {
  method: "Local pixel comparison (experimental)";
  status: "similar" | "differences" | "uncertain";
  reason: string;
  alignmentScore: number | null;
  offset: { x: number; y: number } | null;
  changedFraction: number | null;
  regions: { x: number; y: number; width: number; height: number }[];
};
export type StationEvidence = {
  quality: CaptureQuality;
  visual: VisualComparison | null;
};

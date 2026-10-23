import { describe, it, expect } from "vitest";
import {
  sampleProduct,
  verify,
  productSchema,
  reviewSchema,
  type OCRResult,
} from "../src/lib/domain";
function ocr(text: string, confidence = 95): OCRResult {
  return {
    text,
    confidence,
    words: text.split(/\s+/).map((text) => ({
      text,
      confidence,
      bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
    })),
    width: 1000,
    height: 1000,
    warnings: [],
  };
}
const text =
  "PRODUCT: Aster Oat Drink\nVARIANT: Original\nBATCH: BV-2026-042\nMFG: 2026-10-01\nEXP: 2027-04-01\nNET: 250 ml\nStore in a cool dry place\nShake well before use";
describe("conservative verification", () => {
  it("passes exact readable required fields", () =>
    expect(verify(sampleProduct, ocr(text)).recommendation).toBe("PASS"));
  it("recommends failure for a clearly wrong batch", () => {
    const r = verify(
      sampleProduct,
      ocr(text.replace("BV-2026-042", "BV-2026-099")),
    );
    expect(r.recommendation).toBe("FAIL");
    expect(
      r.comparisons.find((c) => c.field === "Batch number")?.observed,
    ).toBe("BV-2026-099");
  });
  it("recommends failure for a wrong ISO date", () =>
    expect(
      verify(sampleProduct, ocr(text.replace("2027-04-01", "2027-06-01")))
        .recommendation,
    ).toBe("FAIL"));
  it("routes missing mandatory text to review, not an invented defect", () =>
    expect(
      verify(sampleProduct, ocr(text.replace("Shake well before use", "")))
        .recommendation,
    ).toBe("REVIEW"));
  it("routes uncertain recognition to review", () =>
    expect(verify(sampleProduct, ocr(text, 30)).recommendation).toBe("REVIEW"));
  it("routes blank images to review", () =>
    expect(verify(sampleProduct, ocr("")).recommendation).toBe("REVIEW"));
  it("does not invent coordinates when OCR has none", () => {
    const r = verify(sampleProduct, { ...ocr(text), words: [] });
    expect(r.recommendation).toBe("REVIEW");
    expect(r.comparisons.every((c) => !c.box)).toBe(true);
  });
  it("requires review for ambiguous date formats", () =>
    expect(
      verify(sampleProduct, ocr(text.replace("2027-04-01", "04/01/27")))
        .recommendation,
    ).toBe("REVIEW"));
  it("requires review when multiple batch values exist", () =>
    expect(
      verify(sampleProduct, ocr(text + "\nBATCH: BV-2026-099")).recommendation,
    ).toBe("REVIEW"));
  it("does not match a substring within a different batch", () =>
    expect(
      verify({ ...sampleProduct, batch: "BV-2026-04" }, ocr(text))
        .recommendation,
    ).toBe("FAIL"));
  it("keeps unsupported physical checks uncertain", () =>
    expect(
      verify({ ...sampleProduct, visualRequired: true }, ocr(text))
        .recommendation,
    ).toBe("REVIEW"));
  it("allows human correction while retaining OCR data", () => {
    const source = ocr(text.replace("BV-2026-042", "BV-2026-099"));
    const r = verify(sampleProduct, source, { batch: "BV-2026-042" });
    expect(r.recommendation).toBe("PASS");
    expect(r.comparisons.find((c) => c.field === "Batch number")?.source).toBe(
      "human",
    );
    expect(source.text).toContain("BV-2026-099");
  });
  it("validates review rationale and decision", () => {
    expect(
      reviewSchema.safeParse({ decision: "ACCEPTED", note: "ok" }).success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({ decision: "PASS", note: "Reviewed carefully" })
        .success,
    ).toBe(false);
  });
  it("validates invalid and reversed dates without throwing", () => {
    expect(
      productSchema.safeParse({ ...sampleProduct, expiry: "2027-02-30" })
        .success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ ...sampleProduct, expiry: "2027-99-99" })
        .success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ ...sampleProduct, expiry: "2020-01-01" })
        .success,
    ).toBe(false);
  });
});

import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, it, expect } from "vitest";
import { extractText } from "../src/lib/ocr";
import { sampleProduct, verify } from "../src/lib/domain";
describe("real bundled offline OCR", () => {
  for (const [name, expected] of [
    ["correct", "PASS"],
    ["wrong-batch", "FAIL"],
    ["wrong-expiry", "FAIL"],
    ["ambiguous", "REVIEW"],
  ])
    it(`processes ${name} pixels as ${expected}`, async () => {
      const image = await readFile(`public/fixtures/${name}.png`);
      const meta = await sharp(image).metadata();
      const result = await extractText(image, meta.width!, meta.height!);
      const analysis = verify(sampleProduct, result);
      console.log(
        `${name}: ${analysis.recommendation}; ${result.words.length} real OCR words; recognition ${result.confidence}`,
      );
      expect(analysis.recommendation).toBe(expected);
      if (name !== "ambiguous") {
        expect(result.words.length).toBeGreaterThan(15);
        expect(result.text).toContain("BATCH");
      }
    });
});

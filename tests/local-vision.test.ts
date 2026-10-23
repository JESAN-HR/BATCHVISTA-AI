import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  captureQuality,
  compareReference,
  withStationEvidence,
} from "../src/lib/local-vision";
import { batchSchema } from "../src/lib/station-types";
const label = () => readFile("public/fixtures/correct.png");
describe("real local image processing (not AI claims)", () => {
  it("recognizes adequate label quality and identical references", async () => {
    const image = await label();
    expect((await captureQuality(image)).usable).toBe(true);
    const r = await compareReference(image, image);
    expect(r.status).toBe("similar");
    expect(r.changedFraction).toBe(0);
    expect(r.regions).toHaveLength(0);
  });
  it("flags very low resolution and blur for recapture", async () => {
    const image = await readFile("public/fixtures/ambiguous.png");
    const q = await captureQuality(image);
    expect(q.usable).toBe(false);
    expect(q.warnings.join(" ")).toContain("resolution");
    const blurred = await sharp(await label())
      .blur(12)
      .png()
      .toBuffer();
    expect((await captureQuality(blurred)).usable).toBe(false);
  });
  it("localizes an actual missing-print region", async () => {
    const reference = await label();
    const patch = await sharp({
      create: { width: 500, height: 80, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const damaged = await sharp(reference)
      .composite([{ input: patch, left: 90, top: 675 }])
      .png()
      .toBuffer();
    const result = await compareReference(damaged, reference);
    console.log(
      "missing print",
      result.status,
      result.alignmentScore,
      result.regions.length,
    );
    expect(result.status).toBe("differences");
    expect(result.regions.some((r) => r.y > 0.6 && r.y < 0.8)).toBe(true);
  });
  it("corrects a small translation instead of fabricating a defect", async () => {
    const reference = await label();
    const shifted = await sharp(reference)
      .extract({ left: 0, top: 0, width: 1380, height: 990 })
      .extend({ left: 20, top: 10, right: 0, bottom: 0, background: "white" })
      .png()
      .toBuffer();
    const r = await compareReference(shifted, reference);
    expect(r.alignmentScore).toBeGreaterThan(0.78);
    expect(r.offset).not.toBeNull();
  });
  it("withholds boxes when framing is incompatible", async () => {
    const ref = await label();
    const crop = await sharp(ref)
      .extract({ left: 300, top: 0, width: 900, height: 1000 })
      .png()
      .toBuffer();
    const r = await compareReference(crop, ref);
    expect(r.status).toBe("uncertain");
    expect(r.regions).toHaveLength(0);
  });
  it("withholds boxes for rotated images", async () => {
    const ref = await label();
    const rotated = await sharp(ref)
      .rotate(12, { background: "white" })
      .resize(1400, 1000, { fit: "fill" })
      .png()
      .toBuffer();
    const r = await compareReference(rotated, ref);
    expect(r.status).toBe("uncertain");
    expect(r.regions).toHaveLength(0);
  });
  it("downgrades a textual pass when image quality is insufficient", async () => {
    const q = await captureQuality(
      await readFile("public/fixtures/ambiguous.png"),
    );
    expect(
      withStationEvidence(
        { recommendation: "PASS", comparisons: [], uncertaintyNotes: [] },
        { quality: q, visual: null },
      ).recommendation,
    ).toBe("REVIEW");
  });
  it("rejects reversed or impossible production dates", () => {
    expect(
      batchSchema.safeParse({
        productId: "p",
        code: "x",
        manufactured: "2026-10-01",
        expiry: "2026-09-01",
      }).success,
    ).toBe(false);
    expect(
      batchSchema.safeParse({
        productId: "p",
        code: "x",
        manufactured: "",
        expiry: "2026-99-99",
      }).success,
    ).toBe(false);
  });
});

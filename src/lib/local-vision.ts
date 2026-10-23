import sharp from "sharp";
import type {
  CaptureQuality,
  VisualComparison,
  StationEvidence,
} from "./station-types";
import type { Analysis } from "./domain";

export async function captureQuality(image: Buffer): Promise<CaptureQuality> {
  const meta = await sharp(image).metadata();
  const { data, info } = await sharp(image)
    .resize({
      width: 512,
      height: 512,
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0,
    sq = 0,
    lap = 0,
    lapSq = 0,
    n = 0;
  for (const v of data) {
    sum += v;
    sq += v * v;
  }
  for (let y = 1; y < info.height - 1; y++)
    for (let x = 1; x < info.width - 1; x++) {
      const i = y * info.width + x;
      const l =
        4 * data[i] -
        data[i - 1] -
        data[i + 1] -
        data[i - info.width] -
        data[i + info.width];
      lap += l;
      lapSq += l * l;
      n++;
    }
  const brightness = sum / data.length,
    contrast = Math.sqrt(Math.max(0, sq / data.length - brightness ** 2)),
    variance = n ? lapSq / n - (lap / n) ** 2 : 0;
  const warnings: string[] = [];
  if (Math.min(meta.width || 0, meta.height || 0) < 400)
    warnings.push("Label resolution is low. Move closer and retake.");
  if (variance < 20)
    warnings.push(
      "Very little sharp detail detected. Image may be blurred or featureless.",
    );
  if (brightness < 35) warnings.push("Image is too dark. Improve lighting.");
  if (contrast < 12)
    warnings.push("Very low contrast. Check lighting, framing and glare.");
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    brightness,
    contrast,
    laplacianVariance: variance,
    warnings,
    usable: !warnings.length,
  };
}
const size = 256;
async function pixels(image: Buffer) {
  return sharp(image)
    .resize(size, size, { fit: "fill" })
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer();
}
function edges(p: Buffer) {
  const out = new Float32Array(size * size);
  for (let y = 1; y < size - 1; y++)
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      out[i] =
        Math.abs(p[i + 1] - p[i - 1]) + Math.abs(p[i + size] - p[i - size]);
    }
  return out;
}
export async function compareReference(
  image: Buffer,
  reference: Buffer,
): Promise<VisualComparison> {
  const base: VisualComparison = {
    method: "Local pixel comparison (experimental)",
    status: "uncertain",
    reason: "",
    alignmentScore: null,
    offset: null,
    changedFraction: null,
    regions: [],
  };
  const [m, r, q, rq] = await Promise.all([
    sharp(image).metadata(),
    sharp(reference).metadata(),
    captureQuality(image),
    captureQuality(reference),
  ]);
  if (!q.usable || !rq.usable)
    return {
      ...base,
      reason:
        "Capture or reference quality is insufficient. Retake before comparing.",
    };
  if (Math.abs(m.width! / m.height! / (r.width! / r.height!) - 1) > 0.05)
    return {
      ...base,
      reason:
        "Framing/aspect ratio differs. Crop both images to the same complete, front-facing label.",
    };
  const [a, b] = await Promise.all([pixels(image), pixels(reference)]);
  const ae = edges(a),
    be = edges(b);
  let score = -1,
    dx = 0,
    dy = 0;
  // Translation-only registration. No claim of perspective or curved-surface correction.
  for (let oy = -8; oy <= 8; oy++)
    for (let ox = -8; ox <= 8; ox++) {
      let dot = 0,
        aa = 0,
        bb = 0;
      for (let y = 12; y < size - 12; y += 2)
        for (let x = 12; x < size - 12; x += 2) {
          const av = ae[(y + oy) * size + x + ox],
            bv = be[y * size + x];
          dot += av * bv;
          aa += av * av;
          bb += bv * bv;
        }
      const s = dot / Math.sqrt(aa * bb || 1);
      if (s > score) {
        score = s;
        dx = ox;
        dy = oy;
      }
    }
  base.alignmentScore = score;
  if (score < 0.78 || Math.abs(dx) === 8 || Math.abs(dy) === 8)
    return {
      ...base,
      reason:
        "Reliable translation alignment was not established. Rotation, perspective or design changes need manual review.",
    };
  const regions: VisualComparison["regions"] = [];
  let changed = 0,
    total = 0;
  for (let y = 12; y < 244; y += 16)
    for (let x = 12; x < 244; x += 16) {
      let count = 0,
        n = 0;
      for (let yy = y; yy < Math.min(y + 16, 244); yy++)
        for (let xx = x; xx < Math.min(x + 16, 244); xx++) {
          n++;
          total++;
          if (
            Math.abs(a[(yy + dy) * size + xx + dx] - b[yy * size + xx]) > 45
          ) {
            count++;
            changed++;
          }
        }
      if (count / n > 0.12)
        regions.push({
          x: (x + dx) / size,
          y: (y + dy) / size,
          width: Math.min(16, 244 - x) / size,
          height: Math.min(16, 244 - y) / size,
        });
    }
  const fraction = changed / total;
  if (fraction > 0.35)
    return {
      ...base,
      reason:
        "Widespread differences prevent reliable localization. Check framing and illumination.",
    };
  return {
    ...base,
    status: regions.length ? "differences" : "similar",
    reason: regions.length
      ? "Measured pixel differences need human assessment; lighting and intended variable text may also cause differences."
      : "No large pixel differences at this resolution. This is not a physical-defect or safety certification.",
    offset: { x: dx / size, y: dy / size },
    changedFraction: fraction,
    regions,
  };
}
export function withStationEvidence(
  analysis: Analysis,
  evidence?: StationEvidence,
): Analysis {
  if (!evidence) return analysis;
  const notes = [...analysis.uncertaintyNotes, ...evidence.quality.warnings];
  if (evidence.visual) notes.push(evidence.visual.reason);
  const needsReview =
    !evidence.quality.usable ||
    (evidence.visual && evidence.visual.status !== "similar");
  return {
    ...analysis,
    uncertaintyNotes: notes,
    recommendation:
      needsReview && analysis.recommendation === "PASS"
        ? "REVIEW"
        : analysis.recommendation,
  };
}

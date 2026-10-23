import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, db, type Identity } from "./db";
import { HttpError } from "./auth";
export async function saveImage(file: File, user: Identity) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new HttpError(400, "Use a PNG, JPEG or WebP image.");
  if (file.size > 10 * 1024 * 1024 || !file.size)
    throw new HttpError(400, "Image must be between 1 byte and 10 MB.");
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, {
      limitInputPixels: 24_000_000,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !["png", "jpeg", "webp"].includes(meta.format || "") ||
      (meta.pages || 1) > 1
    )
      throw new Error("Unsupported encoding");
    // Rotate from EXIF, strip metadata and normalize format. OCR coordinates refer to this image.
    const { data, info } = await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    const id = randomUUID();
    const filename = `${id}.png`;
    await writeFile(path.join(dataDir, "images", filename), data);
    db()
      .prepare("INSERT INTO image VALUES (?,?,?,?,?,?)")
      .run(
        id,
        user.organization_id,
        filename,
        info.width,
        info.height,
        new Date().toISOString(),
      );
    return { id, data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "Image could not be decoded. Use a valid still image below 24 megapixels.",
    );
  }
}

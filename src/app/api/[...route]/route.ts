import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  identity,
  checkLocal,
  openSession,
  errorResponse,
  HttpError,
  requireManager,
} from "@/lib/auth";
import {
  audit,
  createProduct,
  dataDir,
  db,
  inspections,
  products,
  transaction,
  batches,
} from "@/lib/db";
import {
  productSchema,
  reviewSchema,
  verify,
  type Inspection,
  type OCRResult,
  type Review,
} from "@/lib/domain";
import { saveImage } from "@/lib/images";
import { extractText } from "@/lib/ocr";
import { cloudEnabled, GeminiProvider } from "@/lib/vision";
import {
  accountSchema,
  credentials,
  accountsEnabled,
  createAccount,
  login,
  logout,
} from "@/lib/accounts";
import { batchSchema } from "@/lib/station-types";
import {
  captureQuality,
  compareReference,
  withStationEvidence,
} from "@/lib/local-vision";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ route: string[] }> };
async function handle(request: NextRequest, context: Context) {
  if (process.env.VERCEL === "1" || process.env.BATCHVISTA_MODE === "browser")
    return Response.json({ error: "Browser demo mode stores and processes records on your device. Workstation APIs are disabled." }, { status: 404 });
  try {
    const { route } = await context.params;
    const [resource, id, action] = route;
    checkLocal(request);
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      request.headers.get("host") || "",
    );
    if (resource === "auth" && id === "status" && request.method === "GET")
      return Response.json({
        enabled: accountsEnabled(),
        canSetup: local && !accountsEnabled(),
      });
    if (resource === "auth" && id === "setup" && request.method === "POST") {
      if (!local)
        throw new HttpError(
          403,
          "Create the first administrator on the workstation through localhost.",
        );
      const input = accountSchema.parse({
        ...(await request.json()),
        permission: "admin",
      });
      createAccount(input, true);
      return Response.json(await login(request, input), { status: 201 });
    }
    if (resource === "auth" && id === "login" && request.method === "POST")
      return Response.json(
        await login(request, credentials.parse(await request.json())),
      );
    if (resource === "auth" && id === "logout" && request.method === "POST") {
      await logout();
      return Response.json({ ok: true });
    }
    if (resource === "session" && request.method === "POST") {
      if (!local)
        throw new HttpError(
          403,
          "Phone access requires a named account. Sign in.",
        );
      const body = z
        .object({ mode: z.enum(["operator", "guest"]) })
        .parse(await request.json());
      return Response.json(await openSession(body.mode));
    }
    const user = await identity(
      request,
      resource === "inspections" && action === "review",
    );
    if (
      user.permission === "inspector" &&
      ((resource === "products" && request.method !== "GET") ||
        (resource === "batches" && request.method !== "GET") ||
        request.method === "DELETE")
    )
      requireManager(user);
    if (resource === "auth" && id === "users") {
      if (user.permission !== "admin")
        throw new HttpError(403, "Administrator access required.");
      if (request.method === "GET")
        return Response.json(
          db()
            .prepare(
              "SELECT a.username,a.permission,u.name FROM account a JOIN app_user u ON u.id=a.user_id WHERE u.organization_id=?",
            )
            .all(user.organization_id),
        );
      if (request.method === "POST")
        return Response.json(
          createAccount(accountSchema.parse(await request.json()), false, user),
          { status: 201 },
        );
    }
    if (resource === "workspace" && request.method === "GET")
      return Response.json(
        {
          user,
          products: products(user),
          inspections: inspections(user),
          cloudAvailable: cloudEnabled(),
          batches: batches(user),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (resource === "batches" && request.method === "POST") {
      const input = batchSchema.parse(await request.json());
      if (!products(user).some((p) => p.id === input.productId))
        throw new HttpError(404, "Product not found.");
      const batch = {
        ...input,
        id: randomUUID(),
        status: "OPEN",
        createdAt: new Date().toISOString(),
      };
      transaction(() => {
        db()
          .prepare("INSERT INTO production_batch VALUES (?,?,?,?,?,?,?,?)")
          .run(
            batch.id,
            user.organization_id,
            batch.productId,
            batch.code,
            batch.manufactured,
            batch.expiry,
            batch.status,
            batch.createdAt,
          );
        audit(user, "batch.created", batch.id);
      });
      return Response.json(batch, { status: 201 });
    }
    if (resource === "batches" && id && request.method === "PUT") {
      if (!batches(user).some((b) => b.id === id))
        throw new HttpError(404, "Batch not found.");
      const { status } = z
        .object({ status: z.enum(["OPEN", "CLOSED"]) })
        .parse(await request.json());
      transaction(() => {
        db()
          .prepare("UPDATE production_batch SET status=? WHERE id=?")
          .run(status, id);
        audit(user, `batch.${status.toLowerCase()}`, id);
      });
      return Response.json({ ok: true });
    }
    if (resource === "quality" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("image");
      if (
        !(file instanceof File) ||
        file.size > 10 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        throw new HttpError(400, "Use a PNG/JPEG/WebP below 10 MB.");
      const sharp = (await import("sharp")).default;
      let buffer: Buffer;
      try {
        buffer = await sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 24_000_000,
        })
          .rotate()
          .png()
          .toBuffer();
      } catch {
        throw new HttpError(400, "Invalid or oversized image.");
      }
      return Response.json(await captureQuality(buffer));
    }
    if (resource === "products" && request.method === "POST" && !id) {
      const input = productSchema.parse(await request.json());
      return Response.json(
        transaction(() => createProduct(user, input)),
        { status: 201 },
      );
    }
    if (resource === "products" && id) {
      const product = products(user).find((p) => p.id === id);
      if (!product) throw new HttpError(404, "Product not found.");
      if (request.method === "PUT") {
        const input = productSchema.parse(await request.json());
        transaction(() => {
          db()
            .prepare(
              "UPDATE product SET name=?,sku=? WHERE id=? AND organization_id=?",
            )
            .run(input.name, input.sku, id, user.organization_id);
          db()
            .prepare(
              "UPDATE product_specification SET payload=? WHERE product_id=?",
            )
            .run(JSON.stringify(input), id);
          audit(user, "product.updated", id);
        });
        return Response.json({ ok: true });
      }
      if (request.method === "POST" && action === "reference") {
        const form = await request.formData();
        const file = form.get("image");
        if (!(file instanceof File))
          throw new HttpError(400, "Choose an image.");
        const image = await saveImage(file, user);
        db()
          .prepare("UPDATE product SET reference_id=? WHERE id=?")
          .run(image.id, id);
        audit(user, "reference.updated", id);
        return Response.json({ id: image.id });
      }
      if (request.method === "DELETE") {
        if (
          db().prepare("SELECT id FROM inspection WHERE product_id=?").get(id)
        )
          throw new HttpError(
            409,
            "This product has inspection records. Delete those records first.",
          );
        transaction(() => {
          db().prepare("DELETE FROM product WHERE id=?").run(id);
          audit(user, "product.deleted", id);
        });
        return Response.json({ ok: true });
      }
    }
    if (resource === "images" && id && request.method === "GET") {
      const row = db()
        .prepare("SELECT filename FROM image WHERE id=? AND organization_id=?")
        .get(id, user.organization_id);
      if (!row) throw new HttpError(404, "Image not found.");
      return new Response(
        await readFile(path.join(dataDir, "images", String(row.filename))),
        {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (resource === "inspections" && request.method === "POST" && !id) {
      if (Number(request.headers.get("content-length") || 0) > 11 * 1024 * 1024)
        throw new HttpError(413, "Upload exceeds 10 MB.");
      const form = await request.formData();
      const registered = products(user).find(
        (p) => p.id === form.get("productId"),
      );
      if (!registered) throw new HttpError(404, "Choose an existing product.");
      const batchId = form.get("batchId");
      const batch = batchId
        ? batches(user).find(
            (b) => b.id === batchId && b.productId === registered.id,
          )
        : undefined;
      if (batchId && (!batch || batch.status !== "OPEN"))
        throw new HttpError(400, "Choose an open batch for this product.");
      if (user.permission && !batch)
        throw new HttpError(400, "Select a production batch.");
      const product = batch
        ? {
            ...registered,
            batch: batch.code,
            manufactured: batch.manufactured,
            expiry: batch.expiry,
          }
        : registered;
      const file = form.get("image");
      if (!(file instanceof File)) throw new HttpError(400, "Choose an image.");
      const cloud = form.get("cloud") === "true";
      if (cloud && (!cloudEnabled() || form.get("fictionalConsent") !== "true"))
        throw new HttpError(
          400,
          "Cloud requires a configured free-tier project and confirmation that this is fictional, non-sensitive test data.",
        );
      const image = await saveImage(file, user);
      const quality = await captureQuality(image.data);
      let visual = null;
      if (form.get("compareReference") === "true") {
        const ref = product.referenceId
          ? db()
              .prepare(
                "SELECT filename FROM image WHERE id=? AND organization_id=?",
              )
              .get(product.referenceId, user.organization_id)
          : undefined;
        if (ref)
          visual = await compareReference(
            image.data,
            await readFile(path.join(dataDir, "images", String(ref.filename))),
          );
        else
          visual = {
            method: "Local pixel comparison (experimental)" as const,
            status: "uncertain" as const,
            reason: "No approved reference available.",
            alignmentScore: null,
            offset: null,
            changedFraction: null,
            regions: [],
          };
      }
      const stationEvidence = { quality, visual };
      let ocr: OCRResult;
      try {
        ocr = await extractText(image.data, image.width, image.height);
      } catch (e) {
        ocr = {
          text: "",
          confidence: 0,
          words: [],
          width: image.width,
          height: image.height,
          warnings: [e instanceof Error ? e.message : "OCR failed."],
        };
      }
      let cloudResult = null;
      let cloudError = null;
      if (cloud)
        try {
          cloudResult = await new GeminiProvider().analyze(image.data);
        } catch (e) {
          cloudError =
            e instanceof Error ? e.message : "Cloud analysis failed.";
        }
      const result: Inspection = {
        id: randomUUID(),
        productId: product.id,
        product,
        batchSnapshot: batch,
        stationEvidence,
        imageId: image.id,
        createdAt: new Date().toISOString(),
        ocr,
        analysis: withStationEvidence(verify(product, ocr), stationEvidence),
        cloud: cloudResult,
        cloudError,
        processingMethod: cloudResult
          ? "Local Tesseract OCR + deterministic rules + optional Gemini observations"
          : "Local Tesseract OCR + deterministic rules",
        reviews: [],
        finalStatus: null,
      };
      transaction(() => {
        db()
          .prepare("INSERT INTO inspection VALUES (?,?,?,?,?,?)")
          .run(
            result.id,
            user.organization_id,
            product.id,
            image.id,
            JSON.stringify(result),
            result.createdAt,
          );
        for (const c of result.analysis.comparisons) {
          db()
            .prepare(
              "INSERT INTO extracted_field (inspection_id,name,observed,evidence) VALUES (?,?,?,?)",
            )
            .run(result.id, c.field, c.observed, c.evidence);
          db()
            .prepare(
              "INSERT INTO inspection_finding (inspection_id,name,status,expected) VALUES (?,?,?,?)",
            )
            .run(result.id, c.field, c.status, c.expected);
        }
        audit(user, "inspection.created", result.id);
      });
      return Response.json(result, { status: 201 });
    }
    if (resource === "inspections" && id) {
      const inspection = inspections(user).find((i) => i.id === id);
      if (!inspection) throw new HttpError(404, "Inspection not found.");
      if (request.method === "GET") return Response.json(inspection);
      if (action === "review" && request.method === "POST") {
        const input = reviewSchema.parse(await request.json());
        const corrections = {
          ...inspection.reviews.at(-1)?.corrections,
          ...input.corrections,
        };
        const review: Review = {
          ...input,
          corrections,
          id: randomUUID(),
          reviewer: user.name,
          createdAt: new Date().toISOString(),
          analysis: withStationEvidence(
            verify(inspection.product, inspection.ocr, corrections),
            inspection.stationEvidence,
          ),
        };
        transaction(() => {
          db()
            .prepare("INSERT INTO human_review VALUES (?,?,?,?,?)")
            .run(
              review.id,
              id,
              user.id,
              JSON.stringify(review),
              review.createdAt,
            );
          audit(user, `review.${input.decision.toLowerCase()}`, id);
        });
        return Response.json(review, { status: 201 });
      }
      if (request.method === "DELETE") {
        const image = db()
          .prepare("SELECT filename FROM image WHERE id=?")
          .get(inspection.imageId);
        transaction(() => {
          db().prepare("DELETE FROM inspection WHERE id=?").run(id);
          db().prepare("DELETE FROM image WHERE id=?").run(inspection.imageId);
          audit(user, "inspection.deleted", id);
        });
        if (image)
          await unlink(
            path.join(dataDir, "images", String(image.filename)),
          ).catch(() => {});
        return Response.json({ ok: true });
      }
    }
    if (resource === "audit" && request.method === "GET")
      return Response.json(
        db()
          .prepare(
            "SELECT action,resource_id,created_at FROM audit_event WHERE organization_id=? ORDER BY created_at DESC",
          )
          .all(user.organization_id),
      );
    throw new HttpError(404, "Route not found.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        { error: error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    return errorResponse(error);
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };

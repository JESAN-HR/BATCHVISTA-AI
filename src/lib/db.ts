import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Inspection, Product, ProductInput, Review } from "./domain";
import { sampleProduct } from "./domain";
import type { Batch } from "./station-types";

export const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.BATCHVISTA_DATA_DIR ||
    path.join(process.cwd(), "data"),
);
let singleton: DatabaseSync;
export function db() {
  if (!singleton) {
    mkdirSync(path.join(dataDir, "images"), { recursive: true });
    singleton = new DatabaseSync(path.join(dataDir, "batchvista.sqlite"));
    singleton.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    singleton.exec(
      readFileSync(
        path.join(process.cwd(), "migrations", "001_initial.sql"),
        "utf8",
      ),
    );
    if (
      !singleton.prepare("SELECT version FROM migration WHERE version=2").get()
    ) {
      singleton.exec("BEGIN IMMEDIATE");
      try {
        singleton.exec(
          readFileSync(
            path.join(process.cwd(), "migrations", "002_stations.sql"),
            "utf8",
          ),
        );
        singleton.exec("COMMIT");
      } catch (error) {
        singleton.exec("ROLLBACK");
        throw error;
      }
    }
  }
  return singleton;
}
export type Identity = {
  id: string;
  organization_id: string;
  name: string;
  role: "operator" | "guest";
  permission?: "admin" | "reviewer" | "inspector";
};
export function audit(user: Identity, action: string, resource: string) {
  db()
    .prepare("INSERT INTO audit_event VALUES (?,?,?,?,?,?)")
    .run(
      randomUUID(),
      user.organization_id,
      user.id,
      action,
      resource,
      new Date().toISOString(),
    );
}
export function createProduct(user: Identity, input: ProductInput): Product {
  const product = {
    ...input,
    id: randomUUID(),
    referenceId: null,
    createdAt: new Date().toISOString(),
  };
  db()
    .prepare("INSERT INTO product VALUES (?,?,?,?,?,?)")
    .run(
      product.id,
      user.organization_id,
      product.name,
      product.sku,
      null,
      product.createdAt,
    );
  db()
    .prepare("INSERT INTO product_specification VALUES (?,?)")
    .run(product.id, JSON.stringify(input));
  audit(user, "product.created", product.id);
  db()
    .prepare("INSERT INTO production_batch VALUES (?,?,?,?,?,?,?,?)")
    .run(
      randomUUID(),
      user.organization_id,
      product.id,
      input.batch,
      input.manufactured,
      input.expiry,
      "OPEN",
      product.createdAt,
    );
  return product;
}
export function batches(user: Identity): Batch[] {
  return db()
    .prepare(
      "SELECT id,product_id as productId,code,manufactured,expiry,status,created_at as createdAt FROM production_batch WHERE organization_id=? ORDER BY created_at DESC",
    )
    .all(user.organization_id) as unknown as Batch[];
}
export function products(user: Identity): Product[] {
  const rows = db()
    .prepare(
      "SELECT p.*,s.payload FROM product p JOIN product_specification s ON s.product_id=p.id WHERE p.organization_id=? ORDER BY p.created_at DESC",
    )
    .all(user.organization_id);
  return rows.map((r) => ({
    ...JSON.parse(String(r.payload)),
    id: String(r.id),
    referenceId: r.reference_id ? String(r.reference_id) : null,
    createdAt: String(r.created_at),
  }));
}
export function seed(user: Identity) {
  if (products(user).length) return;
  const product = createProduct(user, sampleProduct);
  const fixture = path.join(process.cwd(), "public", "fixtures", "correct.png");
  if (existsSync(fixture)) {
    const id = randomUUID();
    const filename = `${id}.png`;
    writeFileSync(
      path.join(dataDir, "images", filename),
      readFileSync(fixture),
    );
    db()
      .prepare("INSERT INTO image VALUES (?,?,?,?,?,?)")
      .run(
        id,
        user.organization_id,
        filename,
        1400,
        1000,
        new Date().toISOString(),
      );
    db()
      .prepare("UPDATE product SET reference_id=? WHERE id=?")
      .run(id, product.id);
  }
}
export function inspections(user: Identity): Inspection[] {
  const rows = db()
    .prepare(
      "SELECT id,payload FROM inspection WHERE organization_id=? ORDER BY created_at DESC",
    )
    .all(user.organization_id);
  return rows.map((row) => {
    const reviews = db()
      .prepare(
        "SELECT payload FROM human_review WHERE inspection_id=? ORDER BY created_at, rowid",
      )
      .all(String(row.id))
      .map((r) => JSON.parse(String(r.payload)) as Review);
    return {
      ...JSON.parse(String(row.payload)),
      reviews,
      finalStatus: reviews.at(-1)?.decision || null,
    };
  });
}
export function transaction<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db().exec("COMMIT");
    return result;
  } catch (e) {
    db().exec("ROLLBACK");
    throw e;
  }
}

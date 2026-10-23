import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const origin = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
test("photo → OCR → mismatch → human decision → persisted report", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a real inspection" }).click();
  await page
    .getByLabel("Product specification")
    .selectOption({ label: "Aster Oat Drink · AST-OAT-250" });
  await page.getByRole("button", { name: "Wrong batch", exact: false }).click();
  await page
    .getByRole("button", { name: "Run inspection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence & review" }),
  ).toBeVisible({ timeout: 120000 });
  await expect(
    page.getByText("A readable specification mismatch was found"),
  ).toBeVisible();
  await expect(
    page.locator(".comparison").filter({ hasText: "Batch number" }),
  ).toContainText("BV-2026-099");
  await expect(page.locator(".evidence-boxes rect").first()).toBeAttached();
  await page.getByLabel("Final disposition").selectOption("REJECTED");
  await page
    .getByPlaceholder("Record what you checked")
    .fill(
      "Verified wrong batch against the source label. Rejected for batch mismatch.",
    );
  await page.getByRole("button", { name: "Confirm human decision" }).click();
  await expect(page.getByText("Local operator · REJECTED")).toBeVisible();
  await page.getByRole("button", { name: "Open report" }).click();
  await expect(
    page.getByRole("heading", { name: "Inspection report" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print / Save PDF" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/inspection-report.png",
    fullPage: true,
  });
  const pdf = await page.pdf({
    path: "test-results/inspection-report.pdf",
    format: "A4",
    printBackground: true,
  });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await page.reload();
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page
    .getByRole("button", { name: "Inspection history", exact: true })
    .click();
  await expect(page.locator("tbody tr").first()).toContainText("Rejected");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("access controls, guest isolation, validation and persistence", async ({
  request,
  browser,
}) => {
  const headers = { Origin: origin };
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect(
    (
      await request.post("/api/session", {
        headers: { Origin: "https://evil.example" },
        data: { mode: "operator" },
      })
    ).status(),
  ).toBe(403);
  await request.post("/api/session", { headers, data: { mode: "operator" } });
  const workspace = await (await request.get("/api/workspace")).json();
  const product = workspace.products.find(
    (p: { sku: string }) => p.sku === "AST-OAT-250",
  );
  const created = await request.post("/api/inspections", {
    headers,
    multipart: {
      productId: product.id,
      image: {
        name: "synthetic-correct.png",
        mimeType: "image/png",
        buffer: await readFile("public/fixtures/correct.png"),
      },
    },
  });
  expect(created.status()).toBe(201);
  const inspection = await created.json();
  expect(inspection.analysis.recommendation).toBe("PASS");
  const guest = await browser.newContext();
  await guest.request.post("/api/session", {
    headers,
    data: { mode: "guest" },
  });
  expect(
    (await guest.request.get(`/api/inspections/${inspection.id}`)).status(),
  ).toBe(404);
  expect(
    (await guest.request.get(`/api/images/${inspection.imageId}`)).status(),
  ).toBe(404);
  expect(
    (
      await guest.request.post(`/api/inspections/${inspection.id}/review`, {
        headers,
        data: { decision: "ACCEPTED", note: "Guest cannot approve" },
      })
    ).status(),
  ).toBe(403);
  const invalid = await request.post("/api/inspections", {
    headers,
    multipart: {
      productId: workspace.products[0].id,
      image: {
        name: "not-an-image.png",
        mimeType: "image/png",
        buffer: Buffer.from("not an image"),
      },
    },
  });
  expect(invalid.status()).toBe(400);
  const cloud = await request.post("/api/inspections", {
    headers,
    multipart: {
      productId: workspace.products[0].id,
      cloud: "true",
      image: {
        name: "synthetic.png",
        mimeType: "image/png",
        buffer: await readFile("public/fixtures/correct.png"),
      },
    },
  });
  expect(cloud.status()).toBe(400);
  expect(
    (
      await request.delete(`/api/inspections/${inspection.id}`, { headers })
    ).status(),
  ).toBe(200);
  expect(
    (await request.get(`/api/images/${inspection.imageId}`)).status(),
  ).toBe(404);
  await guest.close();
});
test("product registration and editing", async ({ page }) => {
  const sku = `TEST-${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page
    .getByRole("button", { name: "Product catalog", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Register product", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Product name", { exact: true })
    .fill("Fictional Test Soap");
  await dialog.getByLabel("SKU", { exact: true }).fill(sku);
  await dialog.getByLabel("Batch number", { exact: true }).fill("DEMO-001");
  await dialog.getByLabel("Net quantity", { exact: true }).fill("100 g");
  await dialog.getByRole("button", { name: "Save specifications" }).click();
  await expect(dialog).not.toBeVisible();
  const card = page.locator(".product-card").filter({ hasText: sku });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Edit specifications" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Batch number", { exact: true })
    .fill("DEMO-002");
  await page.getByRole("button", { name: "Save specifications" }).click();
  await expect(card).toContainText("DEMO-002");
  await card
    .locator("input[type=file]")
    .setInputFiles("public/fixtures/correct.png");
  await expect(
    card.getByRole("img", {
      name: "Approved reference for Fictional Test Soap",
    }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await card
    .getByRole("button", { name: "Delete Fictional Test Soap" })
    .click();
  await expect(card).not.toBeVisible();
});

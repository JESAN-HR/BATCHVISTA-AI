import { test, expect } from "@playwright/test";

test("missing OCR asset reports a real error without saving fabricated results", async ({
  page,
}) => {
  await page.route("**/ocr/worker.min.js", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Open browser workspace" }).click();
  await page
    .getByRole("button", { name: "Approved label", exact: true })
    .click();
  await page.getByRole("button", { name: "Run real inspection" }).click();
  await expect(page.locator(".browser-error")).toContainText(
    "OCR could not complete",
    { timeout: 100000 },
  );
  await page
    .getByRole("button", { name: "Inspection history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No inspections yet" }),
  ).toBeVisible();
});

test("stale browser tabs cannot silently overwrite newer records", async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  for (const tab of [page, second]) {
    await tab.goto("/");
    await tab.getByRole("button", { name: "Open browser workspace" }).click();
    await tab
      .getByRole("button", { name: "Product catalog", exact: true })
      .click();
    await tab.getByRole("button", { name: "Edit specifications" }).click();
  }
  await page
    .getByLabel("Product name", { exact: true })
    .fill("First tab fictional change");
  await page.getByRole("button", { name: "Save specification" }).click();
  await expect(
    page.getByRole("heading", {
      name: "First tab fictional change",
      exact: true,
    }),
  ).toBeVisible();
  await second
    .getByLabel("Product name", { exact: true })
    .fill("Stale tab change");
  await second.getByRole("button", { name: "Save specification" }).click();
  await expect(second.locator(".browser-error")).toContainText(
    "Another tab changed",
  );
  await second.close();
});

test("real browser OCR, local persistence, review, export, report and deletion without application APIs", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  context.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await page.getByRole("button", { name: "Open browser workspace" }).click();
  await page.getByRole("button", { name: "Wrong batch", exact: true }).click();
  await page.getByRole("button", { name: "Run real inspection" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence & review" }),
  ).toBeVisible({ timeout: 120000 });
  await expect(
    page.getByRole("heading", { name: "Machine recommendation: FAIL" }),
  ).toBeVisible();
  await expect(
    page.locator(".browser-image-evidence span").first(),
  ).toBeVisible();
  await page.getByLabel("Reviewer name").fill("Fictional Browser Reviewer");
  await page.getByLabel("Final disposition").selectOption("REJECTED");
  await page
    .getByLabel("Review rationale")
    .fill("Verified the wrong batch from actual synthetic image pixels.");
  await page.getByRole("button", { name: "Confirm human decision" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Browser Reviewer · REJECTED",
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const exportFile = await download;
  expect(exportFile.suggestedFilename()).toMatch(/^batchvista-.*\.json$/);
  const stream = await exportFile.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(Buffer.from(c));
  const saved = JSON.parse(Buffer.concat(chunks).toString());
  expect(saved.ocr.text).toContain("BV-2026-099");
  expect(saved.finalStatus).toBe("REJECTED");
  expect(saved.image).toMatch(/^data:image\/png;base64,/);
  await page.getByRole("button", { name: "Open report" }).click();
  const pdf = await page.pdf({
    path: "test-results-browser/report.pdf",
    format: "A4",
  });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await page.screenshot({
    path: "test-results-browser/report.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Open browser workspace" }).click();
  await page
    .getByRole("button", { name: "Inspection history", exact: true })
    .click();
  await expect(page.locator(".browser-history-item")).toHaveCount(1);
  await page.locator(".browser-history-item").click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Browser Reviewer · REJECTED",
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results-browser/mobile.png",
    fullPage: true,
  });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete inspection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No inspections yet" }),
  ).toBeVisible();
  expect(requests.filter((url) => url.includes("/api/"))).toEqual([]);
  expect(
    requests.filter(
      (url) =>
        /^https?:/.test(url) && new URL(url).origin !== "http://127.0.0.1:3103",
    ),
  ).toEqual([]);
  expect((await page.request.get("/api/workspace")).status()).toBe(404);
});

test("correct and unreadable pixels, product editing and invalid file handling", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open browser workspace" }).click();
  await page.getByLabel("Package photograph").setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.locator(".browser-error")).toContainText(
    "could not be decoded",
  );
  for (const [fixture, result] of [
    ["Approved label", "PASS"],
    ["Low resolution", "REVIEW"],
  ]) {
    await page.getByRole("button", { name: fixture, exact: true }).click();
    await page.getByRole("button", { name: "Run real inspection" }).click();
    await expect(
      page.getByRole("heading", { name: `Machine recommendation: ${result}` }),
    ).toBeVisible({ timeout: 120000 });
    if (result === "REVIEW")
      await expect(page.locator(".browser-image-evidence span")).toHaveCount(0);
    await page.getByRole("button", { name: "Inspect next package" }).click();
  }
  await page
    .getByRole("button", { name: "Product catalog", exact: true })
    .click();
  await page.getByRole("button", { name: "Register product" }).click();
  await page.getByLabel("SKU", { exact: true }).fill("BROWSER-FICTIONAL");
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Fictional Browser Product");
  await page
    .getByLabel("Approved reference image")
    .setInputFiles("public/fixtures/correct.png");
  await expect(page.getByAltText("Reference preview")).toBeVisible();
  await page.getByRole("button", { name: "Save specification" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Browser Product",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Open browser workspace" }).click();
  await page
    .getByRole("button", { name: "Product catalog", exact: true })
    .click();
  await expect(
    page.getByAltText("Approved Fictional Browser Product"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Data & settings" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Erase browser records" }).click();
  await expect(page.getByRole("status")).toContainText(
    "All workspace records erased",
  );
});

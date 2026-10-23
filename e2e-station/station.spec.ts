import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:3102";
test("mobile capture, batch standard, local difference evidence, named review and inspector permissions", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Set up named accounts" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your name").fill("Fictional Reviewer");
  await dialog.getByLabel("Username", { exact: true }).fill("demo-admin");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-2026");
  await dialog.getByRole("button", { name: "Create administrator" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Batch stations", exact: true })
    .click();
  await page
    .getByLabel("Production code", { exact: true })
    .fill("BV-2026-042-B");
  await page.getByLabel("Manufactured", { exact: true }).fill("2026-10-01");
  await page.getByLabel("Expiry", { exact: true }).fill("2027-04-01");
  await page.getByRole("button", { name: "Create batch", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "BV-2026-042-B" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "New inspection +", exact: true })
    .click();
  await page.getByRole("button", { name: "Open live camera" }).click();
  await expect(page.locator("video")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).videoWidth),
    )
    .toBeGreaterThan(0);
  const cameraTrack = await page
    .locator("video")
    .evaluateHandle(
      (v) =>
        ((v as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0],
    );
  await page.getByRole("button", { name: "Capture photograph" }).click();
  await expect(page.getByAltText("Selected package image")).toBeVisible();
  await expect
    .poll(() => cameraTrack.evaluate((track) => track.readyState))
    .toBe("ended");
  await cameraTrack.dispose();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  // Use actual label pixels for inspection; the virtual camera tests capture lifecycle only.
  const state = await (await page.request.get("/api/workspace")).json();
  const batch = state.batches.find(
    (b: { code: string }) => b.code === "BV-2026-042",
  );
  await page
    .getByLabel("Production batch", { exact: true })
    .selectOption(batch.id);
  await page
    .getByRole("button", { name: "Missing print", exact: false })
    .click();
  await page
    .getByLabel("Compare approved reference locally (experimental)")
    .check();
  await page
    .getByRole("button", { name: "Run inspection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence & review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reference comparison — differences" }),
  ).toBeVisible();
  await expect(page.locator(".visual-map span").first()).toBeVisible();
  await page.getByLabel("Final disposition").selectOption("HOLD");
  await page
    .getByPlaceholder("Record what you checked")
    .fill("Fictional print omission requires manual investigation.");
  await page.getByRole("button", { name: "Confirm human decision" }).click();
  await expect(page.getByText("Fictional Reviewer · HOLD")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results-station/mobile-evidence.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Inspect next package" }).click();
  await expect(
    page.getByLabel("Production batch", { exact: true }),
  ).toHaveValue(batch.id);
  const headers = { Origin: origin };
  expect(
    (
      await page.request.post("/api/session", {
        headers,
        data: { mode: "operator" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/users", {
        headers,
        data: {
          name: "Fictional Capture",
          username: "capture",
          password: "fictional-password-2026",
          permission: "inspector",
        },
      })
    ).status(),
  ).toBe(201);
  const inspector = await browser.newContext({ baseURL: origin });
  expect(
    (
      await inspector.request.post("/api/auth/login", {
        headers,
        data: { username: "capture", password: "fictional-password-2026" },
      })
    ).status(),
  ).toBe(200);
  const latest = await (await inspector.request.get("/api/workspace")).json();
  const inspection = latest.inspections[0];
  expect(
    (
      await inspector.request.post(`/api/inspections/${inspection.id}/review`, {
        headers,
        data: { decision: "ACCEPTED", note: "Forbidden inspector review" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await inspector.request.post("/api/batches", {
        headers,
        data: {
          productId: batch.productId,
          code: "FORBIDDEN",
          manufactured: "",
          expiry: "",
        },
      })
    ).status(),
  ).toBe(403);
  await page.request.put(`/api/batches/${batch.id}`, {
    headers,
    data: { status: "CLOSED" },
  });
  expect(
    (
      await page.request.post("/api/inspections", {
        headers,
        multipart: {
          productId: batch.productId,
          batchId: batch.id,
          image: {
            name: "test.png",
            mimeType: "image/png",
            buffer: await readFile("public/fixtures/correct.png"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  await inspector.close();
});

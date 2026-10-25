import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e-browser",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3103",
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm start -- --port 3103",
    url: "http://127.0.0.1:3103",
    reuseExistingServer: false,
    timeout: 120000,
    env: { BATCHVISTA_MODE: "browser" },
  },
  reporter: [["list"]],
  outputDir: "test-results-browser",
});

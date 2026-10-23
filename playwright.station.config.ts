import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./e2e-station",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3102",
    channel: "msedge",
    headless: true,
    viewport: { width: 390, height: 844 },
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm start -- --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      BATCHVISTA_DATA_DIR: path.join(
        process.cwd(),
        "data",
        `station-test-${Date.now()}`,
      ),
    },
  },
  reporter: [["list"]],
  outputDir: "test-results-station",
});

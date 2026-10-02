import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  outputDir: "../output/playwright/results",
  reporter: [
    ["list"],
    ["json", { outputFile: "../output/playwright/report.json" }],
  ],
  use: {
    baseURL: process.env.V2_E2E_FRONTEND || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});

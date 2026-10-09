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
    // Optional version-matched Linux browser server; loopback targets are
    // forwarded to the host test stack without exposing it on the network.
    connectOptions: process.env.V2_E2E_BROWSER_WS
      ? {
          wsEndpoint: process.env.V2_E2E_BROWSER_WS,
          exposeNetwork: "<loopback>",
        }
      : undefined,
    baseURL: process.env.V2_E2E_FRONTEND || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // A real Android phone profile (touch, 412px viewport, mobile user agent)
    // for the passkey sign-in path farmers use on their phones.
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: /passkeys\.spec\.js/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: /passkeys\.spec\.js/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: /passkeys\.spec\.js/,
    },
  ],
});

import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test("anonymous farm entry on a throttled mobile connection", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "CDP throttling is Chromium-only; functional matrix covers all browsers",
  );
  test.setTimeout(60000);
  await page.setViewportSize({ width: 360, height: 800 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: 50000,
    uploadThroughput: 25000,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const started = Date.now();
  await page.goto("/app/today");
  await expect(
    page
      .getByRole("heading", {
        name: "A good day starts with a clearer picture.",
      })
      .first(),
  ).toBeVisible({ timeout: 30000 });
  const readyMs = Date.now() - started;
  const assets = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      name: new URL(entry.name).pathname,
      bytes: entry.transferSize,
    })),
  );
  expect(assets.some((asset) => /\/map\//.test(asset.name))).toBe(false);
  expect(readyMs).toBeLessThan(30000);
  await fs.mkdir("../output", { recursive: true });
  await fs.writeFile(
    "../output/mobile-performance.json",
    JSON.stringify(
      {
        scope:
          "fresh anonymous Chromium mobile viewport, local production build",
        readyMs,
        viewport: 360,
        latencyMs: 400,
        downloadBytesPerSecond: 50000,
        cpuSlowdown: 4,
        assets,
        limitations: [
          "Emulation is not a physical low-end Android or iOS device",
          "Local origin is not public deployment performance",
        ],
      },
      null,
      2,
    ),
  );
});

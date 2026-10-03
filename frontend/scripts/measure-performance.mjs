import fs from "node:fs/promises";
import path from "node:path";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { launch } from "chrome-launcher";
import { chromium } from "@playwright/test";

const origin = process.env.PERFORMANCE_ORIGIN || "http://localhost:3000";
const destination = path.resolve("../output/product/performance");
await fs.mkdir(destination, { recursive: true });
const runs = [];
for (const formFactor of ["mobile", "desktop"]) {
  for (const route of ["/", "/for-farmers", "/app/today"]) {
    for (let iteration = 1; iteration <= 3; iteration++) {
      const chrome = await launch({
        chromePath: chromium.executablePath(),
        chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const result = await lighthouse(
          new URL(route, origin).href,
          {
            port: chrome.port,
            output: ["json", "html"],
            logLevel: "error",
            onlyCategories: [
              "performance",
              "accessibility",
              "best-practices",
              "seo",
            ],
          },
          formFactor === "desktop" ? desktopConfig : undefined,
        );
        const { lhr, report } = result;
        if (lhr.configSettings.formFactor !== formFactor)
          throw new Error("Unexpected measurement configuration");
        const id = `${formFactor}-${route.replace(/\W/g, "") || "home"}-${iteration}`;
        await fs.writeFile(path.join(destination, `${id}.json`), report[0]);
        await fs.writeFile(path.join(destination, `${id}.html`), report[1]);
        const run = {
          route,
          formFactor,
          iteration,
          lighthouseVersion: lhr.lighthouseVersion,
          fetchedAt: lhr.fetchTime,
          categories: Object.fromEntries(
            Object.entries(lhr.categories).map(([key, value]) => [
              key,
              value.score,
            ]),
          ),
          metrics: Object.fromEntries(
            [
              "first-contentful-paint",
              "largest-contentful-paint",
              "cumulative-layout-shift",
              "total-blocking-time",
              "speed-index",
              "total-byte-weight",
            ].map((key) => [key, lhr.audits[key]?.numericValue]),
          ),
          warnings: lhr.runWarnings,
        };
        runs.push(run);
        console.log(JSON.stringify(run));
        await fs.writeFile(
          path.join(destination, "summary.json"),
          JSON.stringify(
            {
              scope:
                "Fresh Chromium profiles; production build; Lighthouse default simulated mobile and desktop throttling; local or explicitly supplied origin.",
              origin,
              runs,
              limitations: [
                "Lab emulation is not physical farmer-device testing.",
                "No field INP, CrUX or Search Console evidence is claimed.",
                "Private entry measurements cover the anonymous shell; signed-in API latency needs deployment data.",
              ],
            },
            null,
            2,
          ),
        );
      } finally {
        await chrome.kill();
      }
    }
  }
}

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import http from "node:http";

// Synthetic development identity only. No paid provider calls or production PII.
async function signIn(page, mobile) {
  await page.goto("/farm");
  if (process.env.V2_E2E_PRODUCTION === "true") {
    await page.waitForFunction(() => navigator.serviceWorker?.controller, {
      timeout: 15000,
    });
    await page.reload(); // Cache downloaded shell assets after worker activation.
  }
  await expect(page.getByText(/Development only/)).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Sign out and clear this device" })
      .isVisible()
  )
    return;
  await page.getByLabel("Mobile number", { exact: true }).fill(mobile);
  await page
    .getByRole("checkbox", { name: /I agree to account processing/ })
    .check();
  await page.getByRole("button", { name: "Send verification code" }).click();
  await page.getByLabel("Verification code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(
    page.getByRole("navigation", { name: "Farm navigation" }),
  ).toBeVisible();
}

let page, context, outageServer;
// Playwright 1.63 WebKit's offline emulation rejects even literal service-worker
// navigation responses (microsoft/playwright#42775). Close a real local origin
// instead, keeping this browser's offline reload and recovery assertions intact.
async function setDisconnected(disconnected) {
  if (!outageServer) return context.setOffline(disconnected);
  if (disconnected) {
    const closed = new Promise((resolve) => outageServer.close(resolve));
    outageServer.closeAllConnections();
    await closed;
  } else if (!outageServer.listening) {
    await new Promise((resolve, reject) => {
      outageServer.once("error", reject);
      outageServer.listen(3001, "127.0.0.1", resolve);
    });
  }
}
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }, testInfo) => {
  let baseURL = testInfo.project.use.baseURL;
  if (testInfo.project.name === "webkit") {
    const target = new URL(baseURL);
    outageServer = http.createServer((incoming, response) => {
      const upstream = http.request(
        new URL(incoming.url, target),
        {
          method: incoming.method,
          headers: { ...incoming.headers, host: target.host },
        },
        (received) => {
          response.writeHead(received.statusCode, received.headers);
          received.pipe(response);
        },
      );
      upstream.on("error", () => response.destroy());
      incoming.pipe(upstream);
    });
    await setDisconnected(false);
    baseURL = "http://localhost:3001";
  }
  context = await browser.newContext({ baseURL });
  page = await context.newPage();
  const identity = {
    chromium: "+919000000001",
    firefox: "+919000000002",
    webkit: "+919000000003",
  }[testInfo.project.name];
  await signIn(page, identity);
});
test.afterAll(async () => {
  await context?.close();
  if (outageServer?.listening) await setDisconnected(true);
});

test("farmer onboarding, manual field, consent, observation, crop cycle and export", async () => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "My Farm", exact: true }).click();
  await page
    .getByLabel("Farm name", { exact: true })
    .fill(`E2E synthetic farm ${Date.now()}`);
  await page.getByRole("button", { name: "Create farm", exact: true }).click();
  await expect(
    page.getByLabel("Farm", { exact: true }).locator("option"),
  ).not.toHaveCount(1);
  await page
    .getByLabel("Field name", { exact: true })
    .fill(`E2E synthetic field ${Date.now()}`);
  await page.getByLabel("Manual area (hectares)", { exact: true }).fill("1.2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Manual area — boundary not mapped").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "agronomic analysis", exact: true })
    .check();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .getByLabel("What did you see or do?", { exact: true })
    .fill("Synthetic E2E inspection; no measured crop outcome.");
  await page.getByRole("button", { name: "Record observation" }).click();
  await expect(
    page.getByText("Synthetic E2E inspection; no measured crop outcome.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My Farm", exact: true }).click();
  await page.getByLabel("Crop", { exact: true }).fill("Tomato");
  await page.getByLabel("Sowing date", { exact: true }).fill("2026-09-01");
  await page
    .getByLabel("Expected harvest date", { exact: true })
    .fill("2026-12-01");
  await page.getByRole("button", { name: "Save crop cycle" }).click();
  await expect(
    page.getByText("Tomato · 2026-09-01 → 2026-12-01"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my account" }).click();
  expect((await download).suggestedFilename()).toBe("krishyak-account.json");
  expect(errors).toEqual([]);
});

test("mobile critical controls and accessibility", async () => {
  for (const width of [320, 360, 375, 390, 412, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("field edits, cycle status and measured soil entry", async () => {
  await page.getByRole("button", { name: "My Farm", exact: true }).click();
  await page.getByText(/Edit selected field:/).click();
  await page
    .getByLabel("Updated field name", { exact: true })
    .fill(`Edited synthetic field ${Date.now()}`);
  await page.getByRole("button", { name: "Update field", exact: true }).click();
  await expect(
    page.getByText(/Edit selected field: Edited synthetic/),
  ).toBeVisible();
  await page.getByText("Tomato · active · edit cycle").click();
  await page.getByLabel("Cycle status").selectOption("completed");
  await page.getByRole("button", { name: "Update cycle", exact: true }).click();
  await expect(page.getByText("Tomato · completed · edit cycle")).toBeVisible();
  await page.getByText("Enter a soil-card, lab or sensor reading").click();
  await page
    .getByLabel("Soil source name", { exact: true })
    .fill("Synthetic soil-card entry");
  await page.getByLabel("Soil value", { exact: true }).fill("6.5");
  await page
    .getByRole("button", { name: "Save soil evidence", exact: true })
    .click();
  await expect(page.getByText(/ph: 6.5 pH/)).toBeVisible();
  await expect(
    page.getByText(
      "Farmer-reported evidence; source and measurements are not independently verified.",
    ),
  ).toBeVisible();
});

test("unsupported crop photo, feedback, private download and deletion", async () => {
  await page.getByRole("button", { name: "Crop Health", exact: true }).click();
  await page
    .getByLabel("Crop", { exact: true })
    .fill("Synthetic unsupported crop");
  await page.getByLabel("Crop photograph", { exact: true }).setInputFiles({
    name: "synthetic-pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Analyze crop photo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "unsupported", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unsure", exact: true }).click();
  await expect(page.getByText("Feedback saved.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download private photograph" })
    .first()
    .click();
  expect((await download).suggestedFilename()).toBe("krishyak-crop-photo.jpg");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete photograph", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Download private photograph" }),
  ).toHaveCount(0, { timeout: 15000 });
  await page.getByRole("button", { name: "Benefits", exact: true }).click();
  await expect(
    page.getByText(
      "Official eligibility and enrollment have not been verified.",
      { exact: false },
    ),
  ).toBeVisible();
});

test("offline observation synchronizes once and logout clears private cached records", async () => {
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "Save my fields on this device for offline use",
    })
    .check();
  await expect(
    page.getByRole("button", { name: "Record observation" }),
  ).toBeEnabled();
  await setDisconnected(true);
  if (process.env.V2_E2E_PRODUCTION === "true") {
    await page.reload();
    await expect(
      page.getByRole("navigation", { name: "Farm navigation" }),
    ).toBeVisible();
    await expect(page.getByText(/Saved on this device:/).first()).toBeVisible();
  }
  await page
    .getByLabel("What did you see or do?", { exact: true })
    .fill("Synthetic offline observation");
  await page.getByRole("button", { name: "Record observation" }).click();
  await expect(
    page.getByText(
      "Saved on this device. It will sync after you reconnect and sign in.",
    ),
  ).toBeVisible();
  await setDisconnected(false);
  await expect(
    page.getByRole("button", { name: /Sync saved observations/ }),
  ).toHaveCount(0, { timeout: 15000 });
  await setDisconnected(true);
  await page
    .getByRole("button", { name: "Sign out and clear this device" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your farm" }).first(),
  ).toBeVisible();
  await setDisconnected(false);
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Farm navigation" }),
  ).toHaveCount(0);
});

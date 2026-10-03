import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import http from "node:http";
import fs from "node:fs/promises";

let page, context, outageServer, fieldName;
async function disconnected(value) {
  if (!outageServer) return context.setOffline(value);
  if (value) {
    const closed = new Promise((resolve) => outageServer.close(resolve));
    outageServer.closeAllConnections();
    await closed;
  } else if (!outageServer.listening)
    await new Promise((resolve, reject) => {
      outageServer.once("error", reject);
      outageServer.listen(3001, "127.0.0.1", resolve);
    });
}
const navigation = (name) =>
  page
    .getByRole("navigation", { name: "Workspace navigation", exact: true })
    .getByRole("link", { name, exact: true });
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }, info) => {
  let baseURL = info.project.use.baseURL;
  // Preserve the actual-origin outage check for WebKit instead of its known
  // service-worker offline-emulation limitation (Playwright #42775).
  if (info.project.name === "webkit") {
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
    await disconnected(false);
    baseURL = "http://localhost:3001";
  }
  context = await browser.newContext({ baseURL });
  page = await context.newPage();
  const status = await (await context.request.get("/api/v2/status")).json();
  expect(
    status.development_identity,
    "Never run account fixtures against a real OTP provider",
  ).toBe(true);
  await page.goto("/app/today");
  await expect(
    page.getByText("Development account service · test data only."),
  ).toBeVisible();
  if (process.env.V2_E2E_PRODUCTION === "true") {
    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker?.controller),
      null,
      { timeout: 20000 },
    );
    await page.reload();
  }
  const mobile = {
    chromium: "+919000000001",
    firefox: "+919000000002",
    webkit: "+919000000003",
  }[info.project.name];
  await page.getByLabel("Mobile number", { exact: true }).fill(mobile);
  await page.getByRole("checkbox", { name: /I accept the Terms/ }).check();
  await page
    .getByRole("button", { name: "Send sign-in code", exact: true })
    .click();
  await page.getByLabel("Six-digit code", { exact: true }).fill("123456");
  await page
    .getByRole("button", { name: "Verify & continue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Today on your farm.", exact: true }),
  ).toBeVisible();
});
test.afterAll(async () => {
  await context?.close();
  if (outageServer?.listening) await disconnected(true);
});

test("field onboarding, permissions, human update, crop cycle and account export", async () => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await navigation("Farm").click();
  await page.getByRole("button", { name: "Add a field", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (await dialog.getByRole("combobox", { name: "Farm", exact: true }).count())
    await dialog
      .getByRole("combobox", { name: "Farm", exact: true })
      .selectOption("");
  await dialog
    .getByLabel("Farm name", { exact: true })
    .fill(`Synthetic product farm ${Date.now()}`);
  fieldName = `Synthetic product field ${Date.now()}`;
  await dialog.getByLabel("Field name", { exact: true }).fill(fieldName);
  await dialog.getByLabel("Field area (hectares)", { exact: true }).fill("1.2");
  expect(await dialog.getByRole("textbox", { name: /GeoJSON/ }).count()).toBe(
    0,
  );
  await dialog.getByRole("button", { name: "Save field", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: fieldName, exact: true }),
  ).toBeVisible();
  await page.goto("/app/more/settings");
  await page
    .getByRole("checkbox", { name: /Analyse my field records and photos/ })
    .check();
  await navigation("Today").click();
  await expect(
    page.getByRole("combobox", { name: "Selected field" }),
  ).toHaveValue(/.+/);
  await page
    .getByRole("button", { name: "Record an update", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Something I noticed", exact: true })
    .click();
  await page
    .getByLabel("What happened?", { exact: true })
    .fill("Synthetic inspection; no measured crop outcome.");
  await page
    .getByRole("button", { name: "Save field update", exact: true })
    .click();
  await expect(
    page.getByText("Synthetic inspection; no measured crop outcome.", {
      exact: true,
    }),
  ).toBeVisible();
  await navigation("Farm").click();
  await page
    .getByRole("button", { name: "Add crop cycle", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Crop", { exact: true })
    .fill("Tomato");
  await page.getByLabel("Sowing date", { exact: true }).fill("2026-09-01");
  await page.getByLabel("Expected harvest", { exact: true }).fill("2026-12-01");
  await page
    .getByRole("button", { name: "Save crop cycle", exact: true })
    .click();
  await expect(page.getByText(/2026-09-01 → 2026-12-01/).first()).toBeVisible();
  await page.goto("/app/more/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my account data" }).click();
  expect((await download).suggestedFilename()).toBe("krishyak-account.json");
  expect(errors).toEqual([]);
});

test("mobile controls, nine viewports and workspace accessibility", async () => {
  for (const width of [320, 360, 375, 390, 412, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        { message: `Overflow at ${width}` },
      )
      .toBe(true);
  }
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("revision-aware field edits, completed cycle and reported soil evidence", async () => {
  await navigation("Farm").click();
  await page
    .getByText("Manage farms, field details & crop cycles", { exact: true })
    .click();
  await page
    .getByText(`Edit selected field: ${fieldName}`, { exact: true })
    .click();
  fieldName = `Edited synthetic field ${Date.now()}`;
  await page.getByLabel("Updated field name", { exact: true }).fill(fieldName);
  await page.getByRole("button", { name: "Update field", exact: true }).click();
  await expect(
    page.getByText(`Edit selected field: ${fieldName}`, { exact: true }),
  ).toBeVisible();
  await page.getByText("Tomato · active · edit cycle", { exact: true }).click();
  await page.getByLabel("Cycle status").selectOption("completed");
  await page.getByRole("button", { name: "Update cycle", exact: true }).click();
  await expect(
    page.getByText("Tomato · completed · edit cycle", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Enter a soil-card, lab or sensor reading", { exact: true })
    .click();
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

test("unsupported crop photo, feedback, private download, deletion and official-benefit limits", async () => {
  await navigation("Scan").click();
  await expect(
    page
      .getByRole("combobox", { name: "Crop", exact: true })
      .locator("option", { hasText: "Other / not listed" }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Crop", exact: true })
    .selectOption("Unsupported");
  await page.getByLabel("Choose crop photo", { exact: true }).setInputFiles({
    name: "synthetic-pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Check this photograph", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "No supported classification",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Not sure", exact: true }).click();
  await expect(page.getByText("Your feedback was saved.")).toBeVisible();
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
  ).toHaveCount(0);
  await page.goto("/app/more/benefits");
  await expect(
    page.getByText(
      /Official eligibility and enrollment have not been verified/,
    ),
  ).toBeVisible();
});

test("preserved simulation, comparison and recommendations use the real API", async () => {
  await page.goto("/app/more/planning");
  await page
    .getByRole("button", { name: "Run Simulation", exact: true })
    .click();
  await expect(page.locator(".dashboard-results")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "Compare scenarios", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Compare scenarios", exact: true })
    .click();
  await expect(page.locator(".planning-results")).not.toContainText(
    "No simulation data yet",
  );
  await page
    .getByRole("button", { name: "Ideas to consider", exact: true })
    .click();
  await expect(page.locator(".planning-results")).not.toContainText(
    "Running the scenario",
  );
});

test("farmer routes, zoom, reduced motion and accessible navigation", async ({}, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fs.mkdir(`../output/product/screenshots/${info.project.name}`, {
    recursive: true,
  });
  const violations = [];
  for (const route of [
    "/app/today",
    "/app/farm",
    "/app/health",
    "/app/market",
    "/app/more",
    "/app/more/settings",
    "/app/more/benefits",
    "/app/more/planning",
    "/institution",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Opening your workspace…" }),
    ).not.toBeVisible();
    for (const width of [320, 360, 375, 390, 412, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          { message: `${route} at ${width}px` },
        )
        .toBe(true);
    }
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    violations.push(
      ...axe.violations.map((item) => ({
        route,
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    );
    await page.screenshot({
      path: `../output/product/screenshots/${info.project.name}/private-${route.replace(/\W/g, "-")}-1440.png`,
      fullPage: true,
    });
  }
  expect(violations).toEqual([]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/today");
  // A 640px CSS viewport at 1280px display width represents 200% browser zoom.
  await page.setViewportSize({ width: 640, height: 450 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("navigation", {
      name: "Mobile workspace navigation",
      exact: true,
    }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("offline reload, idempotent synchronization and logout clears private records", async () => {
  await page.goto("/app/more/settings");
  await page
    .getByRole("checkbox", { name: /Keep farm records for offline use/ })
    .check();
  await expect(
    page.getByText("Offline records saved on this device.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Keep farm records for offline use/ }),
  ).toBeChecked();
  await navigation("Today").click();
  await expect(
    page.getByRole("button", { name: "Record an update", exact: true }),
  ).toBeVisible();
  await disconnected(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Today on your farm.", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Saved on this device:/).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Record an update", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Something I noticed", exact: true })
    .click();
  await page
    .getByLabel("What happened?", { exact: true })
    .fill("Synthetic offline product observation");
  await page
    .getByRole("button", { name: "Save field update", exact: true })
    .click();
  await expect(
    page.getByText(
      "Saved on this device. Your update will sync when the connection returns.",
    ),
  ).toBeVisible();
  await disconnected(false);
  await expect(
    page.getByText("Synthetic offline product observation", { exact: true }),
  ).toHaveCount(1, { timeout: 20000 });
  await page.goto("/app/more/settings");
  await disconnected(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "A good day starts with a clearer picture.",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("krishyak_v2_offline_owner"),
    ),
  ).toBeNull();
  await disconnected(false);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "A good day starts with a clearer picture.",
      exact: true,
    }),
  ).toBeVisible();
});

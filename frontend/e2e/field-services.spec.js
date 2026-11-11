import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

// Pest Radar, the crop calendar, Claim Kit, Krishyak Live and group sharing on
// a fresh passkey account (Chromium's virtual authenticator). Provider-backed
// answers are covered by the live staging smoke; here every screen must load,
// explain itself, stay accessible and never overflow a phone.
test.describe.configure({ mode: "serial" });

let context, page, csrf, plot;
const violations = [];

async function api(method, url, data) {
  const response = await page.request.fetch(url, {
    method,
    data,
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrf },
  });
  expect(response.ok(), `${method} ${url} ${response.status()}`).toBe(true);
  return response.json();
}
async function audit(name) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `${name} overflows`,
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  violations.push(
    ...result.violations.map((item) => ({
      name,
      id: item.id,
      nodes: item.nodes.map((node) => node.target.join(" ")),
    })),
  );
  await page.screenshot({
    path: `../output/product/screenshots/features/${name}-${page.viewportSize().width}.png`,
    fullPage: true,
  });
}

test.beforeAll(async ({ browser }, info) => {
  test.skip(info.project.name !== "chromium", "Chromium virtual authenticator");
  context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 26.9124, longitude: 75.7873 },
    permissions: ["geolocation"],
  });
  page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
});
test.afterAll(async () => {
  if (page && csrf)
    await page.request.fetch("/api/v2/me", {
      method: "DELETE",
      headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrf },
    });
  await context?.close();
});

test("a new farmer's Home offers voice setup, then shows the crop calendar and Pest Radar", async () => {
  test.setTimeout(120000);
  await page.goto("/app/today");
  await page.getByRole("button", { name: /Create my account/ }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Feature farmer");
  await page.getByRole("checkbox", { name: /I accept the Terms/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page
    .getByRole("checkbox", { name: /written down my recovery code/ })
    .check({ timeout: 30000 });
  await page.getByRole("button", { name: /Open my farm/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tell Krishyak about your farm" }),
  ).toBeVisible({ timeout: 30000 });
  await audit("home-new");
  csrf = (await (await page.request.get("/api/v2/me")).json()).csrf_token;
  await api("PATCH", "/api/v2/me", {
    display_name: "Feature farmer",
    state_code: 8,
    district_code: 102,
    village: "Chomu",
  });
  for (const purpose of ["location_processing", "agronomic_analysis"])
    await api("POST", "/api/v2/consents", {
      purpose,
      granted: true,
      policy_version: "2026-10-03",
    });
  const farm = await api("POST", "/api/v2/farms", {
    operation_id: crypto.randomUUID(),
    name: "Chomu farm",
  });
  plot = await api("POST", "/api/v2/plots", {
    operation_id: crypto.randomUUID(),
    farm_id: farm.id,
    name: "Wheat field",
    entered_area_hectares: 1.2,
    approximate_location: { latitude: 26.91, longitude: 75.79 },
    irrigation_type: "irrigated",
    soil_metadata: { soil_type: "Loamy", source: "farmer_selected" },
  });
  const sown = new Date(Date.now() - 22 * 86400000);
  await api("POST", `/api/v2/plots/${plot.id}/crop-cycles`, {
    crop_id: "wheat",
    sowing_date: sown.toISOString().slice(0, 10),
    expected_harvest: new Date(sown.getTime() + 135 * 86400000)
      .toISOString()
      .slice(0, 10),
  });
  await page.goto("/app/today");
  const calendar = page.locator(".calendar-card");
  // Day 22 or 23: the app counts India's calendar day, this test UTC's.
  await expect(calendar).toContainText(/Day 2[23] after sowing/, {
    timeout: 30000,
  });
  await expect(calendar).toContainText("Do this week");
  await expect(calendar).toContainText("First watering now");
  const radar = page.getByRole("region", { name: "Pest Radar" });
  await expect(radar).toContainText("No disease alerts for Wheat within 10 km");
  await radar.getByRole("button", { name: "Share to help neighbours" }).click();
  await expect(radar).toContainText("help warn your neighbours");
  for (const tile of [
    "Show and ask",
    "My field report",
    "Report crop loss",
    "Call Kisan helpline",
  ])
    await expect(
      page
        .getByRole("navigation", { name: "Quick actions" })
        .getByRole("link", { name: new RegExp(`^${tile}`) }),
    ).toBeVisible();
  await audit("home-field");
  await page.setViewportSize({ width: 1440, height: 900 });
  await audit("home-field");
  await page.setViewportSize({ width: 320, height: 640 });
  await audit("home-field");
  await page.setViewportSize({ width: 390, height: 844 });
});

test("a loss report becomes a claim pack with a geo-tagged photo and the 72-hour route", async () => {
  test.setTimeout(120000);
  await page.goto("/app/claim");
  await expect(
    page.getByRole("heading", { name: "Report crop loss", level: 1 }),
  ).toBeVisible({ timeout: 30000 });
  const next = page.getByRole("button", { name: /Next: take photos/ });
  await expect(next).toBeDisabled();
  await page.getByRole("radio", { name: "Hail" }).check();
  await page.getByRole("radio", { name: "About half" }).check();
  await audit("claim-form");
  await next.click();
  await expect(
    page.getByRole("heading", { name: "Your claim pack" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".claim-helpline")).toContainText(
    /Tell your insurer within \d+ hours/,
  );
  await expect(page.getByRole("link", { name: /Call 14447/ })).toHaveAttribute(
    "href",
    "tel:14447",
  );
  await page
    .getByLabel("Take a claim photo", { exact: true })
    .setInputFiles(path.join(process.cwd(), "public/sample-crop-leaf.jpg"));
  const photo = page.locator(".claim-photo").first();
  await expect(photo).toBeVisible({ timeout: 45000 });
  await expect(photo).toContainText("26.9124, 75.7873");
  await expect(photo).toContainText(/m from the field/);
  await expect(page.locator(".claim-photo img")).toBeVisible();
  const sheet = page.locator(".claim-sheet");
  await expect(sheet).toContainText("Feature farmer");
  await expect(sheet).toContainText("Chomu, Jaipur, Rajasthan");
  await expect(sheet).toContainText("Hail");
  await expect(sheet).toContainText("About 50%");
  await expect(sheet).toContainText(/Draw this field's outline/);
  await audit("claim-pack");
  // Loss evidence never appears as a leaf check.
  const scans = await (await page.request.get("/api/v2/disease-scans")).json();
  expect(scans.items).toEqual([]);
  await page.goto("/app/claim");
  await expect(page.locator(".claim-list")).toContainText("1 photo");
});

test("Krishyak Live asks permission, opens the camera stage and accepts a typed question", async () => {
  test.setTimeout(90000);
  await page.goto("/app/live");
  await expect(
    page.getByRole("heading", { name: "Krishyak Live" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Allow Krishyak Live")).toBeVisible();
  await audit("live-permission");
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page.getByRole("button", { name: /Type instead/ })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".live-view .voice-status")).toBeVisible();
  await page.getByRole("button", { name: /Type instead/ }).click();
  await page.getByLabel("Type your question").fill("What is on this leaf?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".live-asked")).toHaveText("What is on this leaf?");
  // With the assistant configured there is an answer; without it, a plain reason.
  await expect(
    page.locator(".live-answer p, .voice-problem").first(),
  ).toBeVisible({ timeout: 60000 });
  await audit("live");
  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/\/app\/today$/);
});

test("joining a farmer group and answering a farm check explain what is shared", async () => {
  test.setTimeout(90000);
  await page.goto("/app/more");
  for (const tile of [
    "My farmer group",
    "Farm check for a loan",
    "Report crop loss",
  ])
    await expect(
      page.getByRole("link", { name: new RegExp(`^${tile}`) }),
    ).toBeVisible({ timeout: 30000 });
  await audit("more");
  await page.goto("/app/more/group");
  await expect(
    page.getByRole("heading", { name: "My farmer group" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByLabel("Group code").fill("zzzz9999");
  await page.getByRole("button", { name: "Check code" }).click();
  await expect(page.locator(".code-entry [role=alert]")).toContainText(
    "This code was not found",
  );
  await audit("group");
  await page.goto("/app/more/verify");
  await expect(
    page.getByRole("heading", { name: "Farm check for a loan or insurance" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByLabel("Check code").fill("zzzz9999");
  await page.getByRole("button", { name: "Check code" }).click();
  await expect(page.locator(".code-entry [role=alert]")).toContainText(
    "This code was not found",
  );
  await audit("verify");
  await page.goto("/app/more/settings");
  await expect(
    page.getByRole("checkbox", {
      name: /Warn nearby farmers with my photo checks/,
    }),
  ).toBeChecked({ timeout: 30000 });
  await expect(
    page.getByRole("checkbox", {
      name: /Share chosen fields with my farmer group/,
    }),
  ).not.toBeChecked();
});

test("with no signal the picture guides open and a leaf photo waits on the phone", async ({
  browser,
}, info) => {
  test.setTimeout(150000);
  // Guides need no account: they are general first steps with no personal data.
  const anonymous = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: 390, height: 844 },
  });
  const visitor = await anonymous.newPage();
  await visitor.goto("/app/guides");
  await expect(
    visitor.getByRole("heading", { name: "Picture guides", level: 1 }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    visitor.getByRole("link", { name: "Sign in to Krishyak" }),
  ).toBeVisible();
  await anonymous.close();

  await page.goto("/app/guides");
  await expect(
    page.getByRole("heading", { name: "Picture guides", level: 1 }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Potato", exact: true }).click();
  const blight = page.getByRole("region", { name: "Late blight (potato)" });
  await expect(blight).toContainText("This disease can spread quickly");
  await expect(blight.locator("svg.pictogram").first()).toBeVisible();
  await audit("guides");
  await page.setViewportSize({ width: 320, height: 640 });
  await audit("guides");
  await page.setViewportSize({ width: 390, height: 844 });

  // The service worker only runs in the production build.
  test.skip(
    process.env.V2_E2E_PRODUCTION !== "true",
    "Offline loading needs the production service worker",
  );
  await page.goto("/app/more/settings");
  await page
    .getByRole("checkbox", { name: /Keep farm records for offline use/ })
    .check();
  await expect(
    page.getByText("Offline records saved on this device.", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.goto("/app/today");
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker?.controller),
    null,
    { timeout: 20000 },
  );
  // Home fetches the guide library a few seconds after it opens.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(6000);
  await context.setOffline(true);
  await page.goto("/app/guides");
  await expect(
    page.getByRole("region", { name: "Late blight (tomato)" }),
  ).toBeVisible({ timeout: 30000 });

  await page.goto("/app/health");
  await expect(page.getByText(/^You are offline\./)).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("combobox", { name: "Crop" }).selectOption("tomato");
  await page
    .getByLabel("Choose crop photo", { exact: true })
    .setInputFiles(path.join(process.cwd(), "public/sample-crop-leaf.jpg"));
  await page
    .getByRole("button", { name: "Save photo and check it later" })
    .click();
  const waiting = page.locator(".scan-waiting");
  await expect(waiting).toContainText(
    "1 saved photo is waiting to be checked.",
  );
  await audit("scan-offline");
  // The photo survives closing and reopening the page with no signal.
  await page.reload();
  await expect(waiting).toContainText("1 saved photo", { timeout: 30000 });

  await context.setOffline(false);
  await page.reload();
  await page
    .getByRole("button", { name: "Check saved photos now" })
    .click({ timeout: 30000 });
  await expect(waiting).toHaveCount(0, { timeout: 60000 });
  const scans = await (await page.request.get("/api/v2/disease-scans")).json();
  expect(scans.items).toHaveLength(1);
});

test("no screen in this journey broke an accessibility rule", () => {
  expect(violations).toEqual([]);
});

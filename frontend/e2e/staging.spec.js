import { test, expect } from "@playwright/test";
import path from "node:path";

// Live staging smoke: real passkey sign-up (Chromium virtual platform
// authenticator), real Open-Meteo weather, the deployed disease model with
// private Blob storage, a live Copernicus job drained by the serverless worker,
// and account deletion. Runs only with V2_E2E_STAGING=true.
test.describe.configure({ mode: "serial" });
test.skip(
  process.env.V2_E2E_STAGING !== "true",
  "Live staging smoke only runs against a deployed staging URL",
);

let context, page, cdp, csrf;
const JAIPUR = { latitude: 26.9124, longitude: 75.7873 };
// About 1 ha around a field near Jaipur, Rajasthan.
const BOUNDARY = {
  type: "Polygon",
  coordinates: [
    [
      [75.787, 26.912],
      [75.788, 26.912],
      [75.788, 26.913],
      [75.787, 26.913],
      [75.787, 26.912],
    ],
  ],
};

async function api(method, url, data) {
  const response = await page.request.fetch(url, {
    method,
    data,
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrf },
  });
  return response;
}

test.beforeAll(async ({ browser }, info) => {
  test.skip(info.project.name !== "chromium", "Chromium virtual authenticator");
  const bypass = process.env.V2_E2E_BYPASS;
  context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    extraHTTPHeaders: bypass
      ? {
          "x-vercel-protection-bypass": bypass,
          "x-vercel-set-bypass-cookie": "true",
        }
      : {},
    geolocation: JAIPUR,
    permissions: ["geolocation"],
  });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
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
  if (page && csrf) await api("DELETE", "/api/v2/me");
  await context?.close();
});

test("live passkey sign-up and profile", async () => {
  test.setTimeout(90000);
  await page.goto("/app/today");
  await page.getByRole("button", { name: /Create my account/ }).click();
  await page
    .getByLabel("Your name", { exact: true })
    .fill("Staging smoke farmer");
  await page.getByRole("checkbox", { name: /I accept the Terms/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator(".recovery-code")).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("checkbox", { name: /written down my recovery code/ })
    .check();
  await page.getByRole("button", { name: /Open my farm/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Namaste, / }),
  ).toBeVisible({ timeout: 30000 });
  csrf = (await (await page.request.get("/api/v2/me")).json()).csrf_token;
  const profile = await api("PATCH", "/api/v2/me", {
    display_name: "Staging smoke farmer",
    state_code: 8,
    district_code: 102,
  });
  expect(profile.status()).toBe(200);
  for (const purpose of [
    "location_processing",
    "agronomic_analysis",
    "satellite_processing",
  ]) {
    const granted = await api("POST", "/api/v2/consents", {
      purpose,
      granted: true,
      policy_version: "2026-10-03",
    });
    expect(granted.status()).toBe(200);
  }
});

test("a field located by GPS gets live weather on Today", async () => {
  test.setTimeout(120000);
  await page.goto("/app/farm");
  await page.getByRole("button", { name: "Add a field", exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (await dialog.getByLabel("Farm name", { exact: true }).count())
    await dialog.getByLabel("Farm name", { exact: true }).fill("Smoke farm");
  await dialog.getByLabel("Field name", { exact: true }).fill("Well field");
  await dialog.getByLabel("Field area (acres)", { exact: true }).fill("2");
  await dialog
    .getByRole("button", { name: "I am in this field. Use my location" })
    .click();
  await expect(
    dialog.getByText("Location saved for this field."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /Save field/ }).click();
  await expect(dialog).not.toBeVisible({ timeout: 45000 });
  await page.goto("/app/today");
  await expect(page.locator(".weather-conclusions li").first()).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator(".weather-facts")).toContainText("°C");
});

test("a real leaf photo is checked by the deployed model and stored privately", async () => {
  test.setTimeout(120000);
  await page.goto("/app/health");
  const crop = page.getByRole("combobox", { name: "Crop", exact: true });
  await expect(crop.locator('option[value="tomato"]')).toHaveCount(1, {
    timeout: 45000,
  });
  await crop.selectOption("tomato");
  await page
    .getByLabel("Choose crop photo", { exact: true })
    .setInputFiles(path.join(process.cwd(), "public/sample-crop-leaf.jpg"));
  await page.getByRole("button", { name: /Check this photograph/ }).click();
  await expect(
    page.locator(".scan-result").getByRole("heading").first(),
  ).toBeVisible({ timeout: 60000 });
  const scans = await (await page.request.get("/api/v2/disease-scans")).json();
  expect(scans.items).toHaveLength(1);
  const image = await page.request.get(
    `/api/v2/disease-scans/${scans.items[0].id}/image`,
  );
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/jpeg");
});

test("a live Copernicus job is drained by the serverless worker", async () => {
  test.setTimeout(180000);
  const farms = await (await page.request.get("/api/v2/farms")).json();
  const plot = await api("POST", "/api/v2/plots", {
    operation_id: crypto.randomUUID(),
    farm_id: farms.items[0].id,
    name: "Mapped field",
    boundary: BOUNDARY,
    boundary_quality: "farmer_drawn",
  });
  expect(plot.status()).toBe(201);
  const id = (await plot.json()).id;
  const job = await api("POST", `/api/v2/plots/${id}/remote-sensing/refresh`, {
    operation_id: crypto.randomUUID(),
    index: "ndvi",
  });
  expect(job.status()).toBe(202);
  let latest;
  for (let attempt = 0; attempt < 30; attempt++) {
    latest = await (
      await page.request.get(`/api/v2/plots/${id}/remote-sensing`)
    ).json();
    if (["completed", "failed"].includes(latest.latest_job?.status)) break;
    await page.waitForTimeout(5000);
  }
  expect(latest.latest_job.status).toBe("completed");
  expect(
    latest.items.length,
    JSON.stringify({ job: latest.latest_job, status: latest.status }),
  ).toBeGreaterThan(0);
});

test("market page answers honestly for the farmer's crop and district", async () => {
  await page.goto("/app/market");
  await page
    .getByRole("combobox", { name: "Crop", exact: true })
    .selectOption("wheat");
  await page.getByRole("button", { name: /Show prices/ }).click();
  await expect(
    page
      .locator(".market-prices, .inline-note")
      .filter({
        hasText:
          /per quintal|No mandi reported|not responding|not connected|Choose your crop/,
      })
      .first(),
  ).toBeVisible({ timeout: 45000 });
});

test("voice mode answers a farmer's question from their own records", async () => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/today");
  await expect(
    page.getByRole("heading", { level: 1, name: /^Namaste, / }),
  ).toBeVisible({ timeout: 30000 });
  await page.screenshot({
    path: "../output/product/screenshots/staging/home-390.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Mobile workspace navigation" })
    .getByRole("button", { name: "Ask Krishyak" })
    .click();
  const voice = page.getByRole("dialog", { name: "Ask Krishyak" });
  await expect(voice).toBeVisible();
  await voice.getByRole("button", { name: "Allow and start" }).click();
  await expect(voice.getByRole("button", { name: "Tap to speak" })).toBeVisible(
    { timeout: 20000 },
  );
  await voice.getByRole("button", { name: /Type instead/ }).click();
  await voice
    .getByLabel("Type your question")
    .fill("Will it rain in my field in the next day? Answer briefly.");
  await voice.getByRole("button", { name: "Send question" }).click();
  const answer = voice.locator(".voice-turn.assistant p");
  await expect(answer).toBeVisible({ timeout: 60000 });
  expect((await answer.innerText()).length).toBeGreaterThan(10);
  await page.screenshot({
    path: "../output/product/screenshots/staging/voice-390.png",
  });
  await voice.getByRole("button", { name: "Close voice help" }).click();
  await expect(voice).not.toBeVisible();
});

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Real WebAuthn ceremonies through Chromium's virtual platform authenticator
// (internal transport, user verification like a phone fingerprint/screen lock)
// against the real API and PostGIS database. No SMS identity is involved.
test.describe.configure({ mode: "serial" });

let context, page, authenticator, cdp, recoveryCode;
const name = `Passkey farmer ${Date.now()}`;

test.beforeAll(async ({ browser }, info) => {
  test.skip(
    !["chromium", "mobile-chrome"].includes(info.project.name),
    "Virtual authenticators are a Chromium DevTools feature",
  );
  context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    ...(info.project.name === "mobile-chrome" ? info.project.use : {}),
  });
  page = await context.newPage();
  cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  ({ authenticatorId: authenticator } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  ));
  const status = await (await context.request.get("/api/v2/status")).json();
  expect(status.passkey_available).toBe(true);
});
test.afterAll(async () => {
  await context?.close();
});

test("create an account with a passkey and keep the recovery code", async () => {
  await page.goto("/app/today");
  await page
    .getByRole("button", { name: /New here\? Create my account/ })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page
    .getByLabel("Mobile number (optional)", { exact: true })
    .fill("98765 43210");
  await page.getByRole("checkbox", { name: /I accept the Terms/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  const code = page.locator(".recovery-code");
  await expect(code).toHaveText(/^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$/);
  recoveryCode = (await code.textContent()).trim();
  const open = page.getByRole("button", { name: /Open my farm/ });
  await expect(open).toBeDisabled();
  expect(
    (await new AxeBuilder({ page }).include(".recovery-card").analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByRole("checkbox", { name: /written down my recovery code/ })
    .check();
  await open.click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Namaste, / }),
  ).toBeVisible();
  const me = await (await page.request.get("/api/v2/me")).json();
  expect(me.farmer.display_name).toBe(name);
  expect(me.farmer.mobile).toBeNull();
  expect(me.farmer.contact_mobile).toBe("+919876543210");
  const { credentials } = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId: authenticator,
  });
  expect(credentials).toHaveLength(1);
  expect(credentials[0].isResidentCredential).toBe(true);
});

test("sign out, then sign back in with the fingerprint passkey", async () => {
  await page.goto("/app/more/settings");
  await expect(
    page.getByRole("heading", { name: "Sign-in devices" }),
  ).toBeVisible();
  await expect(page.locator(".device-list li")).toHaveCount(1);
  await page
    .getByRole("button", { name: /Sign out/ })
    .first()
    .click();
  await page.goto("/app/today");
  await expect(
    page.getByRole("button", { name: /Sign in with fingerprint/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Sign in with fingerprint/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Namaste, / }),
  ).toBeVisible();
  const me = await (await page.request.get("/api/v2/me")).json();
  expect(me.farmer.display_name).toBe(name);
});

test("a lost phone is recovered with the code, which then rotates", async () => {
  await cdp.send("WebAuthn.clearCredentials", {
    authenticatorId: authenticator,
  });
  await page.goto("/app/more/settings");
  await page
    .getByRole("button", { name: /Sign out/ })
    .first()
    .click();
  await page.goto("/app/today");
  await page
    .getByRole("button", { name: /Lost your phone\? Use your recovery code/ })
    .click();
  await page
    .getByLabel("Recovery code", { exact: true })
    .fill(recoveryCode.toLowerCase().replaceAll("-", " "));
  await page.getByRole("button", { name: "Continue" }).click();
  const fresh = page.locator(".recovery-code");
  await expect(fresh).toBeVisible();
  expect((await fresh.textContent()).trim()).not.toBe(recoveryCode);
  await page
    .getByRole("checkbox", { name: /written down my recovery code/ })
    .check();
  await page.getByRole("button", { name: /Open my farm/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Namaste, / }),
  ).toBeVisible();
  // The new phone is added from Settings with its own screen lock.
  await page.goto("/app/more/settings");
  await page.getByRole("button", { name: "Add this phone" }).click();
  await expect(page.locator(".device-list li")).toHaveCount(2);
  const reused = await page.request.post("/api/v2/auth/recovery", {
    data: { code: recoveryCode },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(reused.status()).toBe(400);
});

test("account deletion removes the passkey account", async () => {
  await page.goto("/app/more/settings");
  const csrf = (await (await page.request.get("/api/v2/me")).json()).csrf_token;
  const removed = await page.request.delete("/api/v2/me", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-CSRF-Token": csrf,
    },
  });
  expect(removed.status()).toBe(200);
  expect((await page.request.get("/api/v2/me")).status()).toBe(401);
});

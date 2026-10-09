import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import path from "node:path";
import pilot from "../src/i18n/pilotLanguages.json" with { type: "json" };

const codes = (process.env.V2_E2E_LOCALES || pilot.codes.join(" ")).split(
  /\s+/,
);
const names = {
  en: "English",
  as: "অসমীয়া",
  bn: "বাংলা",
  brx: "बर’ राव",
  doi: "डोगरी",
  gu: "ગુજરાતી",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
  ks: "کٲشُر",
  kok: "कोंकणी",
  mai: "मैथिली",
  ml: "മലയാളം",
  mni: "ꯃꯤꯇꯩ ꯂꯣꯟ",
  mr: "मराठी",
  ne: "नेपाली",
  or: "ଓଡ଼ିଆ",
  pa: "ਪੰਜਾਬੀ",
  sa: "संस्कृतम्",
  sat: "ᱥᱟᱱᱛᱟᱲᱤ",
  sd: "سنڌي",
  ta: "தமிழ்",
  te: "తెలుగు",
  ur: "اردو",
};

test("static farmer entry in every configured language, RTL, fonts, keyboard and mobile accessibility", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  const errors = [],
    translationRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      request.url().includes("sarvam.ai") ||
      request.url().includes("/translate")
    )
      translationRequests.push(request.url());
  });
  await page.goto("/app/today");
  await expect(page.locator(".signin-card")).toBeVisible();
  for (const code of codes) {
    const pack =
      code === "en"
        ? {}
        : JSON.parse(
            await fs.readFile(
              path.join(process.cwd(), `public/locales/workspace/${code}.json`),
              "utf8",
            ),
          );
    const tx = (source) => pack[source] || source;
    await page.getByTestId("workspace-language").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".language-option")).toHaveCount(
      pilot.codes.length,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId("workspace-language")).toBeFocused();
    await page.getByTestId("workspace-language").click();
    await dialog
      .getByRole("button")
      .filter({ has: page.locator("strong", { hasText: names[code] }) })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", `${code}-IN`);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      ["ks", "sd", "ur"].includes(code) ? "rtl" : "ltr",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      tx("Your fields, crops and prices in one place."),
    );
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      // Browsers without WebAuthn get a translated explanation instead.
      const webauthn = await page.evaluate(() =>
        Boolean(window.PublicKeyCredential),
      );
      await expect(
        webauthn
          ? page.getByRole("button", {
              name: tx("Sign in with fingerprint or screen lock"),
              exact: true,
            })
          : page.getByText(
              tx(
                "This browser cannot use fingerprint or screen-lock sign-in. Open Krishyak in Chrome on Android or Safari on iPhone.",
              ),
              { exact: true },
            ),
      ).toBeVisible();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (width === 1440 && ["ks", "sd", "ur"].includes(code)) {
        const sidebar = await page.locator(".product-sidebar").boundingBox();
        expect(sidebar.x).toBeGreaterThan(width / 2);
      }
      const directory = `../output/product/screenshots/locales/${info.project.name}`;
      await fs.mkdir(directory, { recursive: true });
      await page.screenshot({
        path: `${directory}/entry-${code}-${width}.png`,
        fullPage: true,
      });
    }
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      tx("Your fields, crops and prices in one place."),
    );
  }
  expect(errors).toEqual([]);
  expect(translationRequests).toEqual([]);
});

test("every configured language remains active across authenticated farmer routes", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const status = await (await page.request.get("/api/v2/status")).json();
  expect(
    status.development_identity,
    "Locale fixtures require the isolated development identity provider",
  ).toBe(true);
  await page.goto("/app/today");
  await page
    .getByText("Sign in with a code sent by SMS", { exact: true })
    .click();
  await page.getByLabel("Mobile number", { exact: true }).fill(
    {
      chromium: "9000000001",
      firefox: "9000000002",
      webkit: "9000000003",
    }[info.project.name],
  );
  await page.getByRole("checkbox", { name: /I accept the Terms/ }).check();
  await page
    .getByRole("button", { name: "Send sign-in code", exact: true })
    .click();
  await page.getByLabel("Six-digit code", { exact: true }).fill("123456");
  await page
    .getByRole("button", { name: "Verify & continue", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Today on your farm.",
  );
  let lastLanguageStarted = 0;
  for (const code of codes) {
    // Six full authenticated route loads per language create an artificial
    // burst. Keep the matrix within the unchanged 500-request/minute gateway.
    const remaining = 11000 - (Date.now() - lastLanguageStarted);
    if (remaining > 0)
      await new Promise((resolve) => setTimeout(resolve, remaining));
    lastLanguageStarted = Date.now();
    const pack =
      code === "en"
        ? {}
        : JSON.parse(
            await fs.readFile(
              path.join(process.cwd(), `public/locales/workspace/${code}.json`),
              "utf8",
            ),
          );
    const tx = (source) => pack[source] || source;
    await page.getByTestId("workspace-language").click();
    await page
      .getByRole("dialog")
      .getByRole("button")
      .filter({ has: page.locator("strong", { hasText: names[code] }) })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", `${code}-IN`);
    for (const [route, title] of [
      ["/app/today", "Today on your farm."],
      ["/app/farm", "Your farm, field by field."],
      ["/app/health", "Check a sick plant"],
      ["/app/market", "Mandi prices"],
      ["/app/more", "A little more for your farm."],
      ["/app/more/settings", "Your account. Your decisions."],
    ]) {
      await page.goto(route);
      // WebKit can spend five seconds hydrating after a full navigation on a
      // shared CI runner. The failed trace has successful, fast API responses
      // and the correct heading just after the default assertion deadline.
      // Bound functional readiness separately from the measured startup test.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        tx(title),
        { timeout: 15000 },
      );
      await expect(page.locator("html")).toHaveAttribute("lang", `${code}-IN`);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        ["ks", "sd", "ur"].includes(code) ? "rtl" : "ltr",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (route === "/app/farm") {
        await page
          .getByRole("button", { name: tx("Add crop cycle"), exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("searchbox").fill(tx("Tomato"));
        await expect(
          dialog.getByRole("option", { name: tx("Tomato"), exact: true }),
        ).toHaveCount(1);
        await dialog
          .getByLabel(tx("Crop"), { exact: true })
          .selectOption("tomato");
        await expect(dialog.getByRole("combobox")).toHaveValue("tomato");
        expect(
          await dialog
            .locator("form")
            .evaluate((form) => new FormData(form).get("crop_id")),
        ).toBe("tomato");
        await page.screenshot({
          path: `../output/product/screenshots/locales/${info.project.name}/crop-search-${code}.png`,
          fullPage: true,
        });
        await dialog
          .getByRole("button", { name: tx("Close dialog"), exact: true })
          .click();
      }
      if (route === "/app/more/settings") {
        const state = page.getByLabel(tx("State or union territory"), {
          exact: true,
        });
        const district = page.getByLabel(tx("District"), { exact: true });
        await page
          .getByLabel(tx("Search states and union territories"), {
            exact: true,
          })
          .fill(tx("Rajasthan"));
        await state.selectOption("8");
        await page
          .getByLabel(tx("Search districts"), { exact: true })
          .fill(tx("Jaipur"));
        await district.selectOption("102");
        const saved = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/v2/me") &&
            response.request().method() === "PATCH",
        );
        await page
          .getByRole("button", {
            name: tx("Save account details"),
            exact: true,
          })
          .click();
        const response = await saved;
        expect(response.ok()).toBe(true);
        expect(response.request().postDataJSON()).toMatchObject({
          state_code: 8,
          district_code: 102,
          state: "Rajasthan",
          district: "Jaipur",
        });
        await page.reload();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          tx("Your account. Your decisions."),
          { timeout: 15000 },
        );
        await expect(
          page.getByLabel(tx("State or union territory"), { exact: true }),
        ).toHaveValue("8");
        await expect(
          page.getByLabel(tx("District"), { exact: true }),
        ).toHaveValue("102");
        const exported = await page.request.get("/api/v2/me/export");
        expect(exported.ok()).toBe(true);
        expect((await exported.json()).profile).toMatchObject({
          state_code: 8,
          district_code: 102,
        });
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
    }
  }
  expect(errors).toEqual([]);
});

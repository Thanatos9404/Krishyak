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
  test.setTimeout(240000);
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
    await expect(dialog.locator(".language-option")).toHaveCount(11);
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
      tx("A good day starts with a clearer picture."),
    );
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("button", {
          name: tx("Send sign-in code"),
          exact: true,
        }),
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
      tx("A good day starts with a clearer picture."),
    );
  }
  expect(errors).toEqual([]);
  expect(translationRequests).toEqual([]);
});

test("Hindi and Urdu remain active across authenticated farmer routes", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const status = await (await page.request.get("/api/v2/status")).json();
  expect(
    status.development_identity,
    "Locale fixtures require the isolated development identity provider",
  ).toBe(true);
  await page.goto("/app/today");
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
  for (const code of ["hi", "ur"]) {
    const pack = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), `public/locales/workspace/${code}.json`),
        "utf8",
      ),
    );
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
      ["/app/health", "Start with a clear photograph."],
      ["/app/market", "Prices with a place and a date."],
      ["/app/more", "A little more for your farm."],
      ["/app/more/settings", "Your account. Your decisions."],
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        pack[title],
      );
      await expect(page.locator("html")).toHaveAttribute("lang", `${code}-IN`);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        code === "ur" ? "rtl" : "ltr",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

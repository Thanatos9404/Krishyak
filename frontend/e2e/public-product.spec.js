import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";

const ROUTES = [
  "/",
  "/how-it-works",
  "/technology",
  "/for-farmers",
  "/for-partners",
  "/about",
  "/faq",
  "/privacy",
  "/terms",
];
const ORIGIN = "https://krishyak.vercel.app";
const VIEWPORTS = [320, 360, 375, 390, 412, 768, 1024, 1280, 1440];
test("public HTML is meaningful without JavaScript, uniquely described and canonical", async ({
  request,
  browser,
}) => {
  const titles = new Set(),
    descriptions = new Set();
  for (const path of ROUTES) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<h1[\s>]/);
    expect((html.match(/<h1[\s>]/g) || []).length).toBe(1);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    expect(title).toContain("Krishyak");
    expect(titles.has(title)).toBe(false);
    titles.add(title);
    const description = html.match(
      /<meta name="description" content="([^"]+)"/,
    )[1];
    expect(description.length).toBeGreaterThan(60);
    expect(descriptions.has(description)).toBe(false);
    descriptions.add(description);
    expect(html).toContain(
      `rel="canonical" href="${ORIGIN}${path === "/" ? "" : path}"`,
    );
    expect(html).toMatch(/name="robots" content="index,\s*follow"/);
    expect(response.headers()["content-security-policy"]).toContain(
      "script-src 'self' 'nonce-",
    );
    expect(response.headers()["content-security-policy"]).not.toMatch(
      /script-src[^;]*unsafe-inline/,
    );
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('type="application/ld+json"');
  }
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: test.info().project.use.baseURL,
  });
  const page = await noJs.newPage();
  for (const path of ["/", "/for-farmers", "/technology", "/faq"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await page.locator("main").innerText()).length).toBeGreaterThan(
      450,
    );
  }
  await noJs.close();
});

test("sitemap, robots, private exclusions, genuine 404s and one-hop legacy redirects", async ({
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml"),
    xml = await sitemap.text();
  expect(sitemap.headers()["content-type"]).toContain("xml");
  expect((xml.match(/<loc>/g) || []).length).toBe(9);
  for (const path of ROUTES)
    expect(xml).toContain(`${ORIGIN}${path === "/" ? "" : path}`);
  expect(xml).not.toMatch(/\/app\/|\/institution|\/demo|\/offline/);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /app/");
  expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  for (const path of [
    "/app/today",
    "/app/farm",
    "/app/health",
    "/app/market",
    "/app/more",
    "/institution",
    "/demo",
    "/offline",
  ]) {
    const response = await request.get(path),
      html = await response.text();
    expect(response.status()).toBe(200);
    expect(html).toMatch(/name="robots" content="noindex,\s*nofollow"/);
    if (path !== "/demo")
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(html).not.toMatch(/Synthetic product field|9000000000|csrf_token/);
  }
  for (const path of [
    "/missing-product-page",
    "/app/not-a-screen",
    "/app/farm/invalid",
  ])
    expect((await request.get(path)).status()).toBe(404);
  for (const [oldPath, newPath] of [
    ["/farm", "/app/today"],
    ["/planning", "/app/more/planning"],
    ["/register", "/app/today"],
    ["/field-intelligence", "/app/farm"],
    ["/partners", "/for-partners"],
  ]) {
    const response = await request.get(oldPath, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(newPath);
    expect((await request.get(newPath, { maxRedirects: 0 })).status()).toBe(
      200,
    );
  }
  expect(
    (await request.get("/og-image.png")).headers()["content-type"],
  ).toContain("image/png");
  expect((await request.get("/favicon.svg")).status()).toBe(200);
});

test("public interactions, keyboard dialog, demo isolation and responsive accessibility", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [],
    api = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "A change", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "See a change. Understand the source." }),
  ).toBeVisible();
  await page.goto("/faq");
  await page
    .getByText("Does a crop photo confirm a disease?", { exact: true })
    .click();
  await expect(
    page.getByText(/No. The image classifier suggests a possible/),
  ).toBeVisible();
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      api.push(request.url());
  });
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Today on an example farm." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Why this matters" }).first().click();
  const dialog = page.getByRole("dialog", {
    name: "Why this matters",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest("dialog")),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Try recording an update", exact: true })
    .click();
  await page
    .getByLabel("What did you notice?", { exact: true })
    .fill("Illustrative demo update");
  await page
    .getByRole("button", { name: "Add example update", exact: true })
    .click();
  await expect(
    page.getByText("Demo only: Illustrative demo update", { exact: true }),
  ).toBeVisible();
  expect(api).toEqual([]);
  expect(errors).toEqual([]);
  await fs.mkdir(`../output/product/screenshots/${test.info().project.name}`, {
    recursive: true,
  });
  const violations = [];
  for (const path of [
    "/",
    "/for-farmers",
    "/technology",
    "/about",
    "/demo",
    "/demo?view=farm",
    "/demo?view=scan",
    "/demo?view=market",
    "/app/today",
  ]) {
    await page.goto(path);
    if (path.startsWith("/demo"))
      await expect(
        page.getByText("Illustrative demo", { exact: true }),
      ).toBeVisible();
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          { message: `${path} ${width}px overflow` },
        )
        .toBe(true);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `../output/product/screenshots/${test.info().project.name}/${path.replace(/[^a-z0-9]/gi, "-") || "home"}-${width}.png`,
          fullPage: true,
        });
    }
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    if (axe.violations.length)
      violations.push({ path, violations: axe.violations });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open navigation menu", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation", exact: true }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

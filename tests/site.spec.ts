import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    fontLayoutShiftScore: number;
  }
}

for (const path of ["/", "/success"]) {
  for (const width of [375, 390, 412, 480, 481, 899, 900, 901, 1440]) {
    test(`${path} stays stable when the font arrives late at ${width}px`, async ({ page }) => {
      let releaseFont: (() => void) | undefined;
      const fontGate = new Promise<void>((resolve) => { releaseFont = resolve; });
      await page.route("**/fonts/inter-latin-variable.woff2", async (route) => {
        await fontGate;
        await route.continue();
      });
      await page.addInitScript(() => {
        window.fontLayoutShiftScore = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ("value" in entry && typeof entry.value === "number"
              && "hadRecentInput" in entry && !entry.hadRecentInput) {
              window.fontLayoutShiftScore += entry.value;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.setViewportSize({ width, height: 900 });
      try {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect.poll(() => page.evaluate(() =>
          performance.getEntriesByName("first-contentful-paint").length,
        )).toBe(1);
        expect(await page.evaluate(() => document.fonts.status)).toBe("loading");
        const before = await page.locator("header, main, main h1, main section").evaluateAll(
          (elements) => elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
        releaseFont?.();
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));
        const after = await page.locator("header, main, main h1, main section").evaluateAll(
          (elements) => elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
        expect(after).toEqual(before);
        expect(await page.evaluate(() => window.fontLayoutShiftScore)).toBe(0);
      } finally {
        releaseFont?.();
      }
    });
  }
}

for (const path of ["/", "/success"]) {
  for (const width of [375, 480, 481, 899, 900, 901, 1440]) {
    test(`${path} renders without overflow or external assets at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      const external: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).origin !== "http://127.0.0.1:8081") external.push(request.url());
      });
      page.on("response", (response) => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByTestId("main-content")).toBeVisible();
      await page.getByTestId("site-footer").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("site-footer-bascik")).toHaveAttribute("href", "https://bascik.dev");
      await expect(page.getByTestId("site-footer-social").getByRole("link", { name: "YouTube" }))
        .toHaveAttribute("href", "https://www.youtube.com/@bascikdev");
      await expect.poll(() => page.locator("img").evaluateAll(
        (images) => images.every(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        ),
      )).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await page.locator('link[rel="stylesheet"]').count()).toBe(0);
      expect(await page.locator("img").evaluateAll(
        (images) => images.every((image) => image.hasAttribute("width") && image.hasAttribute("height")),
      )).toBe(true);
      const logo = await page.getByTestId("site-header").locator("img").evaluate((image) => {
        if (!(image instanceof HTMLImageElement)) throw new Error("The site logo must be an image.");
        return image.currentSrc;
      });
      expect(logo).toContain(width <= 480 ? "rinsesoft-insignia-" : "rinsesoft-logo-no-rs-");
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test("contact anchors and native form validation work", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-hero-consultation").click();
  await expect(page).toHaveURL(/#contact$/);
  const form = page.getByTestId("contact-form");
  await expect(form).toHaveAttribute("action", "/success");
  await expect(form).toHaveAttribute("method", "POST");
  await expect(form).toHaveAttribute("data-netlify", "true");
  expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
  await page.getByTestId("contact-section-name").fill("Site test");
  await page.getByTestId("contact-section-email").fill("test@example.com");
  await page.getByTestId("contact-section-message").fill("Testing native validation without submitting.");
  expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(true);
  const fields = await form.evaluate((element) => [...new FormData(element as HTMLFormElement).keys()]);
  expect(fields).toEqual(["name", "email", "message"]);
});

test("skip link moves keyboard focus and reduced motion is respected", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("main-content")).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("crawler metadata and company profiles are consistent", async ({ page, request }) => {
  await page.goto("/");
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).toBeTruthy();
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
  const profiles = [
    "https://github.com/rinsesoft",
    "https://www.linkedin.com/company/143500064/",
    "https://www.youtube.com/@bascikdev",
  ];
  expect(schema.sameAs).toEqual(profiles);
  for (const profile of profiles) {
    const link = page.getByTestId("site-footer-social").locator(`a[href="${profile}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("aria-label", /GitHub|LinkedIn|YouTube/);
    await expect(link.locator("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(link).toHaveText("");
    await expect(link).toHaveCSS("color", "rgb(163, 163, 163)");
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain(canonical!);
  expect(await sitemap.text()).not.toContain("/success");
  const index = await request.get("/llms.txt");
  expect(index.ok()).toBe(true);
  const text = await index.text();
  expect(text).toContain("# Rinsesoft");
  expect(text).toContain(canonical!);
  expect(text).not.toContain("/success");
  for (const asset of ["/fonts/inter-latin-variable.woff2", "/img/rinsesoft-insignia-60.webp"]) {
    const response = await request.get(asset);
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toBe("public, max-age=2592000");
  }
  await page.goto("/success");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you.");
});

test("the site works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8081/");
  await expect(page.getByTestId("home-hero")).toBeVisible();
  await expect(page.getByTestId("contact-form")).toBeVisible();
  await page.getByTestId("home-hero-consultation").click();
  await expect(page).toHaveURL(/#contact$/);
  await page.goto("http://127.0.0.1:8081/success");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you.");
  await context.close();
});

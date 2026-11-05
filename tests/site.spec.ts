import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    fontLayoutShiftScore: number;
  }
}

const paths = ["/", "/services", "/about", "/contact", "/success"];

for (const path of paths) {
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

for (const path of paths) {
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

test("discovery navigation and native form validation work", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-hero-consultation").click();
  await expect(page).toHaveURL(/\/contact$/);
  const form = page.getByTestId("contact-form");
  await expect(form).toHaveAttribute("action", "/success");
  await expect(form).toHaveAttribute("method", "POST");
  await expect(form).toHaveAttribute("data-netlify", "true");
  expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
  await page.getByTestId("contact-section-name").fill("Site test");
  await expect(page.getByTestId("contact-section-company")).toHaveAttribute("required", "");
  await page.getByTestId("contact-section-focus").selectOption("fractional-cto");
  await page.getByTestId("contact-section-email").fill("test@example.com");
  await page.getByTestId("contact-section-message").fill("Testing native validation without submitting.");
  expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
  expect(await page.getByTestId("contact-section-company").evaluate(
    (element) => (element as HTMLInputElement).validity.valueMissing,
  )).toBe(true);
  await page.getByTestId("contact-section-company").fill("Test company");
  expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(true);
  const fields = await form.evaluate((element) => Object.fromEntries(new FormData(element as HTMLFormElement)));
  expect(fields).toEqual({
    "form-name": "contact",
    name: "Site test",
    company: "Test company",
    focus: "fractional-cto",
    email: "test@example.com",
    message: "Testing native validation without submitting.",
  });
  await expect(page.getByTestId("contact-section-direct-email")).toHaveAttribute("href", "mailto:info@rinsesoft.com");
  await expect(page.getByTestId("contact-section-schedule")).toHaveAttribute(
    "href",
    "https://scheduler.zoom.us/collin-thomas/30-minute-meeting-with-collin-from-rinsesoft",
  );
  await expect(page.getByTestId("contact-section-schedule")).toHaveAttribute("target", "_blank");
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
  for (const path of ["/services", "/about", "/contact"]) {
    expect(await sitemap.text()).toContain(`https://rinsesoft.com${path}`);
  }
  const index = await request.get("/llms.txt");
  expect(index.ok()).toBe(true);
  const text = await index.text();
  expect(text).toContain("# Rinsesoft");
  expect(text).toContain(canonical!);
  expect(text).not.toContain("/success");
  for (const path of ["/services", "/about", "/contact"]) {
    expect(text).toContain(`https://rinsesoft.com${path}`);
  }
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
  await page.getByTestId("home-hero-consultation").click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByTestId("contact-form")).toBeVisible();
  await page.getByTestId("site-header-services").click();
  await expect(page.getByTestId("engagement-step")).toHaveCount(3);
  await page.getByTestId("site-header-about").click();
  await expect(page.getByTestId("founder-profile")).toBeVisible();
  await page.goto("http://127.0.0.1:8081/success");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you.");
  await context.close();
});

test("company pages have unique metadata and navigable primary links", async ({ page }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of paths.filter((path) => path !== "/success")) {
    await page.goto(path);
    titles.add(await page.title());
    descriptions.add(await page.locator('meta[name="description"]').getAttribute("content") ?? "");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://rinsesoft.com${path}`);
    for (const destination of ["services", "about", "contact"]) {
      const link = page.getByTestId(`site-header-${destination}`);
      await expect(link).toHaveAttribute("href", `/${destination}`);
      if (path === `/${destination}`) await expect(link).toHaveAttribute("aria-current", "page");
    }
  }
  expect(titles.size).toBe(4);
  expect(descriptions.size).toBe(4);
  await page.getByTestId("site-header-services").click();
  await expect(page.getByTestId("engagement-step")).toHaveCount(3);
  await page.getByTestId("site-header-about").click();
  await expect(page.getByRole("heading", { name: /Technical depth/ })).toBeVisible();
  await expect(page.getByTestId("founder-profile").getByRole("img")).toHaveAttribute("src", "/img/collin-thomas-2026.webp");
  await page.getByTestId("discovery-cta-contact").click();
  await expect(page.getByTestId("contact-form")).toBeVisible();
});

test("the homepage has no diagram or portrait and About retains the portrait", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hero-approach")).toHaveCount(0);
  await expect(page.getByTestId("founder-preview").getByRole("img")).toHaveCount(0);
  await expect(page.getByTestId("home-hero-consultation")).toBeVisible();
  await page.goto("/about");
  await expect(page.getByTestId("founder-profile").getByRole("img")).toBeVisible();
  const portrait = await request.get("/img/collin-thomas-2026.webp");
  expect(portrait.ok()).toBe(true);
});

test("the homepage positions AI as a business opportunity, not a default solution", async ({ page }) => {
  await page.goto("/");
  const section = page.getByTestId("problem-section");
  await expect(section.getByTestId("owner-situation")).toHaveCount(3);
  await expect(section.getByRole("heading", { name: /Not your daily workload/ })).toBeVisible();
  await expect(section.getByRole("heading", { name: /Ready for the next chapter/ })).toBeVisible();
  await expect(section.getByRole("heading", { name: /You see opportunity/ })).toBeVisible();
  await expect(section.getByText(/AI opens new opportunities/)).toBeVisible();
  await expect(section).toContainText("measurable value");
  await expect(section).toContainText("simpler automation or better-connected systems");
});

for (const width of [390, 970, 1440]) {
  test(`owner situations alternate on desktop and stack heading-first on mobile at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const situations = await page.getByTestId("owner-situation").all();
    expect(situations).toHaveLength(3);
    for (const [index, section] of situations.entries()) {
      const heading = await section.getByRole("heading", { level: 2 }).boundingBox();
      const copy = await section.locator("p").first().boundingBox();
      const header = await section.locator("header").boundingBox();
      const body = await section.locator("header + div").boundingBox();
      expect(heading).not.toBeNull();
      expect(copy).not.toBeNull();
      expect(header).not.toBeNull();
      expect(body).not.toBeNull();
      if (width >= 900) {
        expect(Math.abs(header!.y - body!.y)).toBeLessThan(1);
      }
      if (width < 900) {
        expect(copy!.y).toBeGreaterThan(heading!.y + heading!.height);
      } else if (index % 2 === 0) {
        expect(heading!.x + heading!.width).toBeLessThan(copy!.x);
      } else {
        expect(copy!.x + copy!.width).toBeLessThan(heading!.x);
      }
    }
  });

  test(`services overview link sits with its introduction above the cards at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = page.getByTestId("services-overview");
    const link = page.getByTestId("services-overview-link");
    await expect(link).toHaveAttribute("href", "/services");
    const linkBox = await link.boundingBox();
    const cardBox = await section.getByTestId("service-card").first().boundingBox();
    expect(linkBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(linkBox!.y + linkBox!.height).toBeLessThan(cardBox!.y);
    await link.click();
    await expect(page).toHaveURL(/\/services$/);
  });

  test(`engagement cards keep their introduction under the title at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services");
    const cards = page.getByTestId("engagement-step");
    await expect(cards).toHaveCount(3);
    for (const card of await cards.all()) {
      await expect(card).not.toContainText(/months|multi-year|focused sprint/i);
      const heading = await card.getByRole("heading", { level: 3 }).boundingBox();
      const intro = await card.locator("header > p").boundingBox();
      expect(heading).not.toBeNull();
      expect(intro).not.toBeNull();
      expect(intro!.y).toBeGreaterThan(heading!.y + heading!.height);
      expect(intro!.x).toBe(heading!.x);
      await expect(card.getByRole("heading", { name: "What we focus on" })).toBeVisible();
      await expect(card.getByRole("heading", { name: "How we partner" })).toBeVisible();
      await expect(card).not.toContainText(/leave with|handover/i);
      const cardBox = await card.boundingBox();
      const outcomeBox = await card.getByTestId("engagement-step-outcome").boundingBox();
      const scopeBox = await card.getByRole("list").boundingBox();
      expect(cardBox).not.toBeNull();
      expect(outcomeBox).not.toBeNull();
      expect(scopeBox).not.toBeNull();
      expect(outcomeBox!.y).toBeGreaterThan(scopeBox!.y + scopeBox!.height);
      expect(Math.abs(outcomeBox!.width - cardBox!.width)).toBeLessThanOrEqual(2);
    }
  });

  test(`company experience copy sits below its heading at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = page.getByTestId("founder-preview");
    const heading = section.getByRole("heading", { level: 2 });
    const copy = section.getByText("Rinsesoft brings over 20 years", { exact: false });
    const headingBox = await heading.boundingBox();
    const copyBox = await copy.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(copyBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
    expect(copyBox!.x).toBe(headingBox!.x);
    await expect(section).not.toContainText("Work directly with Collin");
    await expect(section.getByRole("link", { name: /More about Rinsesoft/ })).toHaveAttribute("href", "/about");
  });
}

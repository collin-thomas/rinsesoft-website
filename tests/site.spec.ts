import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    fontLayoutShiftScore: number;
  }
}

const paths = [
  "/", "/services", "/about", "/contact", "/owner-bottlenecks", "/business-check",
  "/resources", "/resources/business-problem-roadmap", "/privacy", "/success",
];

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
    "entry-point": "general",
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

test("owner bottleneck funnel preserves context in a valid native inquiry", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("problem-section-owner-bottlenecks").click();
  await expect(page).toHaveURL(/\/owner-bottlenecks$/);
  await expect(page.getByRole("heading", { level: 1 }))
    .toHaveText("Why does everything still come back to you?");
  await expect(page.getByTestId("bottleneck-checklist").getByRole("listitem")).toHaveCount(4);
  await page.getByTestId("owner-bottlenecks-talk").click();
  await expect(page).toHaveURL(/\/owner-bottlenecks#talk$/);
  await expect(page.getByTestId("contact-section")).toBeInViewport();
  await expect(page.getByTestId("contact-section").getByRole("heading", { level: 2 }))
    .toHaveText("Let's talk through what keeps coming back to you.");
  await expect(page.getByTestId("contact-section-submit")).toHaveText("Request a conversation");
  const form = page.getByTestId("contact-form");
  await expect(form).toHaveAttribute("action", "/success");
  await expect(form).toHaveAttribute("method", "POST");
  await expect(form).toHaveAttribute("data-netlify", "true");
  expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
  await page.getByTestId("contact-section-name").fill("Site test");
  await page.getByTestId("contact-section-company").fill("Test company");
  await page.getByTestId("contact-section-email").fill("test@example.com");
  await page.getByTestId("contact-section-message").fill("Every customer update needs me to reconcile three tools.");
  expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(true);
  const fields = await form.evaluate((element) => Object.fromEntries(new FormData(element as HTMLFormElement)));
  expect(fields).toMatchObject({
    "form-name": "contact",
    "entry-point": "owner-bottlenecks",
    focus: "discovery",
    message: "Every customer update needs me to reconcile three tools.",
  });
  await expect(page.getByTestId("contact-section-schedule")).toHaveAttribute("href", /^https:\/\/scheduler\.zoom\.us\//);
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
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .map((content) => JSON.parse(content));
  const schema = schemas.find((item) => item["@type"] === "ProfessionalService");
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
    await expect(link).toHaveCSS("color", "rgb(86, 97, 89)");
  }
  const youtubeLink = page.getByTestId("site-footer-social").getByRole("link", { name: "YouTube" });
  await youtubeLink.hover();
  await expect(youtubeLink.locator("svg")).toHaveCSS("fill", "rgb(224, 255, 102)");
  await expect(youtubeLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain(canonical!);
  expect(await sitemap.text()).not.toContain("/success");
  for (const path of ["/services", "/about", "/contact", "/owner-bottlenecks", "/business-check", "/privacy"]) {
    expect(await sitemap.text()).toContain(`https://rinsesoft.com${path}`);
  }
  const index = await request.get("/llms.txt");
  expect(index.ok()).toBe(true);
  const text = await index.text();
  expect(text).toContain("# Rinsesoft");
  expect(text).toContain(canonical!);
  expect(text).not.toContain("/success");
  for (const path of ["/services", "/about", "/contact", "/owner-bottlenecks", "/business-check", "/privacy"]) {
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

test("privacy page explains contact-form and third-party data handling", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page).toHaveTitle("Privacy | Rinsesoft");
  await expect(page.getByTestId("privacy-policy")).toContainText("WDZ, LLC, doing business as Rinsesoft");
  await expect(page.getByTestId("privacy-policy")).toContainText("Netlify");
  await expect(page.getByTestId("privacy-policy")).toContainText("Zoom");
  await expect(page.getByTestId("site-footer-nav").getByRole("link", { name: "Privacy" }))
    .toHaveAttribute("href", "/privacy");
  await expect(page.getByTestId("site-footer")).toContainText("WDZ, LLC, doing business as Rinsesoft");
});

test("the site works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:8081/");
  await expect(page.getByTestId("home-hero")).toBeVisible();
  await page.getByTestId("problem-section-owner-bottlenecks").click();
  await expect(page.getByTestId("bottleneck-checklist").getByRole("listitem")).toHaveCount(4);
  await page.getByTestId("owner-bottlenecks-talk").click();
  await expect(page.getByTestId("contact-section")).toBeInViewport();
  await expect(page.getByTestId("contact-form")).toBeVisible();
  await expect(page.getByTestId("contact-form").locator('input[name="entry-point"]'))
    .toHaveValue("owner-bottlenecks");
  await page.goto("http://127.0.0.1:8081/");
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
  expect(titles.size).toBe(paths.length - 1);
  expect(descriptions.size).toBe(paths.length - 1);
  await page.getByTestId("site-header-services").click();
  await expect(page.getByTestId("engagement-step")).toHaveCount(3);
  await page.getByTestId("site-header-about").click();
  await expect(page.getByRole("heading", { name: /Technical depth/ })).toBeVisible();
  await expect(page.getByTestId("founder-profile").getByRole("img")).toHaveAttribute("src", "/img/collin-thomas-2026.webp");
  await page.getByTestId("discovery-cta-contact").click();
  await expect(page.getByTestId("contact-form")).toBeVisible();
});

test("the homepage explains delivery and lazily loads the shared founder portrait", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hero-approach").getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("founder-preview").getByRole("img")).toHaveAttribute("loading", "lazy");
  await expect(page.getByTestId("home-hero-consultation")).toBeVisible();
  await page.goto("/about");
  await expect(page.getByTestId("founder-profile").getByRole("img")).toBeVisible();
  await expect(page.getByTestId("founder-profile").getByRole("img")).toHaveAttribute("fetchpriority", "high");
  const portrait = await request.get("/img/collin-thomas-2026.webp");
  expect(portrait.ok()).toBe(true);
});

test("the homepage connects expertise and process improvement to business capacity", async ({ page }) => {
  await page.goto("/");
  const section = page.getByTestId("problem-section");
  await expect(section.getByTestId("owner-situation")).toHaveCount(1);
  await expect(section.getByRole("heading", { name: /Your expertise built the business/ })).toBeVisible();
  await expect(section).toContainText("clear processes and systems your team can rely on");
  await expect(page.getByTestId("home-hero-approach")).toContainText(
    "Resolve the bottleneck before adding more technology",
  );
  await expect(page.getByTestId("home-hero-approach")).toContainText("Compare results with the baseline");
});

for (const width of [390, 970, 1440]) {
  test(`business constraint is side-by-side on desktop and heading-first on mobile at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const situations = await page.getByTestId("owner-situation").all();
    expect(situations).toHaveLength(1);
    for (const section of situations) {
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
      } else {
        expect(heading!.x + heading!.width).toBeLessThan(copy!.x);
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
    const copy = section.getByText("Rinsesoft is a founder-led practice", { exact: false });
    const headingBox = await heading.boundingBox();
    const copyBox = await copy.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(copyBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
    expect(copyBox!.x).toBe(headingBox!.x);
    await expect(section).not.toContainText("Work directly with Collin");
    await expect(section.getByRole("link", { name: /Meet the firm behind the work/ })).toHaveAttribute("href", "/about");
  });
}

for (const width of [375, 899, 900, 1440]) {
  test(`homepage preserves the brand and keeps the hero contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("site-header").getByRole("img")).toHaveCSS("filter", "none");
    await expect(page.getByTestId("site-footer").getByRole("img")).toHaveCSS("filter", "none");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 248, 243)");
    await expect(page.getByTestId("home-hero-approach")).toHaveCSS("background-color", "rgb(238, 240, 232)");
    await expect(page.getByTestId("site-header-contact")).toHaveCSS("background-color", "rgb(204, 255, 0)");
    await expect(page.getByTestId("home-hero-consultation")).toHaveCSS("background-color", "rgb(32, 45, 39)");
    await page.getByTestId("home-hero-consultation").hover();
    await expect(page.getByTestId("home-hero-consultation")).toHaveCSS("background-color", "rgb(204, 255, 0)");
    await expect(page.getByTestId("home-hero-consultation")).toHaveCSS("color", "rgb(10, 10, 10)");
    const hero = await page.getByTestId("home-hero").boundingBox();
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    const approach = await page.getByTestId("home-hero-approach").boundingBox();
    const cta = await page.getByTestId("home-hero-consultation").boundingBox();
    expect(hero).not.toBeNull();
    expect(heading).not.toBeNull();
    expect(approach).not.toBeNull();
    expect(cta).not.toBeNull();
    for (const box of [heading!, approach!, cta!]) {
      expect(box.x).toBeGreaterThanOrEqual(hero!.x);
      expect(box.x + box.width).toBeLessThanOrEqual(hero!.x + hero!.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(hero!.y + hero!.height);
    }
    if (width >= 900) {
      expect(heading!.x + heading!.width).toBeLessThan(approach!.x);
    } else {
      expect(approach!.y).toBeGreaterThan(cta!.y + cta!.height);
    }
  });
}

for (const width of [390, 1440]) {
  test(`decorative motion settles without moving content at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const ambient = page.getByTestId("home-hero-ambient");
    await expect(ambient).toHaveAttribute("aria-hidden", "true");
    await expect(ambient).toHaveCSS("pointer-events", "none");
    await expect(page.getByTestId("home-hero-trace")).toHaveCSS("animation-duration", "4s");
    await expect(page.getByTestId("home-hero-trace")).toHaveCSS("animation-iteration-count", "1");
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    const approach = await page.getByTestId("home-hero-approach").boundingBox();
    await ambient.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    expect(await page.getByRole("heading", { level: 1 }).boundingBox()).toEqual(heading);
    expect(await page.getByTestId("home-hero-approach").boundingBox()).toEqual(approach);
    await expect(page.getByTestId("home-hero-trace")).toHaveCSS("stroke-dashoffset", "0px");
    expect(await ambient.evaluate(element =>
      element.getAnimations({ subtree: true }).every(animation => animation.playState === "finished"),
    )).toBe(true);
    await page.getByTestId("home-hero-consultation").click();
    await expect(page).toHaveURL(/\/contact$/);
  });
}

test("decorations stay static with reduced motion and no JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:8081/");
    const ambient = page.getByTestId("home-hero-ambient");
    await expect(ambient).toBeVisible();
    await expect(page.getByTestId("home-hero-trace")).toHaveCSS("animation-name", "none");
    expect(await ambient.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    for (const card of await page.getByTestId("service-card").all()) {
      await expect(card.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(card.locator("svg")).toHaveAttribute("focusable", "false");
    }
    await page.getByTestId("home-hero-consultation").click();
    await expect(page.getByTestId("contact-form")).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const width of [390, 1440, 1920]) {
  test(`the page wash spans the viewport, not the text column, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/about", "/", "/services", "/contact", "/resources"]) {
      await page.goto(path);
      const body = page.locator("body");
      await expect(body).toHaveCSS("background-image", /radial-gradient/);
      await expect(body).toHaveCSS("background-repeat", "no-repeat");
      const bounds = await body.boundingBox();
      expect(bounds!.x).toBe(0);
      expect(bounds!.width).toBe(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const intro = page.getByTestId("page-intro");
      if (path === "/") {
        await expect(page.getByTestId("home-hero-ambient")).toHaveCSS("background-image", "none");
      } else {
        await expect(intro).toHaveCSS("background-image", "none");
        expect((await intro.boundingBox())!.width).toBeLessThanOrEqual(880);
      }
    }
  });
}

for (const width of [900, 1024, 1280, 1440, 1920]) {
  test(`the decorative rail clears the approach card at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const railY = await page.getByTestId("home-hero-trace").evaluate((element) => {
      const path = element as SVGPathElement;
      const matrix = path.getScreenCTM();
      if (!matrix) throw new Error("Decorative rail has no screen transform.");
      return new DOMPoint(800, 56).matrixTransform(matrix).y;
    });
    const card = await page.getByTestId("home-hero-approach").boundingBox();
    expect(card!.y - railY).toBeGreaterThanOrEqual(24);
  });
}

import { test, expect } from "@playwright/test";

for (const width of [375, 528, 1440]) {
  test(`article links retain their styling and header spacing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/resources/business-problem-roadmap");
    const backLink = page.getByTestId("roadmap-article-resources");
    const contactLink = page.getByTestId("roadmap-article-contact");
    for (const link of [backLink, contactLink]) {
      await expect(link).toHaveCSS("display", "inline-block");
      await expect(link).toHaveCSS("font-weight", "600");
      await expect(link).toHaveCSS("padding-top", "12px");
      await expect(link).toHaveCSS("padding-bottom", "12px");
    }
    const backBounds = await backLink.boundingBox();
    const eyebrowBounds = await page.getByText("Technology strategy for business owners").boundingBox();
    expect(backBounds).not.toBeNull();
    expect(eyebrowBounds).not.toBeNull();
    expect(eyebrowBounds!.y - (backBounds!.y + backBounds!.height)).toBeGreaterThanOrEqual(32);
    await backLink.click();
    await expect(page).toHaveURL(/\/resources$/);
  });
}

test("the homepage retains executive positioning and links to a practical roadmap", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hero")).toContainText(
    "Stronger operations. Greater capacity to grow.",
  );
  await expect(page.getByTestId("home-hero")).toContainText(
    "founders and executive teams",
  );
  await expect(page.getByTestId("home-hero")).toContainText(
    "First, we improve how the work gets done.",
  );
  await expect(page.getByTestId("home-hero")).toContainText(
    "We don't stop at recommendations.",
  );
  await expect(page.getByTestId("home-hero").getByRole("link", { name: /Explore our services/ }))
    .toHaveAttribute("href", "/services");
  await expect(page).toHaveTitle("Process Improvement & Fractional CTO Consulting | Rinsesoft");
  await page.getByTestId("resources-list").getByTestId("resource-card-link")
    .filter({ hasText: "technology roadmap" }).click();
  await expect(page).toHaveURL(/\/resources\/business-problem-roadmap$/);
  const article = page.getByTestId("roadmap-article");
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "How to turn a business problem into a technology roadmap",
  );
  await expect(article).toContainText("not a client case study or a claim of measured results");
  await expect(page.getByTestId("roadmap-article-brief").locator("dt")).toHaveCount(6);
  await page.getByTestId("roadmap-article-contact").click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByTestId("contact-form")).toBeVisible();
});

test("resource links work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:8081/");
    await expect(page.getByTestId("resources-list").getByTestId("resource-card")).toHaveCount(5);
    await page.getByTestId("site-header-resources").click();
    await expect(page).toHaveURL(/\/resources$/);
    await page.getByTestId("resource-card-link").filter({ hasText: "technology roadmap" }).click();
    await expect(page.getByTestId("roadmap-article-brief")).toBeVisible();
    await page.getByTestId("roadmap-article-resources").click();
    await page.getByTestId("resource-card-link").filter({ hasText: "come back to you" }).click();
    await expect(page).toHaveURL(/\/owner-bottlenecks$/);
    await expect(page.getByTestId("bottleneck-checklist")).toBeVisible();
    await page.goto("/resources");
    await page.getByTestId("resource-card-link").filter({ hasText: "trust AI to answer questions" }).click();
    await expect(page).toHaveURL(/\/resources\/trustworthy-ai-assistant$/);
    await expect(page.getByTestId("ai-assistant-guide")).toContainText("The important question isn't whether AI can answer.");
    await page.goto("/resources/ai-automation-readiness");
    await expect(page.getByRole("heading", { name: "An illustrative example: handling routine customer updates" })).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test("resources are discoverable and article metadata matches visible content", async ({ page, request }) => {
  const articlePaths = [
    "/resources/business-problem-roadmap",
    "/resources/trustworthy-ai-assistant",
    "/resources/capture-business-knowledge",
    "/resources/ai-automation-readiness",
  ];
  for (const path of ["/resources", ...articlePaths]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://rinsesoft.com${path}`);
    for (const index of ["/sitemap.xml", "/llms.txt"]) {
      const response = await request.get(index);
      expect(response.ok()).toBe(true);
      expect(await response.text()).toContain(`https://rinsesoft.com${path}`);
    }
    await expect(page.getByTestId("site-footer-nav").getByRole("link", { name: "Resources" }))
      .toHaveAttribute("href", "/resources");
    if (path === "/resources") continue;
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('meta[property="og:type"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    const article = schemas.map((schema: string) => JSON.parse(schema))
      .find((schema) => schema["@type"] === "Article");
    expect(article).toBeDefined();
    expect(article.headline).toBe(await page.getByRole("heading", { level: 1 }).textContent());
    expect(article.author).toEqual({
      "@type": "Person", name: "Collin Thomas", url: "https://rinsesoft.com/about",
    });
    expect(article.mainEntityOfPage).toBe(`https://rinsesoft.com${path}`);
    await expect(page.getByTestId("article-byline")).toContainText(article.author.name);
    if (path !== "/resources/business-problem-roadmap") {
      await expect(page.getByTestId("resource-article")).toContainText(
        "not client case studies or claims of measured results",
      );
    }
  }
  await page.goto("/");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
});

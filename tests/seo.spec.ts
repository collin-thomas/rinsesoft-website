import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { expect, test } from "@playwright/test";

async function routes(directory = "dist"): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await routes(file));
    else if (entry.name.endsWith(".html")) {
      const path = relative("dist", file).split(sep).join("/").replace(/\.html$/, "");
      paths.push(path === "index" ? "/" : `/${path.replace(/\/index$/, "/")}`);
    }
  }
  return paths.sort();
}

test("every page has complete, unique metadata and a distinct, decodable social card", async ({ page, request }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const images = new Set<string>();
  const pixels = new Set<string>();
  const paths = await routes();
  const sitemap = await (await request.get("/sitemap.xml")).text();

  for (const path of paths) {
    await page.goto(path);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(title).not.toBe("");
    expect(description).toBeTruthy();
    expect(titles.has(title)).toBe(false);
    expect(descriptions.has(description!)).toBe(false);
    titles.add(title);
    descriptions.add(description!);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f8f8f3");
    await expect(page.locator('meta[name="twitter:site"]')).toHaveCount(0);
    await expect(page.locator("title")).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const socialTitle = title.replace(/ \| Rinsesoft$/, "");
    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    const icon = await (await request.get(touchIcon!)).body();
    expect(icon.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([180, 180]);
    const canonical = `https://rinsesoft.com${path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    for (const [property, value] of Object.entries({
      "og:title": socialTitle, "og:description": description!, "og:url": canonical,
      "og:locale": "en_US",
      "og:site_name": "Rinsesoft", "og:type": path.startsWith("/resources/") ? "article" : "website",
      "og:image:alt": socialTitle, "og:image:type": "image/jpeg", "og:image:width": "1200", "og:image:height": "630",
    })) {
      await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute("content", value);
    }
    const image = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(image).toMatch(/^https:\/\/rinsesoft\.com\/img\/og\/.+\.jpg$/);
    expect(images.has(image!)).toBe(false);
    images.add(image!);
    for (const [name, value] of Object.entries({
      "twitter:card": "summary_large_image", "twitter:title": socialTitle,
      "twitter:description": description!, "twitter:image": image!, "twitter:image:alt": socialTitle,
    })) {
      await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute("content", value);
    }
    const metaKeys = await page.locator("head meta").evaluateAll((tags) =>
      tags.map((tag) => tag.getAttribute("property") ?? tag.getAttribute("name") ?? ""));
    for (const key of metaKeys.filter((key) => /:image:/.test(key))) {
      const root = key.replace(/:image:.*/, ":image");
      expect(metaKeys.indexOf(root), `${key} must follow ${root}`).toBeLessThan(metaKeys.indexOf(key));
    }
    const imagePath = new URL(image!).pathname;
    const response = await request.get(imagePath);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/jpeg");
    const jpeg = await response.body();
    expect(jpeg.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    expect(jpeg.subarray(-2).toString("hex")).toBe("ffd9");
    expect(jpeg.length).toBeLessThan(1_000_000);
    pixels.add(createHash("sha256").update(jpeg).digest("hex"));
    expect(await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, imagePath)).toEqual([1200, 630]);
    const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((content) => JSON.parse(content));
    const websites = schemas.filter((schema) => schema["@type"] === "WebSite");
    expect(websites).toHaveLength(path === "/" ? 1 : 0);
    if (path === "/") {
      expect(websites[0]).toMatchObject({ name: "Rinsesoft", url: canonical });
    }
    if (path.startsWith("/resources/")) {
      expect(schemas.find((schema) => schema["@type"] === "Article"))
        .toMatchObject({ image, url: canonical });
    }
    if (path === "/success") {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
      expect(sitemap).not.toContain(`<loc>${canonical}</loc>`);
    } else {
      expect(sitemap).toContain(`<loc>${canonical}</loc>`);
    }
  }
  expect(images.size).toBe(paths.length);
  expect(pixels.size).toBe(paths.length);
});

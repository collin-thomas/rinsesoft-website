import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { html } from "@bascik/bascik/html";
import { chromium } from "@playwright/test";
import { socialImagePath } from "../src/lib/social-image.ts";
import { ogContent } from "./og-content.ts";

const outDir = process.env.BASCIK_OUT_DIR;
if (!outDir) throw new Error("BASCIK_OUT_DIR is required to generate OG images.");

async function pageFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await pageFiles(path));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files.sort();
}

const assets = new Map([
  ["/font.woff2", { path: join(outDir, "fonts/inter-latin-variable.woff2"), contentType: "font/woff2" }],
  ["/logo.webp", { path: join(outDir, "img/rinsesoft-logo-no-rs-630.webp"), contentType: "image/webp" }],
]);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
let count = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const asset = url.origin === "https://og-assets.invalid" && assets.get(url.pathname);
    if (!asset) throw new Error(`Unexpected network request while rendering OG card: ${url}`);
    await route.fulfill({ contentType: asset.contentType, body: await readFile(asset.path) });
  });

  for (const file of await pageFiles(outDir)) {
    const path = relative(outDir, file).split(sep).join("/").replace(/\.html$/, "");
    const pagePath = path === "index" ? "/" : `/${path.replace(/\/index$/, "/")}`;
    const { headline, description } = ogContent(await readFile(file, "utf8"), file);
    await page.setContent(String(html`<!DOCTYPE html>
      <html lang="en"><head><meta charset="utf-8"><style>
        @font-face {
          font-family: Inter;
          src: url("https://og-assets.invalid/font.woff2") format("woff2");
          font-weight: 100 900;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0; width: 1200px; height: 630px; padding: 52px 64px;
          color: #202d27; background: #f8f8f3; font-family: Inter, sans-serif;
          display: flex; flex-direction: column;
        }
        header { display: flex; align-items: center; justify-content: space-between; }
        img { width: 280px; height: 35px; object-fit: contain; }
        main { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 24px; }
        h1 { margin: 0; max-width: 1030px; font-size: 58px; line-height: 1.12; font-weight: 650; letter-spacing: -2px; }
        p { margin: 0; max-width: 980px; font-size: 25px; line-height: 1.5; color: #566159; }
        footer { display: flex; align-items: center; gap: 18px; font-size: 18px; color: #566159; }
        .rule { flex: 1; height: 1px; background: #d8dfd5; }
        .cta {
          padding: 10px 16px; border-radius: 3px; background: #ccff00;
          color: #0a0a0a; font-size: 16px; font-weight: 600;
        }
      </style></head><body>
        <header><img src="https://og-assets.invalid/logo.webp" alt="Rinsesoft"></header>
        <main><h1>${headline}</h1><p>${description}</p></main>
        <footer><span>${pagePath}</span><span class="rule"></span><span class="cta">Let's talk through your priorities</span></footer>
      </body></html>`));
    await page.evaluate(async () => {
      await document.fonts.load("650 58px Inter");
      await document.fonts.ready;
      if (!document.fonts.check("650 58px Inter")) {
        throw new Error("The self-hosted Inter font failed to load for the OG card.");
      }
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    const fits = await page.evaluate(() => {
      const heading = document.querySelector("h1")!.getBoundingClientRect();
      const description = document.querySelector("p")!.getBoundingClientRect();
      const header = document.querySelector("header")!.getBoundingClientRect();
      const footer = document.querySelector("footer")!.getBoundingClientRect();
      return heading.top >= header.bottom + 20 && description.bottom <= footer.top - 20
        && document.documentElement.scrollWidth === 1200 && document.documentElement.scrollHeight === 630;
    });
    if (!fits) throw new Error(`OG card text does not fit the 1200x630 canvas: ${file}`);
    const output = join(outDir, socialImagePath(pagePath).slice(1));
    await mkdir(dirname(output), { recursive: true });
    await page.screenshot({ path: output, type: "png" });
    count++;
  }
} finally {
  await browser.close();
}
console.log(`[og-images] Generated ${count} page-specific 1200x630 PNG cards.`);

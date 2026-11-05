import { html, json, type SafeHtml } from "@bascik/bascik/html";
import { socialImagePath } from "./social-image.ts";

export function articleJsonLd(headline: string, defaultPath: string): SafeHtml {
  const siteUrl = process.env.BASCIK_SITE_URL;
  if (!siteUrl) return html``;

  const pagePath = process.env.BASCIK_PAGE_PATH ?? defaultPath;
  const base = (process.env.BASCIK_BASE ?? "/").replace(/\/$/, "");
  const url = new URL(`${base}${pagePath}`, siteUrl).toString();
  return html`<script type="application/ld+json">${json({
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    author: { "@type": "Person", name: "Collin Thomas", url: new URL(`${base}/about`, siteUrl).toString() },
    publisher: { "@type": "Organization", name: "Rinsesoft", url: new URL(`${base}/`, siteUrl).toString() },
    image: new URL(`${base}${socialImagePath(pagePath)}`, siteUrl).toString(),
    mainEntityOfPage: url,
    url,
  })}</script>`;
}

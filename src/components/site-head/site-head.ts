import { readFile } from "node:fs/promises";
import { html, json } from "@bascik/bascik/html";
import { site as company } from "../../lib/site.ts";
import { socialImagePath } from "../../lib/social-image.ts";
import { socialTitle } from "./social-title.ts";

export default async () => {
  const pagePath = process.env.BASCIK_PAGE_PATH ?? "/";
  const pageFile = process.env.BASCIK_PAGE_FILE;
  if (!pageFile) throw new Error("BASCIK_PAGE_FILE is required to build social titles.");
  const title = socialTitle(await readFile(pageFile, "utf8"), company.name);
  const type = pagePath.startsWith("/resources/") ? "article" : "website";
  const openGraphType = html`
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="${company.name}">
    <meta property="og:title" content="${title}">
    <meta property="og:image:alt" content="${title}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:image:alt" content="${title}">
  `;
  const siteUrl = process.env.BASCIK_SITE_URL;
  if (!siteUrl) return openGraphType;

  const site = new URL(siteUrl);
  const base = (process.env.BASCIK_BASE ?? "/").replace(/\/$/, "");
  const canonical = new URL(`${base}${pagePath}`, site).toString();
  const image = new URL(`${base}${socialImagePath(pagePath)}`, site).toString();
  const home = new URL(`${base}/`, site).toString();

  return html`
    ${openGraphType}
    <link rel="canonical" href="${canonical}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:image" content="${image}">
    <script type="application/ld+json">${json({
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "@id": `${home}#organization`,
      name: company.name,
      description:
        "Rinsesoft helps founders improve operations with practical technology leadership and hands-on implementation, with or without an in-house tech team.",
      url: home,
      logo: new URL(`${base}/img/rinsesoft-insignia-180.webp`, site).toString(),
      sameAs: company.profiles.map((profile) => profile.url),
    })}</script>
    ${pagePath === "/" ? html`<script type="application/ld+json">${json({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${home}#website`,
      name: company.name,
      url: home,
      publisher: { "@id": `${home}#organization` },
    })}</script>` : html``}
  `;
};

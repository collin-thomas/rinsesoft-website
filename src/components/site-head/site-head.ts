import { html, json } from "@bascik/bascik/html";
import { site as company } from "../../lib/site.ts";
import { socialImagePath } from "../../lib/social-image.ts";

export default () => {
  const pagePath = process.env.BASCIK_PAGE_PATH ?? "/";
  const type = pagePath.startsWith("/resources/") ? "article" : "website";
  const openGraphType = html`
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="${company.name}">
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

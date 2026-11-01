import { html, json } from "@bascik/bascik/html";
import { site as company } from "../../lib/site.ts";

export default () => {
  const siteUrl = process.env.BASCIK_SITE_URL;
  if (!siteUrl) return html``;

  const site = new URL(siteUrl);
  const canonical = new URL(process.env.BASCIK_PAGE_PATH ?? "/", site).toString();
  const image = new URL("/img/og-image.jpg", site).toString();

  return html`
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
      name: company.name,
      description:
        "Strategic Systems Architecture and efficiency consulting focusing on margin optimization and operational health.",
      url: new URL("/", site).toString(),
      sameAs: company.profiles.map((profile) => profile.url),
    })}</script>
  `;
};

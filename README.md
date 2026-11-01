# Rinsesoft Website

The site is built with [Bascik](https://bascik.dev). Pages live in `src/pages/`,
shared HTML components in `src/components/`, and compiled output in `dist/`.

## Development

```sh
npm install
npm run dev
```

## Production build

Set `BASCIK_SITE_URL` so Bascik can generate canonical URLs, `sitemap.xml`, and
`robots.txt`. For local builds, copy `.env.example` to `.env`.

```sh
npm run build
```

The contact form is a Netlify form. Its successful submission continues to
redirect to `/success`, which is intentionally excluded from the sitemap.

Netlify builds from the repository root, explicitly set by `base = "/"` in
`netlify.toml`. This overrides the legacy `src` base directory in the Netlify UI,
so dependencies are installed beside the root `package.json` and `dist/` is
published from the correct location.

## Performance and validation

The small global stylesheet is inlined by Bascik. Inter is self-hosted as a
preloaded Latin variable WOFF2 font, with its license in `src/pages/fonts/`.
Logo images reserve their dimensions; footer images are lazy-loaded. The build
also generates `llms.txt` from indexable pages. Company profile links and
structured-data `sameAs` values share `src/lib/site.ts`.

Fonts and logos are cached for 30 days by Bascik's production server and by
`netlify.toml`, which also sets `BASCIK_SITE_URL=https://rinsesoft.com` for builds.
Rename changed font/image assets and update their
references when publishing replacements; these URLs are not content-hashed,
so the cache policy deliberately does not use `immutable`.

```sh
npm run check
npx playwright install chromium
BASCIK_SITE_URL=https://rinsesoft.com npm run build
npm test
```

The browser tests cover both routes at mobile, desktop, and breakpoint-edge
widths, form validation, keyboard navigation, no-JavaScript behavior, and
crawler metadata. The Netlify form is never submitted by tests.

For Lighthouse, serve the production build with `npx bascik --server` and audit
`http://localhost:8080/` and `/success` in mobile and desktop modes. The
confirmation page deliberately fails the crawlability audit because it is
`noindex`; do not remove this protection to inflate its SEO score.

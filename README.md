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
It uses `font-display: optional` to prevent a late font download from reflowing
already-visible text. Fast or cached loads use Inter; slow loads retain the
system fallback for that visit rather than causing layout shift.
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

The browser tests cover all five routes at mobile, desktop, and breakpoint-edge
widths, form validation, keyboard navigation, no-JavaScript behavior, and
crawler metadata. Delayed-font tests require zero layout shift and unchanged
section geometry after the download completes. The Netlify form is never
submitted by tests.

For Lighthouse, serve the production build with `npx bascik --server` and audit
`/`, `/services`, `/about`, `/contact`, and `/success` in mobile and desktop modes. The
confirmation page deliberately fails the crawlability audit because it is
`noindex`; do not remove this protection to inflate its SEO score.

## Pages and content

- `/`: positioning, business outcomes, and founder-led delivery overview.
- `/services`: discovery, architecture and implementation, and fractional CTO engagements.
- `/about`: principal biography, industry background, and specialist delivery model.
- `/contact`: discovery inquiry form and direct email contact.
- `/success`: non-indexed Netlify form confirmation.

The founder portrait appears only on About, using `src/pages/img/collin-thomas-2026.webp`.
The contact form includes company and engagement focus fields; it remains a native
Netlify POST form with a `/success` redirect and works without JavaScript.
Discovery CTAs open the inquiry page, not an external calendar. Previous
homepage `#contact` links land on the contact call to action.

# Rinsesoft Website

The site is built with [Bascik](https://bascik.dev). Pages live in `src/pages/`,
shared HTML components in `src/components/`, and compiled output in `dist/`.

## Development

```sh
npm install
npm run dev
```

Development works without `BASCIK_SITE_URL`; canonical metadata and `llms.txt`
are omitted, and the generator logs that it skipped generation. Copy
`.env.example` to `.env` to enable them locally, then restart the dev server.

## Production build

Set `BASCIK_SITE_URL` so Bascik can generate canonical URLs, `sitemap.xml`, and
`robots.txt`. For local builds, copy `.env.example` to `.env`.

```sh
npm run build
```

The build generates a unique 1200x630 JPEG social card for every page at
`dist/img/og/`, using that page's visible H1 headline and meta description, the original
logo, and the self-hosted Inter font. Install the renderer once locally with
`npx playwright install chromium`; Netlify installs it before building.
Cards use `.jpg` URLs, JPEG quality 85, and matching `image/jpeg` metadata,
following the format used by the original social image and Bascik's docs.
Cards are regenerated from compiled page content on every build, including the
non-indexed confirmation page. No browser or extra script is shipped to visitors.
Open Graph and Twitter metadata share each page's card and descriptive image alt
text. The homepage also declares the Rinsesoft `WebSite` identity in JSON-LD;
resource articles reference their page-specific image in Article structured data.
The shared head declares `og:locale=en_US` and a theme color matching the off-white
background. `twitter:site` is intentionally omitted because there is no brand
X/Twitter account; Twitter card previews still work without it.
Netlify serves generated `/img/og/*` cards with `max-age=0, must-revalidate`
because these stable URLs change when page copy or card styling changes. Other
image assets retain the 30-day cache policy. Messaging apps may independently
cache previews even after the deployed image has changed.

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
node --test scripts/llms-txt.test.ts
npx playwright install chromium
BASCIK_SITE_URL=https://rinsesoft.com npm run build
npm test
```

The browser tests cover the public routes at mobile, desktop, and breakpoint-edge
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
- `/services`: discovery, architecture and implementation, and optional senior technology leadership, including fractional CTO support.
- `/about`: principal biography, industry background, and specialist delivery model.
- `/contact`: discovery inquiry form and direct email contact.
- `/owner-bottlenecks`: ungated, problem-led guide for owners whose daily work
  keeps coming back to them, with a workflow exercise and contextual inquiry form.
- `/business-check`: interactive two-question walkthrough with three entry paths,
  six practical starting points, and a persistent external scheduling link.
- `/resources`: ungated guide hub, also linked from shared navigation and the homepage.
- `/resources/business-problem-roadmap`: founder-authored roadmap guide with an
  illustrative workflow example and a copyable, six-question planning brief.
- `/success`: non-indexed Netlify form confirmation.

The founder portrait appears on Home and About, using `src/pages/img/collin-thomas-2026.webp`.
The below-the-fold homepage portrait is lazy-loaded; About retains its priority image.
Responsive WebP candidates for that portrait use width descriptors; its `sizes` value
matches the 250px homepage cap and the About page's two-column layout. The source copy
is kept in `image-originals/`; regenerate candidate WebPs from it when the portrait or
its display sizes change. Header and footer logos already use WebP density `srcset`s.
The Open Graph previews use JPEG; platform icons use PNG, SVG, and ICO.
The contact form includes company and engagement focus fields; it remains a native
Netlify POST form with a `/success` redirect and works without JavaScript.
General discovery CTAs open the inquiry page, not an external calendar. Previous
homepage `#contact` links land on the contact call to action.

The first problem-led funnel starts at the homepage's "Why does everything still
come back to you?" link, or at `/owner-bottlenecks` shared directly in outreach.
Its invitation jumps to the on-page conversation form; no email is required to
read the guide. It reuses the native contact form and booking link, with an
`entry-point` field of `owner-bottlenecks` (or `general` on `/contact`) so form
inquiries retain their context. The calendar remains an external booking service;
the hidden field tracks form inquiries, not calendar bookings.
The new page is included automatically in the sitemap and generated `llms.txt`.

The homepage leads with stronger operations and capacity for growth, supported by
process improvement, business-first technology leadership, and hands-on implementation
rather than recommendations alone. Fractional CTO support is an optional role, not
an assumption that a client already has a technology department. Copy should address founders and executives at
established businesses with $10M-$100M+ annual revenue and 50-200+ employees,
using credible, executive-level language rather than small-business coaching.
The current-state to desired-outcome framing belongs in supporting resources,
not as a replacement for the homepage's strategic positioning. The roadmap
article explains that approach without presenting hypothetical examples as client
results. It includes Article structured data. The shared head gives articles under
`/resources/` article-type social previews; the hub and other pages retain
website-type previews. No private client material is published.

### Visual and editorial direction

The shared design uses off-white backgrounds, white cards, and dark text.
Rinsesoft's original outlined logos are unchanged. Lime (`#ccff00`) is used
sparingly for the "Let's talk" link and hover accents, not headings or body text.
Typography, spacing, and subtle light panels provide the visual hierarchy.
Faint connected-node linework, a low-opacity lime wash, small service-card glyphs,
and soft panel shadows add depth without changing the content layout. The hero
wash is painted on the full-width page body, not a text-width component, and
fades naturally into the off-white background on all routes. The hero
linework draws once over four seconds, then stops; reduced-motion preferences
disable all animation and retain the complete static decoration. Decorative
linework is top-aligned within the hero so its upper rail stays at least 24px
above the approach card at desktop breakpoints, rather than drifting with height.
Decorative
SVGs are hidden from assistive technology, the background cannot intercept clicks,
and no animation library or external asset is loaded.
Color and contrast tokens live in `src/pages/css/styles.css`; component styles
reference them so forms, articles, and the business-check flow stay consistent.
The existing logo assets retain their original colors without recoloring filters.

The homepage explains the engagement in four steps: understand the business,
improve the process, build and prove it, then measure and expand. Service copy
follows the same discipline: establish a baseline, agree scope, put working
systems in the team's hands, and choose subsequent investments together.
Client proposals inform the voice and methodology only. Names, internal metrics,
commercial terms, and proposed results are not published as marketing proof.

To add another guide, create its page under `src/pages/resources/`, give it unique
metadata, and add a `resource-card` to `resources-list`. The shared list appears on
both the homepage and the hub. Add the route to the browser test matrix as well.
The sitemap and `llms.txt` include indexable pages automatically. These are
discoverability foundations, not guarantees of search ranking or AI recommendations.

The alternative interactive funnel is linked from the homepage's "Not sure where
to start?" link and the owner bottleneck guide. Visitors choose owner dependency,
growth friction, or unclear numbers, then answer a branch-specific follow-up.
Only their matching starting point is shown. Back and Start over let them explore
other paths. Answers stay in page memory: no submission, browser storage, or lead
gate. Without JavaScript, all six starting points are readable instead.
The walkthrough at `/business-check` uses one-click navigation. Selecting a radio card advances
immediately, including keyboard selection; the instruction warns of that behavior
before the first question. Back clears the returned question's selection so the
same choice can be selected again. There is no Continue button or experiment switch.
Older links with `?flow=auto` still open the same one-click walkthrough.
Each starting point puts a "Continue this discussion with us" booking invitation alongside
"Where we could help" in every result.
The fixed call bar also links directly to the existing calendar at every step and
reserves footer space; the shared `booking-link` component owns that URL for
results, the call bar, and the contact form. The original guide remains available.

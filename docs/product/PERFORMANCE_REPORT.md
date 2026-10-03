# Product performance report

## Measurement method
The exact-pinned production build was tested on localhost with Node 24, Playwright Chromium and Lighthouse 13.5.0 on 2026-10-03. scripts/measure-performance.mjs completed eighteen runs: three fresh browser profiles for each of the homepage, For farmers and anonymous Today entry, with the default simulated mobile profile and the separate Lighthouse desktop configuration. It asserts the reported form factor. Raw JSON/HTML artifacts are in ignored output/product/performance; all eighteen aggregate run records are committed in performance-results.json.

This is lab emulation on the developer computer, not physical low-end Android/iOS or a public deployment measurement. There is no CrUX, field INP, Search Console or real-user Core Web Vitals evidence. Anonymous entry does not measure signed-in API service latency. Private pages intentionally do not satisfy the Lighthouse indexability audit.

## Implemented optimizations
Seven licensed real photos have 400/800/1440px WebP variants, explicit width/height, accurate alternatives, priority for the hero and deferred below-fold loading. Photo derivatives total 2,556,346 bytes across all 21 files; pages download the applicable responsive size. Forty-six genuine WOFF2 files across thirteen families total 1,730,848 bytes in the repository; unicode ranges limit script downloads. English uses Geologica/system fallback and preloads the 24,944-byte Latin font so irrelevant Indic/Arabic fallback glyph downloads do not delay paint.

Public pages are primarily server components. Heavy map, planning, charts, institution and private photo-history modules load on demand. MapLibre's worker is served locally. Original PWA icons are 943/2,685 bytes. Fonts/images have immutable-ish public caching, while account HTML and API records remain private; no performance optimization expands private caching.

## Explicit slow-connection interaction check
The separate Playwright CDP check used a fresh anonymous Chromium profile, 360px viewport, 400ms network latency, 50,000 bytes/second download and four-times CPU slowdown. The latest pre-RC production build made the sign-in interface ready in 9,411ms, superseding the earlier 9,177ms sample. This demanding interactive-entry result exceeds a two-second aspiration and is reported plainly. Browser request size/timing evidence is in output/mobile-performance.json. Firefox and WebKit skip this CDP-only measurement. Current RC CI failures and subsequent final measurement evidence are tracked in ../release/RC_AUDIT.md.

## Final Lighthouse results
Medians of three fresh profiles per row. Milliseconds are converted to seconds for paint columns; bytes are unrounded transfer weights from Lighthouse. Scores are out of 100.

| Profile / route | Performance | Accessibility | Best practices | SEO | FCP seconds | LCP seconds | CLS | TBT ms | Transfer bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile / | 94 | 100 | 100 | 100 | 0.751 | 3.153 | 0 | 44 | 585261 |
| Mobile /for-farmers | 96 | 100 | 100 | 100 | 0.752 | 2.702 | 0 | 70 | 292487 |
| Mobile /app/today, anonymous | 92 | 100 | 96 | 58 | 1.052 | 3.226 | 0.0519 | 69 | 489176 |
| Desktop / | 99 | 100 | 100 | 100 | 0.203 | 0.923 | 0 | 0 | 877846 |
| Desktop /for-farmers | 100 | 100 | 100 | 100 | 0.202 | 0.562 | 0 | 0 | 292484 |
| Desktop /app/today, anonymous | 100 | 100 | 96 | 58 | 0.283 | 0.705 | 0.0071 | 0 | 489174 |

Private SEO score 58 reflects intentional noindex exclusions. Its best-practices score 96 reflects expected 401 responses from /api/v2/me and /auth/session when there is no authenticated account; the authentication contract is preserved. Public pages produce no such console failures. All eighteen runs reported no Lighthouse run warnings.

Compared with the valid preliminary mobile series, removing irrelevant fallback-script downloads reduced the homepage transfer from approximately 661KB to 585KB and For farmers from 369KB to 292KB. Public first paint improved from approximately 1.5 seconds to 0.75 seconds, and measured public CLS became zero. The final mobile LCP and strict interactive-entry results still exceed two seconds. Earlier accidentally mobile-configured desktop labels were discarded and are not used in this table.

## Interpretation
Layout stability, first meaningful paint, total blocking time and total bytes are checked independently. A simulated performance score is not proof of farmer task completion speed. Production geography, cold server start, real devices, cached revisits and provider response times need observed deployment/field data. No sub-two-second interactive, field INP or public-origin performance claim is made without evidence.

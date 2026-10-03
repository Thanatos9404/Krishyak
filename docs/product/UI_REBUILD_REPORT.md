# Product rebuild release report

## Outcome
The Vite SPA and dual dashboard have been replaced by an original Next.js App Router product. Public content is server-rendered. The farmer workspace uses Today, Farm, Scan, Market and More; institutional access has a separate role gate. FastAPI, PostGIS, Redis, migration history, private image handling, consent, cookie/CSRF and durable worker contracts are preserved.

The OneSoil reference informed spacing, rounded navigation, large restrained headings, photo composition and progressive disclosure. Krishyak uses original copy, layout, icons, synthetic demonstration state and seven licensed photographs. Geologica and twelve script families are self-hosted with SIL OFL notices. Photos have responsive WebP sizes and source/author/license provenance; illustrative landscapes are identified rather than presented as measured satellite evidence.

## Farmer workflow
Sign in when farm accounts are available; create a farm and field; draw/undo a boundary or enter area manually; start a crop cycle; inspect Today; record a human-readable update; scan and confirm a supported crop photo; inspect dated market information; manage processing/offline permissions and export records under More. Planning keeps real API simulations, comparisons and recommendations. Offline opted-in observations synchronize idempotently. Sign-out clears private device records. Demo interactions make no authenticated API writes.

## Verification performed on 2026-10-03
- Production build and ESLint passed; formatting passed; npm audit reported zero vulnerabilities.
- Frontend: 313 tests in 45 suites passed, including the nine migrated App integration checks, delayed/failed/confirmed consent checks, late crop evidence and unavailable-service/authorization boundaries.
- Backend regression: 232 tests ran successfully with two expected Windows/provider skips. One monitoring correction exempts only stateless GET /health/live from the legacy business request budget; readiness, other methods and business endpoints remain limited. The Docker API was rebuilt and its health returned to healthy; all existing database/photo/Redis volumes were preserved.
- Historical local production browser matrix: 31 passed, two intentionally skipped Chromium-only CDP measurements on Firefox/WebKit. This is superseded as release evidence by CI run 37132210505 at commit 7425c0c: 25 passed, three route-readiness failures, two CDP skips, three serial successors not run. Onboarding/consent passed on all three engines. RC fixes and the next verified result are tracked in ../release/RC_AUDIT.md; this branch is not yet a green release candidate.
- Nine widths: 320, 360, 375, 390, 412, 768, 1024, 1280 and 1440px. Checks cover public, demo and signed-in farmer routes, layout containment, Axe rules, keyboard dialogs, reduced motion and effective 200% zoom. Engine screenshots are in ignored output/product/screenshots.
- Raw SSR checks cover all nine public pages, unique H1/metadata/canonical/schema, no-JS content, genuine sitemap/robots/404 responses, redirects and private source isolation. Independent public crawl checks nine pages, 20 internal resources and no public orphans.
- Actual in-app browser map inspection exercised the self-hosted worker, corner drawing and undo/redo. Hindi planning input labels and long translated text were visually checked at 390px; no horizontal page overflow. Evidence: output/product/hindi-mobile.jpg.
- Credential-pattern review scanned 132 changed/new text candidates, with no matching private-key, GitHub, AWS, OpenAI or Google API credential patterns and no private environment/project-link files. This scoped review is not an exhaustive secret detection guarantee. Git whitespace review passed.

## Important limits
No physical device, human farmer usability study, professional screen-reader audit, agronomist approval, legal approval or production field-performance evidence is fabricated. The preserved planning tools retain 23 language packs; the new workspace currently uses an explicit English fallback and requires localization and human review before a multilingual field release. Crop model external validation limitations remain visible on Technology. Dated market observations and MSP references are not transaction guarantees.

All sixteen required handoff documents are provided. PERFORMANCE_REPORT.md distinguishes lab paint measurements from the much slower explicit Slow 3G interactive check. FARMER_USABILITY_TEST.md and AGRONOMIST_REVIEW_CHECKLIST.md are review protocols, not completed human validation.

## Release state
Branch: feat/krishyak-v2-product-experience-seo, based on verified v2 head 09068fadbfba43cbe216dd0e82e9235d374f1cd5. Main and existing PR #1 are preserved. The release is intended for a new draft PR against the v2 branch and an existing-project Vercel preview. CI and preview URLs are recorded after publication in the release evidence below; no production promotion is implied by local passing checks.

Search Console: AUTHORIZATION REQUIRED after approved production promotion. Forbes backlink: NOT ACQUIRED; no outreach sent. No ranking promise or paid service. Required provider credentials remain blank; operational provider/infrastructure prerequisites from the existing v2 release still apply.

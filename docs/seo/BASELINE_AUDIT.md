# Public SEO baseline

Recorded 3 October 2026 before the frontend migration. Raw read-only HTTP
results are in ignored `output/product/baseline-seo.json`.

| URL | Status | Actual response |
|---|---|---|
| `/` | 200 | 945-byte client application shell |
| `/robots.txt` | 200 | The same HTML shell, not robots text |
| `/sitemap.xml` | 200 | The same HTML shell, not XML |
| `/about` | 200 | The same shell, no server-rendered page content |
| `/technology` | 200 | The same shell, no server-rendered page content |
| `/does-not-exist-product-audit` | 200 | Soft 404: unknown route returns the shell |

All inspected responses have `text/html` content type, title “Krishyak - AI
Farm Decision Simulator”, no canonical link and zero source H1s. No robots meta
was found in these responses. There are no meaningful server-rendered internal
links or structured data in the shell. Client-rendered content is a separate
observation; it does not repair the source sitemap or unknown-route status.

The v2 local frontend baseline has 287 passing unit tests across 36 suites.
The preceding engineering phase recorded a 4.024-second emulated slow-mobile
sign-in entry. This is historical local evidence, not a current public Lighthouse
score. Search Console access, indexed-page counts and neutral ranking data are
not established by this audit.

The migration will create actual public content, unique metadata, canonical
URLs, genuine robots/sitemap resources, one-hop legacy redirects and genuine
unknown-route 404s. Private accounts, institution, preview and demo retain
intentional noindex boundaries.

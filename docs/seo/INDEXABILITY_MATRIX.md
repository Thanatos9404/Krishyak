# Indexability matrix
Production canonical origin: https://krishyak.vercel.app.

| Routes | Production robots | Sitemap | Rendering |
|---|---|---|---|
| /, /how-it-works, /technology, /for-farmers, /for-partners, /about, /faq, /privacy, /terms | index, follow | Nine exact canonical URLs | Meaningful SSR |
| /credits | noindex, nofollow | Excluded | SSR licenses |
| /demo | noindex, nofollow and header | Excluded | Synthetic client demo |
| /app and /app/** | noindex, nofollow and header; robots excludes /app/ | Excluded | Anonymous shell, private client data |
| /institution | noindex, nofollow and header | Excluded | Anonymous shell / authorized client |
| /offline | noindex, nofollow and header | Excluded | Neutral recovery page |
| /api/** | Private/authenticated or public data APIs; robots excludes | Excluded | JSON, not marketing pages |
| Unknown public/private route or invalid plot id | 404 | Excluded | Genuine not-found |
| Legacy farmer routes | One-hop 308 | Excluded | New destination |
| Every preview/staging route | noindex, nofollow header; metadata noindex; robots disallows / | No preview canonical publication | Never submit previews |

Canonical URLs always point to production, never query strings, preview hosts, session identifiers or duplicate legacy paths. Public navigation/footer link every indexable page. Privacy and terms are draft notices, not evidence of legal certification.

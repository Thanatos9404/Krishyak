# Frontend migration
## Baseline and boundaries
Started from v2 09068fadbfba43cbe216dd0e82e9235d374f1cd5 on feat/krishyak-v2-product-experience-seo. The FastAPI backend, migrations, ownership, opaque cookie/CSRF contracts, OTP checks, consent semantics, revision conflicts, model bundle and durable queue infrastructure remain unchanged.

## Framework
Exact stable Next.js 16.3.8 and React/ReactDOM 19.3.0 replace Vite. Node >=22.19; CI uses Node 24. App Router server components render public content, metadata, JSON-LD and actual 404s. Per-request CSP nonces require dynamic HTML rendering; sitemap/robots remain static. Private SSR returns anonymous shells; account data arrives from authenticated API calls in the client.

Same-origin /api/v2 and /api/public rewrites preserve existing backend routes. KRISHYAK_API_ORIGIN is server-only. Only explicit public legacy widget values are bundled. next.config.mjs supplies permanent legacy redirects, security headers and standalone output. scripts/start-production.mjs stages static assets and starts the standalone server on 127.0.0.1:3000.

## Product modules
useAccountSession handles authentication/consent and owner changes. useFieldRecords handles selected fields and stale response guards. useOfflineConnection handles deliberate opt-in and synchronization. useMutation serializes actions. useWorkspace composes these hooks. useSimulation preserves scenario inputs and response contracts. Focused Today/Farm/Scan/Market/More/Settings views replace the 1571-line FarmWorkspace. Public demo uses independent synthetic state, never authenticated hooks.

Map drawing remains a deferred feature with its MapLibre worker served from /map. Boundary controls replace the farmer GeoJSON textarea. Large charts, institution tools, photo history and planning views load on demand. Legacy planning styles are prefixed under .legacy-tools; they cannot restyle public pages.

## Retired code
The old App.jsx, index.jsx, index.html, Vite config, FarmWorkspace, LandingPage, standalone old policy components, index.css and field-design.css are removed after replacement flows were verified. Nine old App integration checks were migrated to PlanningView rather than dropped. Small old hooks remain only where their dedicated unit tests and preserved utilities still use them; there is no second routed product entry.

## Offline migration and rollout
Service worker krishyak-shell-v3-1 removes prior shell caches. Account/API/RSC/private-image responses are excluded. Only marked anonymous HTML and public assets are cached. Navigation fallback uses the real browser pathname; seven-day owner-isolated IDB records restore only after opt-in. Sign-out clears device records, broadcasts across tabs and defers server revocation when disconnected.

Review through the new draft PR and preview. Do not merge/promote main until infrastructure, privacy/legal and agronomic release gates are satisfied. Rollback means redeploying the prior verified source; no database rollback is needed for this frontend-only change.

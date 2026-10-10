# Verified boundaries and external release gates

Updated 10 October 2026. Missing credentials are explicit unavailable states,
never mock successes. Provider usage is budgeted in shared Redis per caller, per
day and (for metered services) per month, and fails closed if Redis is down.

## Live-verified integrations

Production (`krishyak.vercel.app`) has farmer accounts enabled since
10 October 2026 (schema v2_0010 on its own Neon database). The same live
browser journey as below passed against production with a synthetic account,
which was then deleted and its photo erased.

Staging (`krishyak-staging.vercel.app` → `krishyak-api-staging.vercel.app`,
Vercel previews behind deployment protection) runs with farmer accounts
enabled on Neon Postgres + PostGIS (Singapore), Upstash Redis and private
Vercel Blob. `scripts/smoke_staging.py` and `e2e/staging.spec.js` passed on
9 October 2026: readiness (schema v2_0010, PostGIS, Redis, request worker),
passkey sign-up in Chromium's virtual platform authenticator, a GPS-located
field receiving live weather, a real leaf photo classified by the deployed
LiteRT model and stored privately, a live Copernicus job drained by the
serverless worker, the market page, and account deletion with verified
byte erasure of the photo from Blob storage.

| Area | Verification on 9 October 2026 |
|---|---|
| Copernicus Data Space (satellite) | Real OAuth client; live catalog search, NDVI/NDMI/NDRE statistics and imagery previews through `CopernicusSentinelHubProvider` (`RUN_CDSE_LIVE=1`). A live-only defect (catalog `Accept` header, HTTP 406) was found and fixed with a regression test. Client secret expires 7 January 2027 and must be rotated before then. |
| Sarvam (speech + translation) | Authenticated, consented `/api/v2/speech/synthesize` (Hindi) then `/api/v2/speech/transcribe` returned the exact sentence. All 22 workspace language packs regenerated (21 via translate API, Sindhi via the document API in Arabic script). |
| Open-Meteo (weather) | Live 48-hour forecast saved for a field located only by a rounded GPS point and shown as plain conclusions. |
| Vercel private Blob (photos) | Private store in Mumbai (`bom1`); unauthenticated fetch returns 403, authenticated put/get/delete verified. |
| data.gov.in (mandi prices) | **Not verified.** `api.data.gov.in`, the base URL in the portal's own OpenAPI spec, refused TCP connections on 80 and 443 from India and from Vercel Singapore throughout the session while `data.gov.in` itself was up. The adapter (current + variety-wise history, stored series, stale fallback) is covered by tests; live verification must be repeated when the host returns. |

## External gates (outside engineering control)

| Area | Boundary |
|---|---|
| SMS one-time codes | Passkeys need no SMS. SMS sign-in still requires a paid Twilio Verify (or similar) account, and Indian SMS sending needs telecom DLT registration. |
| Government identity/records | MeriPehchaan login requires approved partner onboarding. No Aadhaar, land record, Farmer Registry, AgriStack, PM-KISAN or Soil Health Card API access exists; IMD point forecasts need IMD approval. Public scheme information only. |
| Mandi data source | Depends on the data.gov.in API host being available (see above). |
| ML field accuracy | External PlantDoc accuracy 57.2%; calibration and validation on Indian farm photographs require field data collection with farmers. |
| Advice review | Disease care steps (`backend/v2/disease_guidance.json`) and weather conclusions are conservative drafts without products or doses; agronomist review is required before claiming expert advice. |
| Languages | All 23 languages pass automated script/placeholder/glossary checks; native-speaker semantic review is still required. |
| Field validation | No consented farmer pilot, physical Android/iOS device testing, or human accessibility review has been performed. |
| Legal/operations | Operator identity, provider licences (commercial Open-Meteo/Copernicus terms), privacy policy legal review, incident contact and SLA need accountable human approval. |

## Known engineering limits

| Area | Limit |
|---|---|
| Offline | Device cache is not encrypted; photos need a connection; offline logout revokes the server session on reconnection. |
| Scheduled work | On Vercel, jobs drain inside requests plus a once-daily cron (Hobby plan limit). Cron runs only on production deployments; staging was exercised by calling the protected trigger. |
| Hosting | Neon, Upstash and Vercel free tiers: Neon compute scales to zero (first request after idle is slower) and has 0.5 GB storage; Upstash free has request limits; Vercel Hobby is for non-commercial use. A commercial launch needs paid plans approved by the operator. |
| Environments | Production (`krishyak.vercel.app`, `krishyak-api.vercel.app`) and staging have separate Neon databases, Redis keys (separate secrets) and session secrets; both use the same private Blob store under random per-farmer keys. Cron runs daily on production only. |
| Passkeys | Bound to one hostname; previews use the stable `krishyak-staging.vercel.app` alias. Browsers without WebAuthn see an explanation. |
| Bigha | Converted only after the farmer confirms the local size; standard sizes are suggested for West Bengal, Assam, Tripura and Rajasthan. |
| Scale | Bounded local load tests only; no high-volume soak or image-throughput certification. |

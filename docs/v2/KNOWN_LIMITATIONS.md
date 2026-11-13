# Verified boundaries and external release gates

Updated 12 November 2026. Missing credentials are explicit unavailable states,
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

On 12 November 2026 staging was migrated to schema v2_0011 and
`e2e/staging.spec.js` passed 9 of 9 against it on the release commit: the
seven journeys above plus a crop-loss report with a geo-tagged photo served
back from private storage, the crop calendar and Pest Radar answering for a
live wheat field, a Krishyak Live answer from Sarvam and the picture guides.
Production is still on v2_0010 and does not have these features until the
pull request is merged and migration v2_0011 is applied there.

| Area | Verification on 9 October 2026 |
|---|---|
| Copernicus Data Space (satellite) | Real OAuth client; live catalog search, NDVI/NDMI/NDRE statistics and imagery previews through `CopernicusSentinelHubProvider` (`RUN_CDSE_LIVE=1`). A live-only defect (catalog `Accept` header, HTTP 406) was found and fixed with a regression test. Client secret expires 7 January 2027 and must be rotated before then. |
| Sarvam (speech + translation) | Authenticated, consented `/api/v2/speech/synthesize` (Hindi) then `/api/v2/speech/transcribe` returned the exact sentence. All 22 workspace language packs regenerated (21 via translate API, Sindhi via the document API in Arabic script). |
| Open-Meteo (weather) | Live 48-hour forecast saved for a field located only by a rounded GPS point and shown as plain conclusions. |
| Vercel private Blob (photos) | Private store in Mumbai (`bom1`); unauthenticated fetch returns 403, authenticated put/get/delete verified. |
| data.gov.in (mandi prices) | Answering again on 11-12 November 2026 (a dated AGMARKNET price was shown in a local run with the project key), It refuses connections from Vercel's Singapore and US regions, so both projects run in Mumbai (`bom1`), where it answers. Status on 9 October: **Not verified.** `api.data.gov.in`, the base URL in the portal's own OpenAPI spec, refused TCP connections on 80 and 443 from India and from Vercel Singapore throughout the session while `data.gov.in` itself was up. The adapter (current + variety-wise history, stored series, stale fallback) is covered by tests; live verification must be repeated when the host returns. |

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
| Offline | Device cache and saved photos are not encrypted; a saved photo is checked only after the farmer reconnects and taps the button; there is no on-phone leaf model or language model; offline logout revokes the server session on reconnection. |
| Krishyak Live | One still frame and one question per turn through Sarvam, not a continuous Gemini Live stream; needs a connection; the leaf model's limits apply to the frame. |
| Pest Radar | Needs at least three sharing farmers within 10 km, so it stays quiet until a district has real users; it repeats model findings, which can be wrong; no alert has been checked against a confirmed outbreak. |
| Krishyak Verify | Sentinel-2 NDVI shows that plants grew after the stated sowing date, not the crop type; cloud can leave "not enough evidence" for weeks; no AlphaEarth, no billing and no PDF or partner API beyond the organiser desk and its print view. |
| Claim Kit | Prepares evidence and shows the official routes; it does not submit to PMFBY or an insurer, and the 72-hour rule text needs review against the current notified guidelines for each state and season. |
| Soil and map sources | SoilGrids often needs 10-30 s for a point it has not served; past the 20 s limit setup uses the labelled regional soil guess, and a background job asks again with a 40 s limit (up to three tries, 10 then 20 minutes apart) and upgrades the field to the soil-map class unless the farmer changed it. Bhuvan's public map catalogue is off: it did not answer from India or Vercel in November 2026. IMD needs approved access, so weather uses Open-Meteo. |
| Crop calendar | General day-count reminders for eight crops; not adjusted for variety, region or weather; awaiting agronomist review. |
| FPO Command Centre | Organiser accounts are granted by an operator in the database; there is no self-service organiser sign-up, billing or BigQuery analytics. |
| Google AI | Gemini Live, Earth Engine AlphaEarth, BigQuery, Nano Banana and Gemma are in the Buildathon plan but not integrated: no Google Cloud credentials exist for this project. |
| Scheduled work | On Vercel, jobs drain inside requests plus a once-daily cron (Hobby plan limit). Cron runs only on production deployments; staging was exercised by calling the protected trigger. |
| Hosting | Neon, Upstash and Vercel free tiers: Neon compute scales to zero (first request after idle is slower) and has 0.5 GB storage; Upstash free has request limits; Vercel Hobby is for non-commercial use. A commercial launch needs paid plans approved by the operator. |
| Environments | Production (`krishyak.vercel.app`, `krishyak-api.vercel.app`) and staging have separate Neon databases, Redis keys (separate secrets) and session secrets; both use the same private Blob store under random per-farmer keys. Cron runs daily on production only. |
| Passkeys | Bound to one hostname; previews use the stable `krishyak-staging.vercel.app` alias. Browsers without WebAuthn see an explanation. |
| Bigha | Converted only after the farmer confirms the local size; standard sizes are suggested for West Bengal, Assam, Tripura and Rajasthan. |
| Scale | Bounded local load tests only; no high-volume soak or image-throughput certification. |

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
On 13 November 2026 every external provider was checked on staging after both
Vercel projects moved to Mumbai (see the test report); live mandi prices now
load there. Production is still on v2_0010 and does not have these features
until the pull request is merged and migration v2_0011 is applied there.

| Area | Verification on 9 October 2026 |
|---|---|
| Copernicus Data Space (satellite) | Real OAuth client; live catalog search, NDVI/NDMI/NDRE statistics and imagery previews through `CopernicusSentinelHubProvider` (`RUN_CDSE_LIVE=1`). A live-only defect (catalog `Accept` header, HTTP 406) was found and fixed with a regression test. Client secret expires 7 January 2027 and must be rotated before then. |
| Sarvam (speech + translation) | Authenticated, consented `/api/v2/speech/synthesize` (Hindi) then `/api/v2/speech/transcribe` returned the exact sentence. All 22 workspace language packs regenerated (21 via translate API, Sindhi via the document API in Arabic script). |
| Open-Meteo (weather) | Live 48-hour forecast saved for a field located only by a rounded GPS point and shown as plain conclusions. |
| Vercel private Blob (photos) | Private store in Mumbai (`bom1`); unauthenticated fetch returns 403, authenticated put/get/delete verified. |
| data.gov.in (mandi prices) | Live on staging since 13 November 2026. It refuses connections from Vercel's Singapore and US regions, so both projects run in Mumbai (`bom1`), where it answers. Status on 9 October: **Not verified.** `api.data.gov.in`, the base URL in the portal's own OpenAPI spec, refused TCP connections on 80 and 443 from India and from Vercel Singapore throughout the session while `data.gov.in` itself was up. The adapter (current + variety-wise history, stored series, stale fallback) is covered by tests; live verification must be repeated when the host returns. |

## External gates (outside engineering control)

| Area | Boundary |
|---|---|
| SMS one-time codes | Passkeys need no SMS. SMS sign-in still requires a paid Twilio Verify (or similar) account, and Indian SMS sending needs telecom DLT registration. |
| Government identity/records | MeriPehchaan login requires approved partner onboarding. No Aadhaar, land record, Farmer Registry, AgriStack, PM-KISAN or Soil Health Card API access exists; IMD point forecasts need IMD approval. Public scheme information only. |
| Mandi data source | Depends on the data.gov.in API host being available (see above). |
| ML field accuracy | Leaf model v3 is right on 95.7 % of 3,659 held-out photographs from the Indian farm sources it learned from (paddy in Tamil Nadu, tomato in Rajasthan, sugarcane and cotton in Maharashtra, rice in Odisha), but on only 47 % of 300 photographs from two Indian sources it never saw, and those two sets are small and unchecked. On the external PlantDoc photographs it is right on 83.4 % with the crop selected. There are no public Indian farm photographs for wheat, potato or maize diseases. Reliable field accuracy needs photographs from Krishyak's own farmers with agronomist-checked labels. See `MODEL_GOVERNANCE.md` and `LEAF_DATASETS.md`. |
| Advice review | Disease care steps (`backend/v2/disease_guidance.json`) and weather conclusions are conservative drafts without products or doses; agronomist review is required before claiming expert advice. |
| Languages | All 23 languages pass automated script/placeholder/glossary checks, including no added lines and no percent sign split from its number; native-speaker semantic review is still required. |
| Ask Krishyak voices | Answers are read aloud by Sarvam in English and 10 Indian languages. Nepali, Maithili, Dogri and Sanskrit borrow the Hindi voice, Konkani the Marathi voice and Assamese the Bengali voice (the app says so); transcribing the result in the original language recovered 87-98 % of the text. Urdu, Kashmiri, Sindhi, Manipuri and Santali have no Sarvam voice in their script, so answers are spoken only where the phone has its own voice and are otherwise shown in writing. |
| Field validation | No consented farmer pilot, physical Android/iOS device testing, or human accessibility review has been performed. |
| Legal/operations | Operator identity, provider licences (commercial Open-Meteo/Copernicus terms), privacy policy legal review, incident contact and SLA need accountable human approval. |

## Known engineering limits

| Area | Limit |
|---|---|
| Offline | Device cache and saved photos are not encrypted; a saved photo is checked only after the farmer reconnects and taps the button; there is no on-phone leaf model or language model; offline logout revokes the server session on reconnection. |
| Krishyak Live | One still frame and one question per turn through Sarvam, not a continuous Gemini Live stream; needs a connection; the leaf model's limits apply to the frame. |
| Pest Radar | Needs at least three sharing farmers within 10 km, so it stays quiet until a district has real users; it repeats model findings, which can be wrong; no alert has been checked against a confirmed outbreak. |
| Krishyak Verify | Sentinel-2 NDVI shows that plants grew after the stated sowing date, not the crop type; cloud can leave "not enough evidence" for weeks; no AlphaEarth and no PDF or partner API beyond the organiser desk and its print view. The usage statement counts delivered reports at the list price; it is not an invoice, no payment is taken in the app, and tax invoicing, GST and collection stay outside the software. |
| Mandi prices | Mandi-level quotes come only from data.gov.in's AGMARKNET resources, which were down for part of 21 November 2026 (HTTP 502). No second mandi-level source could be used: the Agmarknet 2.0 portal demands a CAPTCHA or a login for every market-level report, eNAM's public price pages no longer return data, and the CEDA (Ashoka University) API is for non-commercial use and lags. When no local quote is as recent, the app shows the all-India average from the Agmarknet 2.0 dashboard, labelled as national; it covers 21 crops, trails by about two days, is an undocumented public endpoint that could change, and can differ a lot from a local mandi. For rice it is the paddy price and for cotton the raw cotton price. A nightly job stores the day's quotes for crops farmers have, so an outage shows dated prices rather than nothing. |
| Field report | Harvest starts from a district yield forecast (median error about 12 to 13 % two years ahead, see `backend/v2/data/yield_model_card.json`) and moves at most 30 % for farm practice; it does not see this field's soil test, variety or sowing quality unless the farmer enters them. Costs, seed quality and pest likelihood are fixed planning assumptions, not measurements. The price used is a local mandi quote when one is as recent as the all-India average, otherwise that average, otherwise the support price; a crop with none of these gets a harvest estimate and no money figures. |
| Registration lookup | Reverse geocoding uses OpenStreetMap Nominatim (one request per second, best effort); a village that is not mapped falls back to the district. Rainfall normals come from the Open-Meteo archive on a grid of roughly 10 km, not a gauge in the field. |
| Claim Kit | Prepares evidence and shows the official routes; it does not submit to PMFBY or an insurer, and the 72-hour rule text needs review against the current notified guidelines for each state and season. |
| Soil and map sources | SoilGrids often needs 10-30 s for a point it has not served; past the 20 s limit setup uses the labelled regional soil guess, and a background job asks again with a 40 s limit (up to three tries, 10 then 20 minutes apart) and upgrades the field to the soil-map class unless the farmer changed it. Bhuvan's public map catalogue is off: it did not answer from India or Vercel in November 2026. IMD needs approved access, so weather uses Open-Meteo. |
| Crop calendar | General day-count reminders for eight crops; not adjusted for variety, region or weather; awaiting agronomist review. |
| FPO Command Centre | Organiser accounts are granted by an operator in the database; there is no self-service organiser sign-up, payment collection or BigQuery analytics. |
| Google AI | Gemini Live, Earth Engine AlphaEarth, BigQuery, Nano Banana and Gemma are in the Buildathon plan but not integrated: no Google Cloud credentials exist for this project. |
| Scheduled work | On Vercel, jobs drain inside requests plus a once-daily cron (Hobby plan limit). Cron runs only on production deployments; staging was exercised by calling the protected trigger. |
| Dropped requests | A small share of requests that pass through the frontend to the API get no answer or are reset (1 of 40 in one sample against production, none in a later 120; none when the API is called directly). The app sends a read again once, after 8 seconds without an answer or at once when the connection breaks, so the farmer normally sees a short delay and no error. A write is never repeated automatically: the farmer sees the connection message and taps again, and saved observations stay on the device. The cause inside Vercel's forwarding has not been found. |
| Hosting | Neon, Upstash and Vercel free tiers: Neon compute scales to zero (first request after idle is slower) and has 0.5 GB storage; Upstash free has request limits; Vercel Hobby is for non-commercial use. A commercial launch needs paid plans approved by the operator. |
| Environments | Production (`krishyak.vercel.app`, `krishyak-api.vercel.app`) and staging have separate Neon databases, Redis keys (separate secrets) and session secrets; both use the same private Blob store under random per-farmer keys. Cron runs daily on production only. |
| Passkeys | Bound to one hostname; previews use the stable `krishyak-staging.vercel.app` alias. Browsers without WebAuthn see an explanation. |
| Bigha | Converted only after the farmer confirms the local size; standard sizes are suggested for West Bengal, Assam, Tripura and Rajasthan. |
| Scale | Bounded local load tests only; no high-volume soak or image-throughput certification. |

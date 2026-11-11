# Krishyak: Field Intelligence

An India-first farm decision-support app: private field records, crop-photo
checks, satellite views, local weather, mandi prices, government scheme
information, planning, voice and 22 Indian languages, built to work on low-end
phones and patchy networks.

**Live:** [krishyak.vercel.app](https://krishyak.vercel.app/). The landing page
works in every supported language and leads straight to passkey sign-in; the
farmer dashboard is at `/app/today` and scenario planning at
`/app/more/planning`.

**Start here:** [Technical design document](docs/TECHNICAL_DESIGN.md) ·
[Sample data and test cases](docs/SAMPLE_DATA_AND_TESTS.md) ·
[Demo farm, no sign-in](https://krishyak.vercel.app/demo) ·
[License: Apache-2.0](LICENSE)

**Release status, 10 October 2026:** PR #1 and PR #2 are merged into `main`,
which deploys production automatically. Farmer accounts are enabled in
production on Neon Postgres + PostGIS, Upstash Redis and private Vercel Blob
storage, with passkey sign-in. A live browser journey (sign-up, weather, photo
check, satellite job, market, account deletion) passed against production.
Field validation with farmers, native-language review and agronomist review
have not happened yet; see [known limitations](docs/v2/KNOWN_LIMITATIONS.md).

## What farmers get

- **Voice mode.** A big microphone on every screen (centre of the phone's
  bottom bar, and on Home). The farmer speaks in their language; Sarvam
  transcribes it, `sarvam-105b` answers in two or three short sentences using
  only that farmer's own field, crop, weather, mandi and photo-check records,
  and the answer is read aloud. Answers never name pesticides or doses and
  point to the free Kisan Call Centre for anything chemical. Nothing from the
  conversation is stored. Typing works too.
- **Spoken farm setup.** On a new account, Home offers "Tell Krishyak about
  your farm". The farmer says something like "main Dhaulpur se hoon, mere paas
  5 bigha zameen hai, gehun ki kheti karta hoon, meri mitti sookhi hai".
  `sarvam-105b` reads it into a draft, which is checked against fixed lists:
  district names are matched to the official catalogue (Dhaulpur → Dholpur,
  Rajasthan), land is converted to hectares (bigha uses the state's standard
  size, which the farmer confirms), and the crop is matched to the catalogue.
  The village is located with OpenStreetMap, checked to be inside that
  district. If soil wasn't mentioned, it is estimated from ISRIC SoilGrids
  texture near the village, or as a labelled regional guess. The farmer
  corrects anything before it is saved as their profile, field and crop.
- **Field report.** Field score, expected harvest with a range, profit or
  loss at the stored mandi price (or MSP), seed and fertilizer amounts,
  waterings, weather/pest/price/soil risks, pests active this month, a
  same-season crop comparison with a "better crop" suggestion when one is
  clearly more profitable at similar risk, a practical improvement plan, and
  the schemes worth checking for this field (PM-KISAN, PMFBY with its premium
  rate, Soil Health Card, KCC, PMKSY and PM-KUSUM for dry or rain-fed land,
  e-NAM). It can be read aloud. Figures come from the planning engine's
  heuristics and say so.
- **Krishyak Live (show and ask).** The farmer points the camera at a plant
  and asks a question aloud. One still frame is checked by the leaf model,
  the question is transcribed, and `sarvam-105b` answers in a few short
  sentences using that field's own records, then reads the answer aloud.
  The frame is never stored. It works turn by turn, not as a continuous
  video call.
- **Pest Radar.** When three or more other farmers within 10 km find the
  same disease on the same crop in a fortnight, Home leads with an early
  warning and three picture steps. Only farmers who chose to share count,
  farm counts are rounded down (3, 5 or 10 "or more") and no name or place
  is shown.
- **Crop calendar.** "This week on your wheat": what the crop usually needs
  now and what comes next, counted from the sowing date, for wheat,
  mustard, chickpea, maize, bajra, cotton, soybean and rice.
- **Claim Kit.** A crop-loss report with up to eight photos stamped with
  time and GPS position, the distance of each photo from the field, the
  satellite view before and after when one exists, and the farmer's
  details laid out as one printable sheet. It shows the PMFBY helpline
  (14447) and the 72-hour window for hail, flood, landslide, fire and rain
  after harvest. It prepares evidence; it does not file the claim.
- **Picture guides.** First steps for 26 leaf diseases as numbered drawings
  with one short line each. The library ships inside the app, opens without
  an account and works with no signal.
- **Farmer groups and the FPO Command Centre.** An organiser creates a
  group and gets an eight-character code. A farmer who enters it sees
  exactly what will and will not be shared, picks the fields, and can leave
  at any time. The organiser's dashboard lists each shared field with its
  crop, latest photo check, satellite greenness, nearby disease alerts and
  loss reports. Phone numbers, field outlines, photographs, notes, costs
  and sales are never shared.
- **Krishyak Verify.** A lender or insurer creates a check with their own
  reference; the farmer enters the code, reviews what is shared and agrees
  for one field. The report compares the stated sowing date with Sentinel-2
  greenness since sowing and says "consistent", "needs review", "too early"
  or "not enough evidence", with its limits printed on it. The farmer can
  withdraw it. It supports a person's decision; it is not an approval.
- **A simple Home.** Greeting, the voice card, eight large tiles (show and
  ask, my field report, check a sick plant, mandi prices, note what I saw,
  report crop loss, government schemes, call the helpline), then the crop
  calendar, weather, price and next steps for the selected field.
- **Sign-in without SMS.** Passkeys use the phone's fingerprint or screen lock;
  a one-time recovery code (shown once) covers a lost phone, and a family
  member's phone can be added. An optional mobile number is stored unverified.
- **Field context on Home.** Plain weather conclusions for the field (rain, heat, wind and what
  they mean for spraying or irrigation), the current crop's nearest mandi price
  against MSP, and next steps. Weather refreshes itself; a field needs only a
  GPS point (rounded to about 1 km), not a drawn boundary.
- **Farm records.** Farms, fields, crop cycles, observations and soil readings
  with an account export and deletion. Area in acres, hectares, bigha (size
  confirmed by the farmer), guntha, kanal or cent.
- **Check a sick plant.** A photo of one leaf gives a likely cause, first
  non-chemical steps and the free Kisan Call Centre number (1800-180-1551).
  Photos are resized on the phone and stored privately.
- **Satellite view.** "Greener" or "drier" than the last clear Sentinel-2 view;
  NDVI/NDMI/NDRE and band details stay under technical details.
- **Mandi prices.** AGMARKNET prices per market with week-on-week change
  computed only from dated quotes of the same market, variety and grade.
- **Schemes and planning.** Official scheme information (no eligibility claims)
  and the scenario simulator.
- **Languages and voice.** English plus all 22 scheduled Indian languages,
  right-to-left for Urdu, Kashmiri and Sindhi. Consented voice input works in
  every scheduled language (browser engine as fallback); read-aloud uses a
  device voice or one of the 11 languages with a server voice.
- **Offline.** Optional owner-scoped snapshots and a queued notes outbox that
  syncs on reconnection. With no signal a farmer can still open the picture
  guides and save up to five leaf photos on the phone; they are checked
  with one tap once the phone is online again. The screens that work
  offline are fetched in the background while the phone is online.

Permissions (location, analysis, satellite, speech) are asked in context with
a reason and can be withdrawn in Settings.

## How it is built

- **Frontend:** Next.js 16 (App Router, React 19) on Vercel. The middleware
  forwards API calls same-origin with a two-minute HMAC-signed client address.
- **API:** FastAPI on Vercel (region `sin1`) with SQLAlchemy/PostGIS, Alembic
  migrations (`v2_0001`–`v2_0011`), opaque hashed sessions, CSRF and Origin
  binding, and WebAuthn passkeys.
- **Jobs:** a durable Postgres queue drained inside requests and by a daily
  Vercel Cron call (`CRON_SECRET`); a dedicated worker process is also supported.
- **Providers:** Copernicus Data Space (Sentinel-2), Open-Meteo, data.gov.in
  AGMARKNET, Sarvam (speech and translation) and a LiteRT disease classifier. Every provider credential is budgeted in Redis per caller, per day
  and, where metered, per month; budgets fail closed.

See [architecture](docs/v2/ARCHITECTURE.md), [API](docs/v2/API.md),
[security](docs/v2/SECURITY.md) and [deployment](docs/v2/DEPLOYMENT.md).

### Buildathon features and Google AI

The Startup Buildathon India 2026 plan names Google services for seven
features. This repository has no Google Cloud credentials yet, so each
feature is built and tested on the stack already verified here. The table
says plainly what runs today and what the Google service would add.

| Feature | Runs today on | Planned Google service, not integrated |
|---|---|---|
| Krishyak Live | Camera still frame + own LiteRT leaf model + Sarvam speech and `sarvam-105b`, one turn at a time | Gemini Live for continuous audio and video |
| Krishyak Verify | Sentinel-2 NDVI through Copernicus Data Space, rule-based verdict with printed limits | Earth Engine AlphaEarth embeddings and Gemini for crop-type evidence |
| Pest Radar | PostGIS distance query over consented photo-check results | None required |
| Picture guides | Hand-drawn SVG pictograms matched to each reviewed step | Nano Banana for illustrated scenes |
| Claim Kit | Geo-tagged photos, stored Sentinel-2 views, printable sheet | None required |
| Offline mode | Service worker, bundled guide library, on-phone photo queue | Gemma with LiteRT for answers on the phone |
| FPO Command Centre | Postgres queries behind an organiser role | BigQuery for district-scale analytics |

Nothing in the app claims to use a Google model. Crop type is not detected
from space, Live is not a streaming call, and offline mode has no on-phone
language model.

## Evidence boundaries

The disease model is `publisher-efficientnet-colab-v1` (EfficientNetV2B0,
38 classes, 14 crops): 94.39% validation, 93.71% internal test and 57.21% on
the external PlantDoc set (n=229). It abstains below 0.75 confidence or on a
crop mismatch; on the internal test it answers 88.7% of photos at 98.5%
accuracy, and on PlantDoc it cuts confident wrong answers from 42.8 to 5.2 per
100 photos. It has not been validated on Indian farm
photos, so results are presented as a first opinion with expert confirmation.
Disease care steps and weather advice are conservative drafts without product
names or doses and need agronomist review. Satellite indices cannot diagnose
disease, nutrients, yield or irrigation needs. Planning economics are
assumptions and uncertainty estimates, not guarantees.

The crop calendar is a set of general reminders by days after sowing, Pest
Radar repeats what the leaf model reported on other farms (a warning, not a
diagnosis), and a Verify report shows that plants grew after the stated
sowing date, not which crop they are. All three need agronomist review and
a field pilot before anyone relies on them.

Live-verified on 9–10 October 2026: Copernicus, Sarvam, Open-Meteo, private
Blob storage, Neon and Upstash. data.gov.in's API host refused connections
throughout October; it answered again on 11–12 November 2026 and the Home
screen showed a dated AGMARKNET wheat price for Jaipur district in a local
run with the project key. The staging deployment (Vercel Singapore) still
reported the source as unavailable on 12 November, so live mandi data is
verified locally only.

## Run locally

Use Python 3.12, Node 22+ and Docker Desktop (or PostgreSQL 16 + PostGIS and
Redis inside WSL, bound to localhost; see deployment). Install
`backend/requirements-dev.txt` in a venv and run `npm ci` in `frontend`. Full
configuration is in [deployment](docs/v2/DEPLOYMENT.md).

```sh
docker compose -p krishyak-v2 --env-file .codex-tmp/v2-local.env -f docker-compose.v2.yml up -d
python scripts/run_v2_local.py migrate
python scripts/run_v2_local.py api
# Separate terminals:
python scripts/run_v2_local.py worker
cd frontend
npm run build
npm start
```

Local development may use synthetic test mobiles with code `123456` (no SMS is
sent); deployments reject that configuration. Never commit env files, photos,
tokens or backups.

### Environment variables

Copy `backend/.env.example` to an ignored `.env` (every variable is documented
there) and `frontend/.env.example` to `frontend/.env.local`. The ones that
matter most:

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `SECRET_KEY` | API | yes | Signing key for legacy endpoints |
| `CORS_ORIGINS` | API | yes | Exact frontend origins; also the passkey relying parties |
| `KRISHYAK_V2_ENABLED` | API | for accounts | Turns on the v2 farmer workspace |
| `V2_DATABASE_URL` (or `DATABASE_URL`) | API | for accounts | PostgreSQL + PostGIS |
| `V2_REDIS_URL` (or `KV_URL` / `REDIS_URL`) | API | for accounts | Usage budgets and rate limits |
| `V2_AUTH_SECRET` | API | for accounts | Session secret, 32+ random characters |
| `V2_STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN` | API | for photos | `local`, `s3` or `vercel_blob` private photo storage |
| `CRON_SECRET`, `V2_WORKER_MODE` | API | for jobs | Daily worker call and worker mode (`request` or `dedicated`) |
| `KRISHYAK_PROXY_SECRET` | API and frontend | recommended | HMAC key for the signed client header |
| `REMOTE_SENSING_ENABLED`, `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` | API | optional | Copernicus Sentinel-2 satellite evidence |
| `SARVAM_API_KEY` | API | optional | Voice mode answers, voice input and read-aloud |
| `SARVAM_CHAT_MODEL`, `SARVAM_CHAT_DAILY` | API | optional | Voice-mode model (default `sarvam-105b`) and its global daily question budget (default 3000) |
| `DATA_GOV_IN_API_KEY` | API | optional | AGMARKNET mandi prices |
| `KRISHYAK_API_ORIGIN` | frontend | yes in production | Where `src/proxy.js` forwards `/api/v2` and `/api/public` |

Without the optional keys the app still runs; the matching screens say the
source is unavailable instead of inventing data. Production settings are in
[deployment](docs/v2/DEPLOYMENT.md).


## Verify and operate

- `python -m unittest discover` in `backend/` (PostGIS integration tests need
  `V2_TEST_DATABASE_URL`), `npm test`, `npm run build` and `npm run test:e2e` in
  `frontend/` (Chromium, Firefox, WebKit and a Pixel 7 profile).
- CI runs the same with disposable PostGIS and Redis, plus migrations,
  Bandit, pip-audit, npm audit and a container classifier smoke.
- Live checks against a deployment: `scripts/smoke_staging.py` and
  `V2_E2E_STAGING=true npx playwright test e2e/staging.spec.js --project=chromium`.
- `/health/live` is liveness; `/health/ready` checks the schema head, PostGIS,
  Redis and the worker (heartbeat, or no stranded jobs in request mode).

## Documentation

- [Known limitations and external gates](docs/v2/KNOWN_LIMITATIONS.md),
  [test report](docs/v2/TEST_REPORT.md), [delivery report](docs/v2/DELIVERY_REPORT.md).
- [Architecture](docs/v2/ARCHITECTURE.md), [domain](docs/v2/DOMAIN_MODEL.md),
  [API](docs/v2/API.md), [database](docs/v2/DATABASE.md),
  [satellite evidence](docs/v2/REMOTE_SENSING.md), [model governance](docs/v2/MODEL_GOVERNANCE.md).
- [Security](docs/v2/SECURITY.md), [threat model](docs/v2/THREAT_MODEL.md),
  [privacy](docs/v2/PRIVACY.md), [offline](docs/v2/OFFLINE_ARCHITECTURE.md),
  [deployment](docs/v2/DEPLOYMENT.md), [recovery](docs/v2/DISASTER_RECOVERY.md).
- [Government boundary](docs/v2/GOVERNMENT_INTEGRATION.md),
  [farm context, voice and provider setup](docs/government-data-integrations.md),
  [pilot protocol](docs/v2/PILOT_PLAN.md), [due diligence](docs/v2/DUE_DILIGENCE.md),
  [cost model](docs/v2/COST_MODEL.md), [datasets](datasetused.md).
- Product and SEO: [UI rebuild](docs/product/UI_REBUILD_REPORT.md),
  [design system](docs/product/DESIGN_SYSTEM.md),
  [SEO report](docs/seo/FINAL_SEO_REPORT.md).

## License

Krishyak is open source under the [Apache License 2.0](LICENSE). See
[NOTICE](NOTICE) for attribution and third-party data and font licences.

[Public app](https://krishyak.vercel.app/) ·
[Repository](https://github.com/Thanatos9404/Krishyak)

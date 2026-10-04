# Government data and automatic farm context

Implementation status checked on 4 October 2026. Government registration, credentials and consent are independent requirements. An implemented adapter does not establish production authorization.

## Available behavior

Authenticated farmers can load area context from **My farm** or **Planning**, after granting `government_integration`. Device location additionally requires `location_processing` and browser permission. Manual state/district/crop selection remains available. Lookups never create a field. Farmers review detected LGD names before saving administrative codes to their profile.

`POST /api/v2/farm-context` returns validated sections for location, weather, soil, maps, markets and the existing public scheme catalogue. Each section reports provenance, retrieval time, observation time when available, expiry, fallback/cache state and availability. Missing evidence is null. An empty market response is unavailable, not a zero price. Partial failures preserve useful sections.

`POST /api/v2/farm-context/planning` requires analysis consent and validates the existing scenario inputs. One context request feeds the existing scenario engine. Weather evidence is short-range context, not seasonal expected rainfall. Soil concentrations never become fertilizer kg/ha or a laboratory soil category. A market price is imported only after explicit review, comparable crop/unit/date checks, freshness checks and a quote fingerprint match. Cotton quotes cannot replace lint prices because the basis is unverified. The current stochastic price model remains decision support, not a trained market forecast.

The original public planning API and manual field observations remain available. Private context and recordings are not written to browser storage, offline queues or service-worker caches.

## Provider status

| Provider | Implemented interface | Current limitation |
| --- | --- | --- |
| LGD | Existing dated state/district catalogue, canonical codes and aliases | No verified village/subdistrict spatial dataset; missing codes stay null |
| Nominatim | Fixed reverse endpoint, coarse coordinates, cache and pacing; public Jodhpur city-centre probe resolved the area | Enabled privately for the local small pilot; default remains opt-in; no country inference from an India bounding box alone |
| IMD | Documented `cityforecastloc`, station distance, issue date and seven daily forecasts | Endpoint returned 401; approval required; no guessed token scheme |
| Open-Meteo | Current conditions and 48 hourly forecasts with unit/time validation; live public-city fallback verified | Explicit fallback label; free/non-commercial publisher terms must fit deployment |
| ISRO Bhuvan | Documented WMS GetCapabilities, bounded XML parser | Live probe timed out; catalogue availability does not establish point land use, flood or ownership evidence |
| SoilGrids | Documented REST property normalization, 0-5 cm, units and uncertainty | Publisher has paused REST; disabled by default; no invented laboratory report |
| data.gov.in / AGMARKNET | Existing official resource, exact area/crop filtering, dates, units, deduplication, quote fingerprints | Existing active key saved privately in the ignored local environment; the authorized live API request timed out before an HTTP response; no live quotes verified |
| Government schemes | Existing sourced public information catalogue | No official benefit eligibility or approval check |
| MeriPehchaan / DigiLocker | Approved member OAuth login boundary, only `openid` | Disabled until partner approval, issuer, signing key, client credentials and nonce support are confirmed |
| Soil Health Card, AgriStack, e-NAM, IMD agricultural advisories | Typed authorized request and disabled adapter contracts | No documented approved machine-readable contract is configured; no scraping or fake results |

The login used by data.gov.in is JanParichay. It is distinct from the DigiLocker member adapter implemented here. Do not copy one member's credentials or assume interchangeability.

## Verified primary references

- [IMD API reference](https://api.imd.gov.in/public/api_reference.html) and [support contacts](https://api.imd.gov.in/public/contact.php).
- [Bhuvan web-service catalogue](https://bhuvan-app1.nrsc.gov.in/2dresources/bhuvanstore.php).
- [SoilGrids REST availability and fair use](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html), [property units](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html).
- [Official mandi resource](https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi).
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- [MeriPehchaan DigiLocker authorized partner specification](https://www.meripehchaan.gov.in/assets/img/chose/Digital%20Locker%20Authorized%20Partner%20API%20Specification%20v2.0.pdf).

An authorized request for no-cost IMD onboarding guidance was sent to the published support contact. No documents were attached. Approval and authentication instructions are still required. If an onboarding process requires documents, the owner must complete it manually.

## Architecture and resilience

`backend/v2/farm_context/models.py` contains strict bounded Pydantic contracts. `providers.py` translates raw publisher responses. `transport.py` permits six fixed destinations only, rejects redirects and unexpected content types, limits decoded response size to 2 MiB and enforces a nine-second total deadline. Four network slots, 32 in-flight cache identities, single-flight request reuse, a 30-second failure cooldown and bounded stale windows prevent uncontrolled fan-out. Independent providers run concurrently after country/location resolution.

Public provider cache identities contain hashed coarse coordinates or public area/crop values, never farmer identity. Cache budget is 256 entries / 4 MiB per process. Weather TTL is 15 minutes for IMD and 30 minutes for fallback; fallback stale allowance is 30 more minutes. Location and Bhuvan catalogue TTLs are one day; Bhuvan has one more day of marked stale allowance. Soil TTL is seven days. Market TTL is one hour with one more hour of marked stale allowance; quotes older than two days cannot be imported.

Nominatim spacing uses shared Redis SET NX with a 1.1-second expiry; SoilGrids uses 12.1 seconds. Deployed operation fails closed if pacing storage is unavailable. Development has process-local pacing only. Enabling `FARM_CONTEXT_NOMINATIM_ENABLED` disables the legacy place lookup even if its flag is also enabled, preventing two independent routes from exceeding publisher pacing. Prefer the new consent-aware flow. High-volume deployments require a provider contract or self-hosted geocoder, not increased public-service quotas.

There are no automatic retries of paid speech calls, identity exchanges, context mutations or scenario POST requests. Refresh/retry is a farmer action. Context and scenario user quotas are 12/hour and 6/hour respectively. CPU scenario work is limited to two concurrent jobs.

## Identity and privacy

Migration `v2_0007` adds only a government identity link table with farmer foreign key and unique issuer/subject and farmer/issuer constraints. First linking requires an existing phone session and separately granted `government_identity`. Verified claims cannot create an account using a supplied phone number. Subsequent government sign-in resolves an existing authorized link.

OAuth uses single-use 10-minute Redis state bound to an opaque Secure HttpOnly SameSite=Lax flow cookie, PKCE S256, nonce, fixed publisher URLs and an exact HTTPS callback origin. RS256 signature, issuer, audience, issue/expiry timestamps and subject are verified against approved configuration. No documents, Aadhaar, demographic claims or userinfo endpoints are requested. A keyed subject digest is retained; provider access, refresh and identity tokens are discarded. Access token revocation is attempted immediately; provider expiry remains the limit if revocation is unavailable. Existing opaque session cookies are issued after verification and consent is rechecked following provider calls.

Uvicorn callback logs strip query parameters. Configure edge/proxy logs to omit callback query strings too. Provider logs contain provider name, status and duration, not URLs, tokens, GPS or identities. Account export excludes the subject digest. Unlinking removes the link; account deletion cascades it. Existing phone logout revokes the application session and does not claim to log the user out of the government portal.

Raw device coordinates exist only during the request. Outbound public location/forecast requests round coordinates to two decimals. No precise coordinates or village names enter the new context cache or account. Only explicitly confirmed state/district codes are saved. Consent, logout and account state are rechecked after slow operations. Withdrawal prevents returning late personalized results.

## Voice and official branding

The original `frontend/public/krishyak_logo.png` is used without modifying its bytes in the header, favicon, Apple icon, manifest, organization metadata and sharing images.

Farmer forms expose voice controls for the selected eligible input. Passwords, OTPs, hidden fields, uploads and action controls are excluded. Browser recognition uses the selected pilot language when supported. Other supported browsers can use the configured server speech transport with explicit `speech_processing` consent. Recordings are bounded to 29 seconds and 5 MiB in the browser; existing vendor quotas still apply. Krishyak does not retain audio or transcript. Browser/vendor processing has its own retention terms and is disclosed. No paid speech or translation request was made during this implementation.

Every transcription remains editable until the farmer chooses **Use this value**. It never submits a form. Numeric scripts and bounded number words are normalized; unclear values remain a draft. Select labels map to canonical option IDs. Changing target, language or owner cancels the old recording. Permission withdrawal aborts the private transport. This is assisted entry and still requires review of agronomic values.

## Setup and verification

Use existing v2 PostGIS, private sessions and Redis deployment configuration. Run Alembic upgrade to head before starting the backend. The new variables are in `backend/.env.example`; credentials remain blank. Enable each public provider only when its current interface and permitted usage are verified. Never infer authorization from an enabled flag.

For MeriPehchaan, obtain partner approval and verify the identity-only scope, nonce contract, client secret, exact callback, issuer and public RS256 key. Keep `MERIPEHCHAAN_ENABLED` and `MERIPEHCHAAN_PARTNER_APPROVED` false until all are provided. Missing configuration preserves phone login. There is no development mock presented as real government login.

Tests use synthetic provider payloads, generated RSA test keys, and a named disposable local PostGIS database. They require no government account, microphone, real OTP, paid API or live provider data. Automated tests cover response bounds, fixed URLs, redirects, units, dates, XML entities, countries, cache/stale behavior, failure isolation, CSRF, withdrawal, account-link ownership, state replay, signature verification and unchanged scenario calculations. Browser tests must also cover 320 px layouts, manual fallback, GPS denial, permission changes and offline states before release.

Release verification on 4 October 2026 passes 274 backend tests with two optional runtime/provider skips, 347 frontend tests across 63 suites, and 40 production browser checks across Linux Chromium, Firefox and WebKit with two CDP-only performance skips. The new mobile context and reviewed voice flow runs in each browser. Separate transcript labels and input/change events preserve reviewed values in React controls across browsers. Production build, lint, formatting, Bandit, dependency audits, ten pilot locale packs at 1,763 strings each, migration round trip, schema drift, disposable database backup/restore and the container's network-disabled classifier smoke all pass. The public crawl passes nine SSR pages and 21 resources with no orphans.

The final guarded local browser run removed three generated fields and three empty generated farms, preserving all other records. Object deletion left zero queued objects. The public demo remains one `demo field` and makes no account writes. Native semantic review, approved government member onboarding and a matching production v2 deployment remain separate release gates; these local results do not establish them.

The main runtime requirements include the shared locked adapter manifest used by development and CI. The network-disabled container smoke imports the full application, verifies government routes and RSA support, and runs the classifier. Source preparation requires the shared manifest so clean builds cannot omit XML or identity dependencies.

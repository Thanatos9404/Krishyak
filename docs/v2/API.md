# Private API

The generated OpenAPI contract at `/docs` is authoritative for field names and
schemas. Private routes use `/api/v2`. Existing public planning routes retain
their original paths. All private responses are `Cache-Control: no-store`.

| Resource | Routes |
|---|---|
| Configuration | `GET /status` (configuration only, not live provider verification) |
| Passkey sign-in | `POST /auth/passkey/register/options`, `/auth/passkey/register/verify`, `/auth/passkey/login/options`, `/auth/passkey/login/verify`, `/auth/recovery` |
| Sign-in devices | `GET /me/passkeys`, `POST /me/passkeys/options`, `/me/passkeys/verify`, `DELETE /me/passkeys/{id}`, `POST /me/recovery-code` (recent sign-in required) |
| Authentication | `POST /auth/request-otp`, `/auth/verify-otp` (only when an SMS provider is configured), `/auth/refresh`, `/auth/logout`; `GET /auth/session` |
| Account | `GET/PATCH/DELETE /me`, `GET /me/export` |
| Consent | `GET/POST /consents` |
| Farm | `GET/POST /farms`, `PATCH/DELETE /farms/{id}` |
| Plot | `GET/POST /plots`, `PUT/DELETE /plots/{id}`; optional `approximate_location` (rounded to 0.01°, India only) when no boundary is drawn |
| Crop cycle | `GET/POST /plots/{id}/crop-cycles`, `PUT/DELETE /crop-cycles/{id}` |
| Evidence | `POST /plots/{id}/observations`; `GET /plots/{id}/today`, `/timeline` |
| Soil/weather | `GET/POST /plots/{id}/soil`; `GET /plots/{id}/weather`, `POST /plots/{id}/weather/refresh` |
| Satellite | `GET /plots/{id}/remote-sensing`, `POST .../refresh`, `POST .../preview` |
| Crop photo | `POST/GET /disease-scans`, `GET /disease-scans/{id}/image`, `DELETE /disease-scans/{id}`; results include plain-language `guidance` (no products or doses) |
| Mandi prices | `GET /market/prices?crop=&state=&district=` (public, rate limited): latest modal ₹/quintal per market series, 7- and 28-day change from dated quotes, sources and limits |
| Operations | `GET /internal/worker` (Vercel Cron, `Authorization: Bearer $CRON_SECRET`; 404 otherwise) |
| Feedback/review | `POST /feedback`, `GET /review-queue`, `POST /review-queue/{id}`, `GET /review-queue/{id}/image` |
| Institutions | `/admin/pilots`, `/admin/pilots/{id}/report`, `/admin/model-monitoring` |
| Enrollment | `/pilot-enrollments`, `/pilot-enrollments/{id}` |
| Notices/catalog | `/notifications`, `/notifications/{id}/acknowledge`, `/benefits/catalog` |
| Private speech | `GET /speech/capabilities`, `POST /speech/transcribe`, `POST /speech/synthesize` |
| Spoken farm setup | `POST /farm-setup/understand` with `text` (≤1,000 characters) and `language`. Needs `speech_processing`; with `location_processing` it also finds the village (OpenStreetMap Nominatim, checked against the district) and estimates soil from SoilGrids texture. Returns a draft (place codes, hectares, crop ID, soil and its source, water, rounded location, missing fields) and stores nothing. 20/hour per farmer, 10/minute per IP, shared global model budget |
| Field assessment | `POST /plots/{id}/assessment` (needs `agronomic_analysis`; 20/hour): field score, harvest and profit ranges, price source, seed/fertilizer/watering inputs, risk components, active pests, same-season alternatives and `better_crop`, an improvement plan and scheme IDs with reasons. Plots accept an optional `soil_metadata` (`soil_type`, `source`, `condition`, `seed`); edits that omit it keep the stored value |
| Krishyak Live | `POST /live/turn` (multipart: `question` ≤500 characters, `language`, optional owned `plot_id`, `history` JSON of up to six turns, optional JPEG/PNG/WebP `frame`). Needs `speech_processing`; a frame also needs `agronomic_analysis`. The frame is classified in memory and never stored. Returns `answer`, one `action` and `camera` (the leaf finding: status, likely problem, cause, urgency and first steps). 40/hour per account plus the voice-assistant budgets |
| Pest Radar | `GET /plots/{id}/pest-radar`: `needs_location`, `needs_permission`, `needs_crop`, `watching` or `alert` with disease name, `farms_at_least` (3, 5 or 10), `rising`, `urgent` and care steps. Counts only other accounts with `community_alerts` consent, same crop, 10 km, 14 days |
| Crop calendar | `GET /plots/{id}/calendar`: day since sowing or transplanting, tasks due `now` and the `next` task with its date; `needs_crop` or `crop_not_covered` (with `covered_crops`) otherwise |
| Claim Kit | `POST/GET /plots/{id}/loss-reports`; `GET/DELETE /loss-reports/{id}`; `POST /loss-reports/{id}/photos` (multipart: `operation_id`, `captured_at`, `latitude`, `longitude`, `accuracy_metres`, `image`; needs `location_processing`; at most 8 photos per report, 24/hour per account). The report carries the PMFBY helpline, the 72-hour rule for field-level causes and a satellite before/after block when stored views exist |
| Farmer groups | Organiser (role `organisation_admin` or `admin`, recent sign-in): `POST/GET /admin/groups`, `GET /admin/groups/{id}/dashboard` (at most 400 fields). Farmer: `GET /groups/lookup?code=`, `POST /groups/join` (needs `organisation_sharing`; chosen `plot_ids`), `GET /groups/mine`; leaving is `DELETE /pilot-enrollments/{id}`. Code lookups 20/hour per account |
| Krishyak Verify | Organiser: `POST/GET /admin/verifications` (200/day), `GET /admin/verifications/{id}`. Farmer: `GET /verifications/lookup/{code}`, `POST /verifications/{code}/accept` with one `plot_id` (needs `location_processing` and `satellite_processing`), `GET /verifications/mine`, `DELETE /verifications/{id}` to withdraw. Verdicts: `consistent`, `needs_review`, `too_early`, `not_enough_evidence`, each with reasons and fixed limits |
| Voice assistant | `POST /assistant/ask` with `question` (≤500 characters), `language`, optional owned `plot_id` and up to six earlier `history` turns. Requires `speech_processing` consent; returns `answer`, one `action` (`scan`, `market`, `weather`, `farm`, `note`, `benefits`, `none`), the record groups it was grounded on and `retention: not_stored`. Limited per farmer (30/hour, 120/day), per IP (10/minute) and globally (`SARVAM_CHAT_DAILY`) |

Mutations require the exact allowed `Origin`, cookies and `X-CSRF-Token` from
verification/bootstrap. Tokens stay in cookies/memory, never browser storage.
`GET /auth/session` can bootstrap a valid refresh session; it does not rotate or
extend it. POST refresh rotates credentials and preserves the original refresh
deadline and actual OTP authentication time. Institutional operations require
OTP authentication within ten minutes.

Collections default to 20 rows and generally support `limit` ≤100 and bounded
`offset`. Writes use owner/resource-scoped operation UUIDs; replaying changed
content produces 409. Edits require the current revision, also yielding 409 on
conflict. Unauthorized resource IDs return 404. Main-app errors contain
`error.code/message/retryable/request_id`; 401/403/404/409/422/429/503 are meaningful
states. Rate limits supply `Retry-After`. Never retry a changed mutation silently.

Mutation bodies other than photo/dictation uploads are bounded at 64 KiB. Photo API payloads are bounded
at 9 MiB including multipart framing; decoded input is ≤8 MiB, ≤20 MP and ≤8192
pixels per dimension. The frontend uses a stricter 4 MB input limit for the
current serverless gateway. Account export streams metadata; private photo
bytes use the authenticated download endpoint.

Private dictation accepts WAV multipart uploads only, with a 9 MiB body limit
including framing and a validated recording of at most 30 seconds. Browser
recordings are converted into mono PCM WAV before submission. Synthesis accepts
1 to 2,500 text characters and a selected supported language. Both require
authentication, CSRF and speech-processing consent, use distributed user/IP/global
budgets and recheck consent after provider work. Capability metadata distinguishes
actual configured TTS languages from documented STT support and discloses the
120-second transient TTS cache. Unavailable speech remains unavailable; there is
no unrelated-language or automatic paid-provider retry. Hosted legacy `/speech/`
routes return 410. A `/status` session-cookie hint is untrusted and grants no
account access.

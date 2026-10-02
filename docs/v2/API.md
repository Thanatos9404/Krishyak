# Private API

The generated OpenAPI contract at `/docs` is authoritative for field names and
schemas. Private routes use `/api/v2`. Existing public planning routes retain
their original paths. All private responses are `Cache-Control: no-store`.

| Resource | Routes |
|---|---|
| Configuration | `GET /status` (configuration only, not live provider verification) |
| Authentication | `POST /auth/request-otp`, `/auth/verify-otp`, `/auth/refresh`, `/auth/logout`; `GET /auth/session` |
| Account | `GET/PATCH/DELETE /me`, `GET /me/export` |
| Consent | `GET/POST /consents` |
| Farm | `GET/POST /farms`, `PATCH/DELETE /farms/{id}` |
| Plot | `GET/POST /plots`, `PUT/DELETE /plots/{id}` |
| Crop cycle | `GET/POST /plots/{id}/crop-cycles`, `PUT/DELETE /crop-cycles/{id}` |
| Evidence | `POST /plots/{id}/observations`; `GET /plots/{id}/today`, `/timeline` |
| Soil/weather | `GET/POST /plots/{id}/soil`; `GET /plots/{id}/weather`, `POST /plots/{id}/weather/refresh` |
| Satellite | `GET /plots/{id}/remote-sensing`, `POST .../refresh`, `POST .../preview` |
| Crop photo | `POST/GET /disease-scans`, `GET /disease-scans/{id}/image`, `DELETE /disease-scans/{id}` |
| Feedback/review | `POST /feedback`, `GET /review-queue`, `POST /review-queue/{id}`, `GET /review-queue/{id}/image` |
| Institutions | `/admin/pilots`, `/admin/pilots/{id}/report`, `/admin/model-monitoring` |
| Enrollment | `/pilot-enrollments`, `/pilot-enrollments/{id}` |
| Notices/catalog | `/notifications`, `/notifications/{id}/acknowledge`, `/benefits/catalog` |

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

Non-photo mutation bodies are bounded at 64 KiB. Photo API payloads are bounded
at 9 MiB including multipart framing; decoded input is ≤8 MiB, ≤20 MP and ≤8192
pixels per dimension. The frontend uses a stricter 4 MB input limit for the
current serverless gateway. Account export streams metadata; private photo
bytes use the authenticated download endpoint.

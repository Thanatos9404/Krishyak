# Security controls and operations

V2 uses opaque random access/refresh credentials stored as HMAC-SHA256 digests,
revocation, fixed refresh deadlines and double-submit CSRF bound to server state
and exact Origin. Deployed cookies are Secure, HttpOnly where appropriate,
SameSite=Lax and scoped to `/api/v2`. No JWT, OTP or token enters IndexedDB.
Privileged operations need a role plus authentication within ten minutes;
refresh does not extend that privilege window.
Vercel/Render host markers enforce deployment protections even if `ENVIRONMENT`
is mistakenly set to development; synthetic OTP cannot be enabled by that
misconfiguration. The former unauthenticated personal-data routes were removed.

## Passkeys and recovery

Passkeys use WebAuthn with user verification required and discoverable
credentials. The relying party ID and expected origin are the exact browser
origin from the CORS allowlist, so a credential cannot be replayed on another
host. Challenges are single use, origin-bound and expire after five minutes;
sign counters are checked to detect cloned authenticators. Recovery codes carry
100 bits of entropy, are stored only as HMAC digests, rotate on every use and
are rate limited per address (5/hour) and globally. Adding or removing a device
or rotating the code needs sign-in within the last fifteen minutes, and the last
sign-in method cannot be removed. A mobile number entered at passkey sign-up is
an unverified contact detail, never an identity or uniqueness key.

## Provider credential protection

Every path that spends a provider credential is budgeted in Redis before the
provider is called, across all serverless instances:

| Provider | Limits |
|---|---|
| Copernicus (satellite) | per account 6/minute and 60/day; global 300/day and 9,000 per 30 days (below the free monthly allowance); preview and catalog calls are charged by provider requests made. Public `/remote-sensing/*` processing routes require a signed-in account when deployed. |
| Sarvam (speech) | signed-in and consented only; per account, per address and global daily request/second/character budgets |
| Sarvam (voice assistant) | signed-in and consented only; 30/hour and 120/day per account, 10/minute per address, global `SARVAM_CHAT_DAILY` (default 3,000/day); 500-character questions, six-turn history, 30-second bound, 256 KB response cap; the system prompt forbids chemical names and doses and treats the farmer's words as a question, never as instructions |
| data.gov.in (mandi) | public prices: 30/minute per address, provider refresh at most every 3 hours per scope, 2,000 provider calls/day |
| Open-Meteo (weather) | accounts: 6/hour per account, 4,000/day global; public routes: 4,000/day global |
| Photos | 10/hour per account, 2,000/day global, 9 MB request bound, resized on device |
| Sign-up/sign-in | per address limits on passkey registration, verification, recovery and OTP, plus global caps |
| Public API | 60/minute and 1,000/day per address in Redis; model and simulation routes 10/minute |

The frontend proxy sends the farmer's address in a two-minute HMAC-signed header
(`KRISHYAK_PROXY_SECRET`); the API ignores it unless the signature and
timestamp verify, and otherwise uses only platform-set headers, so callers cannot
choose their own quota bucket. The scheduled worker endpoint returns 404 unless
`Authorization: Bearer $CRON_SECRET` matches (constant-time comparison).

Redis atomically counts HMAC-pseudonymized usage identities. Deployment fails
closed on unavailable Redis; memory limits are development-only. OTP challenge
expiry, attempts, issuance locks, consumed-code replay and account status are
checked server-side. Quotas do not replace provider billing caps or monitoring.

Bounded strict schemas reject unknown owner/role fields, nonfinite measurements,
invalid geometry and oversized bodies/images. Pillow decoding rejects spoofed,
corrupt, animated and excessive-dimension images; output is normalized JPEG with
EXIF removed. Objects use random private keys and owner-authorized downloads. The staging
private Vercel Blob store was verified to refuse unauthenticated reads (403); an
S3 bucket policy must likewise deny public access.

Frontend deployment has CSP, HSTS, nosniff, frame denial, referrer and permission
headers. Inline styles are permitted for React/maps; scripts remain self-only.
The CSP allows the existing API, optional map/weather/geocoder origins. A custom
map/API origin needs an explicitly reviewed allowlist update. Local preview
uses the same headers so browser tests catch policy regressions. V2 API responses
include no-store, nosniff, no-referrer, frame denial and restrictive API CSP;
deployed responses add HSTS.

Logs omit private request bodies, mobiles, geometry, cookies and provider error
bodies; resource UUIDs are masked. Request IDs are bounded ASCII. Review audit,
worker heartbeat, failed jobs and object cleanup dead letters. Credentials stay
in a secret manager/ignored env, never frontend vars or logs. Rotate auth secrets
to revoke existing sessions; rotate provider keys independently.

CI pins action commits, uses read-only repository permissions, scans runtime
dependencies and v2 code, and retains only synthetic failure artifacts for seven
days. See [threat model](THREAT_MODEL.md), [testing](TESTING.md) and
[privacy](PRIVACY.md). Independent penetration testing has not been performed.

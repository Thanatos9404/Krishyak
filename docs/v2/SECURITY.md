# Security controls and operations

V2 uses opaque random access/refresh credentials stored as HMAC-SHA256 digests,
revocation, fixed refresh deadlines and double-submit CSRF bound to server state
and exact Origin. Deployed cookies are Secure, HttpOnly where appropriate,
SameSite=Lax and scoped to `/api/v2`. No JWT, OTP or token enters IndexedDB.
Privileged operations need a role plus OTP authentication within ten minutes;
refresh does not extend that privilege window.
Vercel/Render host markers enforce deployment protections even if `ENVIRONMENT`
is mistakenly set to development; legacy personal routes and synthetic OTP cannot
be reopened by that misconfiguration.

Redis atomically counts HMAC-pseudonymized usage identities. Deployment fails
closed on unavailable Redis; memory limits are development-only. OTP challenge
expiry, attempts, issuance locks, consumed-code replay and account status are
checked server-side. Quotas do not replace provider billing caps or monitoring.

Bounded strict schemas reject unknown owner/role fields, nonfinite measurements,
invalid geometry and oversized bodies/images. Pillow decoding rejects spoofed,
corrupt, animated and excessive-dimension images; output is normalized JPEG with
EXIF removed. Objects use random private keys and owner-authorized downloads.
Operator bucket policy must deny public access; IAM should limit bucket/prefix
access and encrypt storage/backups. Tests do not certify a real bucket policy.

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

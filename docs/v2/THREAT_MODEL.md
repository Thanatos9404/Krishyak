# Threat model

Assets: phone identity, field geometry, photos, consent history, outcomes,
provider secrets, privileged corrections and durable storage. Trust boundaries:
browser/device, API, database/Redis, private object storage, worker and providers.

| Threat | Control | Residual risk |
|---|---|---|
| Cross-owner UUID access | Session-derived ownership joins and two-owner tests | Application/query regression needs continued CI review |
| Session theft/CSRF | Hashed rotating cookies, Origin/CSRF, expiry/revocation | Compromised device/XSS can act in a current session |
| OTP guessing/spam | Attempts/expiry/replay locks and distributed limits | SIM swap/provider account takeover and provider cost abuse |
| File bombs/path traversal | Decode/pixel/size limits, re-encode, private UUID keys | Decoder vulnerabilities require patched dependencies |
| Stale field/permission race | Farmer lock order, revision and post-provider consent checks | External provider processing already sent cannot be recalled |
| Offline leakage | Explicit owner cache, TTL, logout clearing, late-write guard | Device storage is not an encrypted vault; shared unlocked devices remain risky |
| Paid provider exhaustion | Disabled absent keys, bounded requests and scheduler | Process-local satellite caps require one worker and provider-side budget limits |
| Misleading farm advice | Provenance, unavailable states, no automatic treatment/health score | Heuristics and external forecasts need agronomic validation |
| Insider misuse | Role/fresh authentication, consented review, scoped cohorts, audit | Operator database access requires organizational controls |
| Data loss | Transactional storage, volumes, durable jobs, restore drill | Production backup frequency/off-site storage must be provisioned |

No claim of formal compliance, penetration-test certification, government
authorization or clinical/agronomic safety follows from passing software tests.
The operator must establish incident contacts, access reviews and provider
contracts before collecting real pilot data.

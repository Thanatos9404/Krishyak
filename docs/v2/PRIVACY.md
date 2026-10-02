# Privacy and retention

Account processing stores mobile verification and optional profile/place details.
Exact location, satellite processing, agronomic analysis, model improvement,
pilot research and future government integration have distinct versioned purposes.
Research and pilot opt-ins are optional. Government consent grants no API access.
Withdrawal records history and immediately restricts new processing/review.

Private plot geometry is sent only to a configured satellite provider for the
requested purpose. Weather sends a centroid rounded to 0.01 degrees, not a phone
or polygon. Opening the optional basemap contacts its provider and may reveal
IP/requested area. Crop uploads are decoded, resized and stripped of EXIF.
No farmer data is sent to a generative provider by the v2 Today workflow.

| Data | Implemented retention/control |
|---|---|
| Private photos | Default 365 days; configurable 1–3650; worker queues object deletion |
| Audit events | Default 180 days; configurable 30–3650 |
| OTP challenges | Expire in five minutes; cleanup removes records older than expiry plus one day |
| Sessions | Thirty-minute access; fixed seven-day refresh by default; revocable/cleaned after expiry |
| Optional device snapshots | Seven-day TTL on read; manual disable/logout clears owner storage |
| Pending notes | Until successfully sent or explicitly discarded; never silently expired |
| Farm/cycle/evidence | Until owner deletion or separately reviewed operator retention policy |
| Backups/provider records | Operator/provider policy; application deletion does not instantly erase these |

Export streams owned metadata and provenance; authenticated image download
supplies photo bytes. Account deletion cascades domain rows and queues durable
object cleanup. Failed cleanup after ten attempts is visible in the queue and
requires operator remediation. Backup restoration must reapply deletion requests.

The UI includes an editable v2 privacy/terms supplement. A responsible operator,
contact/grievance channel, jurisdiction-specific legal review and approved
provider terms remain external release gates. This document is an engineering
description, not a claim of legal compliance. No Aadhaar, bank account, land
registry credential, OTP email or real farmer record was collected for tests.

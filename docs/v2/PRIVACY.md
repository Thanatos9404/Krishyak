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
Today does not submit farmer records to a chat or translation model. Voice mode
does, only after the farmer allows voice help (the `speech_processing`
consent): the question, up to six earlier turns and a compact summary of that
farmer's own records (name, state/district/village, the selected field's name
and area, crop and sowing date, the last 24 hours' stored weather, up to three
stored mandi quotes and the latest photo-check label) go to Sarvam's
`sarvam-105b` model in India. No question, answer or audio is stored by
Krishyak, and withdrawing the consent stops it, including mid-request. Optional
read-aloud can send selected advice text to a configured speech provider only
with explicit speech consent. Dictation sends a bounded recording for
transcription; the farmer reviews the draft before applying it to a form.

| Data | Implemented retention/control |
|---|---|
| Private photos | Default 365 days; configurable 1–3650; worker queues object deletion |
| Audit events | Default 180 days; configurable 30–3650 |
| OTP challenges | Expire in five minutes; cleanup removes records older than expiry plus one day |
| Sessions | Thirty-minute access; fixed seven-day refresh by default; revocable/cleaned after expiry |
| Optional device snapshots | Seven-day TTL on read; manual disable/logout clears owner storage |
| Pending notes | Until successfully sent or explicitly discarded; never silently expired |
| Farm/cycle/evidence | Until owner deletion or separately reviewed operator retention policy |
| Private dictation | Audio/transcript held during processing only; no disk or database persistence; recording at most 30 seconds |
| Server read-aloud | Selected text used during synthesis; owner-scoped audio cache in memory for at most 120 seconds, globally capped at 32 entries/8 MiB; no disk persistence |
| Backups/provider records | Operator/provider policy; application deletion does not instantly erase these |

Changing language, field, account, permission, page visibility or online state
cancels frontend speech activity. Private requests recheck authorization and
consent after provider work before returning a result. This restricts new access;
it does not claim immediate deletion from a provider that already received data.

Export streams owned metadata and provenance; authenticated image download
supplies photo bytes. Account deletion cascades domain rows and queues durable
object cleanup. Failed cleanup after ten attempts is visible in the queue and
requires operator remediation. Backup restoration must reapply deletion requests.

The UI includes an editable v2 privacy/terms supplement. A responsible operator,
contact/grievance channel, jurisdiction-specific legal review and approved
provider terms remain external release gates. This document is an engineering
description, not a claim of legal compliance. No Aadhaar, bank account, land
registry credential, OTP email or real farmer record was collected for tests.

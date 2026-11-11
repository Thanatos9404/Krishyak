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
Krishyak, and withdrawing the consent stops it, including mid-request. Spoken farm setup sends the farmer's words to the same Sarvam model to fill a
draft; with location permission it sends the village, district and state
names (never the farmer's name) to OpenStreetMap Nominatim, and a point
rounded to 0.01° to ISRIC SoilGrids. The draft is not stored until the farmer
saves it. Optional
read-aloud can send selected advice text to a configured speech provider only
with explicit speech consent. Dictation sends a bounded recording for
transcription; the farmer reviews the draft before applying it to a form.

Krishyak Live sends the spoken question and the same compact record summary
as voice mode to Sarvam. The camera frame stays on Krishyak's own server: it
is classified in memory by the leaf model, only the resulting label is added
to the prompt, and the frame is discarded when the request ends.

Pest Radar uses two separate permissions. `location_processing` lets a
farmer receive alerts for a field. `community_alerts` (off until the farmer
turns it on) lets that farmer's photo-check results count towards alerts for
others. An alert needs at least three different other accounts within 10 km
in 14 days, shows a rounded-down count (3, 5 or 10 "or more") and never a
name, village, distance or direction. Withdrawing the permission removes
that farmer's results from the next calculation.

Joining a farmer group needs `organisation_sharing` and an explicit choice
of fields. The organiser sees the farmer's name and village and, for the
chosen fields, name, crop, area, sowing date, latest photo-check result,
satellite greenness, nearby disease alerts and loss reports. Phone number,
field outline or exact location, photographs, notes, costs and sales are
never shared. Leaving the group or withdrawing the permission stops sharing
at once.

A Krishyak Verify report is created only when the farmer enters the code,
reads the same two lists and agrees for one field. It contains name, village
and district, the field's crop, sowing date, area and location rounded to
about 1 km, satellite greenness since sowing and the number of leaf photos
checked there. The farmer can withdraw it; the requester then sees only
that it was withdrawn. Reports are included in the account export.

Claim Kit photos are stored like other private photos, with the capture
time and the phone's GPS position and accuracy (this needs
`location_processing`). They are never used as leaf checks, never count
towards Pest Radar and are deleted with the report or the account. A group
organiser sees that a loss report exists and its cause, not its photos.

| Data | Implemented retention/control |
|---|---|
| Private photos | Default 365 days; configurable 1–3650; worker queues object deletion |
| Audit events | Default 180 days; configurable 30–3650 |
| OTP challenges | Expire in five minutes; cleanup removes records older than expiry plus one day |
| Sessions | Thirty-minute access; fixed seven-day refresh by default; revocable/cleaned after expiry |
| Optional device snapshots | Seven-day TTL on read; manual disable/logout clears owner storage |
| Pending notes | Until successfully sent or explicitly discarded; never silently expired |
| Leaf photos saved offline | At most five, in this browser's IndexedDB only, after the farmer taps "Save photo and check it later"; removed once checked, on sign-out, on account deletion and when another account signs in on the same phone |
| Loss reports and claim photos | Until the farmer deletes the report or the account; photos follow the private-photo retention above |
| Group membership and Verify reports | Until the farmer leaves, withdraws or deletes the account |
| Krishyak Live frames | Never stored; held in memory for one request |
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

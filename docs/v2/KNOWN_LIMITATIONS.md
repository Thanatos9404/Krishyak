# Verified boundaries and external release gates

Engineering implemented here does not establish full commercial production or
field validation. Missing credentials are explicit unavailable states, not mock
successes. The owner permitted leaving keys blank; no paid service was enabled.

| Area | Current boundary |
|---|---|
| Public deployment | Existing main-branch app remains live; new persistent v2 services are not provisioned there |
| OTP/private storage | Production adapters implemented; real Verify delivery and bucket policy/storage smoke not run |
| Satellite | Quality/geometry/worker fixtures pass; real CDSE credentials/access and scientific validation absent |
| Weather | Free public smoke performed; forecasts are model output, commercial license/provider contract unverified |
| Government | Public information only; no authorized Aadhaar/bank/land/Farmer Registry/AgriStack/Krishi-DSS access |
| ML | Active release retained; external PlantDoc accuracy 57.21%; field calibration/domain generalization not established |
| Advice/economics | Draft heuristics and persistence/Monte Carlo estimates; no pesticide dose or guaranteed outcome |
| Pilot | Infrastructure/records present; real farmer recruitment, consent, inspections and impact study not performed |
| Languages | Legacy 23 packs retained; v2 English/Hindi core strings, other languages explicit English fallback; new forms need native review |
| Devices/accessibility | Automated browser/Axe/viewport testing; physical Android/iOS and human accessibility review absent |
| Offline | Device cache is not encrypted; offline logout revokes server session only on reconnection; photos remain online |
| Scale | Bounded local read test, not high-volume production/soak/image throughput certification |
| Operations | Disposable schema backup/restore tested; no production off-site backup, incident contact or SLA provisioned |
| Sensors | Unsafe legacy personal endpoints disabled in deployment; vendor-authenticated owner-device ingestion unverified |
| Legal/data | Operator identity/contact, provider licenses, dataset rights and agronomic/legal review require accountable human approval |

The remaining release gates require external resources, credentials, physical
devices, people or legal/agronomic authority. They cannot be completed by
fabricating responses or silently purchasing services. Review
[deployment](DEPLOYMENT.md) and [pilot protocol](PILOT_PLAN.md) before admitting
real farmers. Do not label this release government-approved or field-validated.

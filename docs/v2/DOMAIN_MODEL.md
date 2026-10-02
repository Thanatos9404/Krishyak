# Domain model

Ownership follows `Farmer → Farm → Plot → CropCycle / Observation`. UUIDs are
identifiers, never authorization. The session owner is checked in every private
resource query. A farmer cannot supply a role or another owner through an input.

| Record | Meaning |
|---|---|
| Farmer | Verified mobile account, preferred language, optional place/name, role/status |
| Farm | Named owner resource; revision guards edits |
| Plot | Optional EPSG:4326 polygon; manual or computed area, irrigation method, revision |
| CropCycle | Farmer-entered crop/variety, dates, growth stage, season/status |
| Observation | Typed evidence, UTC observation/retrieval dates, units, source, payload/provenance |
| ImageAsset | Private sanitized JPEG, SHA-256, stored model result, optional research-consent reference |
| Feedback | Farmer yes/no/unsure or audited expert correction using active labels |
| Consent | Purpose/version/categories/surface, grant and withdrawal times |
| Job | Durable bounded lease/retry state tied to a plot boundary revision |
| Notification | Owner-only in-app event and acknowledgement |
| PilotCohort / Enrollment | Institution-owned cohort and consented selected fields |
| AuthChallenge / Session | Expiring verification and hashed revocable rotating credentials |
| AuditLog | Bounded operational event without raw personal payloads |
| ObjectDeletion | Durable cleanup that survives deletion of the account |
| WorkerHeartbeat | Last worker loop timestamp |

No field identity, ownership, soil measurement or outcome is independently
verified merely because it is saved. Boundary edits invalidate old satellite
evidence for current-field conclusions and cancel superseded jobs. Historical
rows preserve their original provenance.

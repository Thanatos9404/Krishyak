# Crop identities for the India pilot

The farm catalog contains 62 stable crop IDs. The backend catalog and frontend
copy are checked for identical contents by `backend/test_crop_catalog.py`.
Indian pilot priorities precede other record crops. All prior planning crop
names remain accepted, with their exact provider names preserved.

`crop_id` is the language-independent identity. Localized labels are display
text and are never submitted as record identity. `Gram` and `Chickpea` share
`chickpea`; `Tur` and `Arhar` share `pigeon_pea`. Their historical English names
remain unchanged because the existing planning calibrations use those names.
New clients can submit only `crop_id`; old clients can continue submitting
`crop`. A mismatched ID/name or an unknown/localized identity is rejected.

Migration `v2_0005` adds a nullable column and backfills known historical
English names using frozen aliases. It does not rewrite old names or delete
unknown records. New and updated records always receive a validated ID.
Exports include the new column through the existing authorized serializer.
Overlap checks, ownership checks, operation replay and optimistic revision
checks remain in force.

Farm creation/editing, Today, crop summaries, Scan and Market use the same
catalog. The picker searches the selected language, English labels and provider
aliases; changing language preserves a chosen ID. Crop search and language
selection use static bundles without runtime provider translation calls.

Record support is separate from classifier and market availability. Scan
reads the actual model's label metadata. Grapes maps to the classifier's
`grape` alias and Capsicum maps to `pepper`; Chilli is not mapped to bell
pepper. A record crop absent from the model remains unsupported for photos.
The catalog does not promise a dated market result or establish field accuracy.
The six additional photo-label crops can be recorded without pretending that
they have planning calibrations.

All ten pilot packs include crop labels and picker explanations. Two bounded
incremental Sarvam runs used 53 requests and 19,407 submitted characters from
existing credits. No purchases or billing changes were made. Structural pack
validation passes; native-speaker semantic approval remains outstanding.

Local validation passes 324 frontend unit tests, formatting and the production
build. Backend verification passes 242 tests on the dedicated PostGIS test
database, with two existing environment/provider skips. Migration upgrade,
downgrade, upgrade and schema comparison pass, along with a disposable empty
database dump/restore drill. A read-only historical check found 65 known crop
records and no ID/name mismatches after backfill.

The complete production browser suite passes 37 checks across Chromium,
Firefox and WebKit with two existing CDP-only performance skips. This includes
native Hindi/Urdu crop search and stable form identity, record creation/export,
revision checks, unsupported photo handling, real offline recovery and
accessibility. The current ten static packs have 830 strings after the old
demo field names were retired without translation requests.
See [CI reliability and fixture cleanup](CI_RELIABILITY.md) for the startup,
accessible-label and offline-restoration regressions addressed during verification.

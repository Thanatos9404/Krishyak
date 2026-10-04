# Official India location identities

The 4 October 2026 snapshot was obtained anonymously from the Government of
India Local Government Directory (LGD) web service. It contains the service's
36 states/UTs and 784 districts. These are LGD codes, distinct from Census 2011
codes, PIN codes and farmer-entered addresses. No paid service or account was
needed. The OGD catalogue lists this directory under the Ministry of Panchayati
Raj: [official catalogue](https://data.gov.in/catalog/local-government-directory-lgd).

`backend/v2/india_locations.meta.json` records the retrieval timestamp, source
snapshot hash, published catalogue hash and per-state district response hashes.
The captured public source rows are preserved in
`data/reference/india/lgd_2026-10-04.json`. The publication command is
`python scripts/build_india_locations.py data/reference/india/lgd_2026-10-04.json`;
it performs no provider requests and refuses to alter a frozen migration catalogue.
The frontend catalogue is checked for semantic equality with the backend copy.
The data is a dated provider snapshot. It does not establish that a farmer lives
at an address, owns a field or meets a scheme's eligibility rules. Changes in
administrative boundaries or names require review and a new directory snapshot.

Profiles can store `state_code`, `district_code` and canonical names. Districts
are always resolved within the selected state; equal names across states are
not merged. Matching ignores case, surrounding/repeated spaces and Unicode
compatibility differences. Official local-script names and the explicit
`Rajsthan`/`राजस्थान` aliases resolve to the same Rajasthan code. Unknown codes,
mismatched code/name pairs and a district from another state are rejected.
The location is optional. Village and tehsil remain bounded farmer-entered
text; an optional six-digit PIN is format-checked. No village/tehsil/PIN mapping
is inferred or presented as verified.

Migration `v2_0006` adds nullable columns and uses a separately frozen catalogue
to backfill recognizable historical names. Reported names are preserved.
Unknown states retain null codes; known states with unknown or cross-state
district names receive only a state code. The backfill streams rows in bounded
batches. The private export includes location codes through its existing
authorized profile serialization.

Account details and market filters now use the same searchable state/UT and
district picker. Choices carry LGD integer codes, districts are filtered by
their parent state and changing/clearing a state clears the old district. Search
accepts canonical English, the snapshot's local-script names, translated display
names and the explicit Rajasthan aliases. A selected choice remains visible
while searching or changing language. Market requests retain canonical English
provider names. Tehsil, village and PIN remain optional reported inputs in account
details; the directory does not establish a PIN-to-location mapping.

Historical unrecognized names are displayed as preserved saved choices. They
are replaced only by an explicit selection or clear action. Saving a preferred
name does not submit untouched location fields. The backend PATCH operation now
updates only supplied fields, so omitted location, PIN and language preferences
are retained; explicit location changes still undergo canonical validation.

All directory display names are included in the static workspace source and ten
pilot packs. Each pack has 1,654 strings with provider/source/glossary hashes and
an explicit machine-translation disclosure. This generation used 440 Sarvam
requests and 188,928 submitted characters under hard caps of 750 requests and
400,000 characters, using existing access. No purchase, subscription upgrade or
runtime translation was introduced. These translated display names are not
government-certified translations. Native-speaker semantic review and the
ordered first-run onboarding flow remain outstanding.

Validation includes all 784 code/parent pairs, actual repeated district names,
Hindi/Marathi aliases, type/PIN constraints, code/name mismatch rejection,
owner-isolated profile updates and export. The full backend suite passes 250
tests with two existing environment/provider skips. Six real historical cases pass against the
guarded empty `krishyak_v2_migration_test` database, preserving names and unknown
codes. Upgrade/downgrade/upgrade, schema comparison and a disposable empty
database dump/restore pass. These are local database results, not production
provider, residence or language-review verification.

Frontend tests cover every district/parent lookup, native search, persistent
identities during language changes, legacy-name preservation, state-change
clearing, account payloads and canonical market filters. The current frontend
suite passes 331 tests across 59 suites; lint, formatting and production build
pass. All ten packs pass offline placeholder, script and provenance validation.
Real Hindi/Urdu browser assertions check authenticated account save/reload,
integer-code/canonical-name payloads, private export and Axe accessibility.
The first browser run caught WebKit market overflow at 320px; the fix constrains
grid track and selector minimum widths, retaining the original strict assertion.
The final full local suite passes all 37 production browser checks across
Chromium, Firefox and WebKit, with two existing CDP-only performance skips and
zero failures. All three newly generated fields and their empty generated farms
are removed by the guarded runner; the local photo deletion queue is drained.
No demo fields are stored in authenticated accounts. Exact-pushed-commit GitHub
quality results are linked from the pull request after CI finishes.

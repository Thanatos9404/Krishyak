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

The canonical backend contract is implemented. Structured account, market and
onboarding selectors and complete translated display names remain to be wired
and verified before the location requirements can be considered complete.

Validation includes all 784 code/parent pairs, actual repeated district names,
Hindi/Marathi aliases, type/PIN constraints, code/name mismatch rejection,
owner-isolated profile updates and export. The full backend suite passes 250
tests with two existing environment/provider skips. Six real historical cases pass against the
guarded empty `krishyak_v2_migration_test` database, preserving names and unknown
codes. Upgrade/downgrade/upgrade, schema comparison and a disposable empty
database dump/restore pass. These are local database results, not production
provider, residence or language-review verification.

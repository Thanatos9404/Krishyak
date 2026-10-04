# Frontend and browser CI reliability

The push itself succeeded. The latest failed GitHub jobs stopped before browser
execution because API readiness was pinned to `v2_0004` after the crop migration
introduced `v2_0005`. Readiness now obtains the head from the migration files
shipped with the release. A previous schema still returns 503. The PostGIS,
Redis and deployed-worker checks remain required. A real database regression
test exercises current schema, previous schema and restoration to current head.

The earlier WebKit planning accessibility failure came from chart legend text
inheriting low-contrast series colours. Legend labels now have a readable text
colour while the swatches retain each series colour.

The offline journey uses a real origin outage in WebKit and retains reload,
cached evidence, queued write, recovery, exactly-once display and private logout
assertions. Its evidence-restoration assertion now allows the existing bounded
20-second API failure plus IndexedDB restoration. Rendering the page heading
does not mean that asynchronous evidence restoration has finished. No browser
failure is hidden with retries or new skips.

The crop picker label is explicitly associated with its sibling select instead
of wrapping every option. Unit and Hindi/Urdu browser assertions check the exact
label and stable `crop_id` form value. API/frontend logs are preserved in failed
GitHub jobs to make startup failures diagnosable.

Local repeat runs can exhaust the existing development OTP quota. CI uses fresh
isolated services. Local checks use a separate test Redis database and retain
the deployed rate-limit implementation and limits.

## Generated local fixture cleanup

The public demo has one field named exactly `demo field`. It is separate from
authenticated fields and makes no account-record API writes. Browser tests check
the name, single-field count and absence of demo API requests.

Use the backend virtualenv to run `scripts/run_local_product_e2e.py` after starting
the isolated local API and production frontend preview. It runs Playwright and
removes generated fields in a `finally` block, including after failed tests.
Additional arguments are passed directly to Playwright.

The cleanup helper refuses any database except loopback port 55432,
`krishyak_v2_e2e`, with development/test environment, the development OTP provider
and the three whitelisted test identities. It selects only exact timestamp-based
generated field names owned by those identities. Other fields are preserved;
empty generated farms are removed and private object deletion is queued through
the existing durable workflow. A default invocation only reports the selection;
`--apply` performs it. This helper is not a production cleanup tool.

## Verification

Production build, frontend formatting and 324 unit tests pass locally. Backend
verification passes 242 tests with two existing environment/provider skips.
Ten static pilot language packs pass structural validation with 830 strings
after retiring the old demo names, using no additional translation requests.
The complete production browser suite passes 37 checks across Chromium,
Firefox and WebKit, with two existing CDP-only performance skips and zero
failures. The public crawl passes nine SSR pages and 20 internal resources with
no orphan pages. Exact-commit GitHub results are linked from the pull request
after the pushed revision finishes.

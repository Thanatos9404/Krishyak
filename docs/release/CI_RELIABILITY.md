# Frontend and browser CI reliability

The Git pushes succeeded; quality jobs exposed application and browser failures.
An earlier job stopped before browser execution because API readiness was pinned
to `v2_0004` after the crop migration
introduced `v2_0005`. Readiness now obtains the head from the migration files
shipped with the release. A previous schema still returns 503. The PostGIS,
Redis and deployed-worker checks remain required. A real database regression
test exercises current schema, previous schema and restoration to current head.

All three jobs pin `ubuntu-24.04`, the OS family used by the verified green
runs (the foundation job reports Ubuntu 24.04.5). GitHub's run annotations
announce a later `ubuntu-latest` transition to Ubuntu 26. Keeping the tested
family explicit avoids silently changing WebKit's system dependencies during
that transition. The supported image still receives GitHub's updates; a future
OS-family upgrade should be verified with the same browser and container gates.
See GitHub's [official runner migration announcement](https://github.com/actions/runner-images/issues/14748).

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

Production build, frontend formatting and 331 unit tests pass locally. Backend
verification runs 251 tests with two existing environment/provider skips.
Ten static pilot language packs pass structural validation with 1,654 strings,
including official-directory display names, disclosed as machine translations.
The complete production browser suite passes 37 checks across Linux Chromium,
Firefox and WebKit in the version-matched official container, with two existing
CDP-only performance skips and zero
failures. The public crawl passes nine SSR pages and 20 internal resources with
no orphan pages. Exact-commit GitHub results are linked from the pull request
after the pushed revision finishes.

The location follow-up caught WebKit Market overflow at 320px. Grid tracks and
selector minimum widths now permit the layout to shrink to that viewport. The
same strict overflow assertion passes all nine routes at all nine widths.
Authenticated Hindi/Urdu assertions also check canonical location payloads,
saved integer IDs after reload, private export and account accessibility.

The next exact-head CI run exposed another native-select issue: a short saved
state name could hide overflow in repeat runs. On Ubuntu 24.04 WebKit, the empty
prompt produced a 352px document at a 320px viewport; the longest state/UT choice
produced 389px, while Rajasthan fit. CSS bounding boxes remained constrained,
but the platform select's internal rendering still enlarged the scroll area.
The controls now use the same explicit appearance/arrow treatment as the existing
field picker, retaining native select semantics, keyboard access and RTL arrow
placement. The route audit always clears the location and also checks the
longest state/UT choice, so saved fixture profiles cannot hide this regression.
Direct Linux measurements after the fix pass all 27 choice/viewport combinations.

The full Linux suite also exposed clock skew between the browser and API:
reported observation times only a fraction of a second ahead were rejected with
422. Observation validation now permits at most 30 seconds of device clock skew,
preserves the reported UTC timestamp and rejects naive or larger future times.
A frozen-clock regression checks the exact boundary, including 30 seconds plus
one microsecond. The browser journey now requires a successful observation POST
and a closed dialog before looking for the saved timeline entry; text still in
the unsaved textarea cannot satisfy that assertion.

## Matching Linux browser verification

The optional `V2_E2E_BROWSER_WS` setting connects Playwright tests to a browser
server. The guarded local runner permits only `ws://127.0.0.1:9333/`. Loopback
requests are forwarded to the existing isolated host test stack; the app remains
bound to loopback. The version-matched official image is
`mcr.microsoft.com/playwright:v1.63.0-noble`, based on Ubuntu 24.04, matching the
current package lock and CI OS family. It is used only for our local test app.
See the [official Playwright Docker guide](https://playwright.dev/docs/docker).

With the isolated API and frontend already running, start the browser server:

```powershell
docker run --rm --init --name krishyak-browser-ci --shm-size=1gb -p 127.0.0.1:9333:9333 --workdir /home/pwuser --user pwuser mcr.microsoft.com/playwright:v1.63.0-noble /bin/sh -c 'npx -y playwright@1.63.0 run-server --port 9333 --host 0.0.0.0'
```

In another terminal, run the existing cleanup wrapper:

```powershell
$env:V2_E2E_BROWSER_WS='ws://127.0.0.1:9333/'
backend\venv\Scripts\python.exe scripts/run_local_product_e2e.py
```

Stop that named browser container when finished. `--rm` removes it; the existing
app/database containers are not affected. Clear the optional environment setting
to return to ordinary host-browser testing. Keep the image/server and locked
Playwright package versions matched when upgrading.

# Offline behavior

The production service worker caches only the public shell, same-origin static
assets, manifest and icons. API responses, authentication and mutations are
network-only. Vite development does not register the worker. IndexedDB stores
owner-keyed private records only after an explicit device-cache opt-in.

While the phone is online the app quietly fetches the screens that work
with no signal (Home, picture guides, plant check, fields, More, settings),
so the service worker has their code even if the farmer never opened them.
The picture-guide library (`diseaseGuides.json`, generated from the server's
reviewed guidance by `scripts/sync_disease_guides.py`; a Jest test fails if
the two drift) is part of that code. `/app/guides` holds no personal data
and opens without an account, so it also works on a cold start offline.

A leaf photo can be saved with no signal: "Save photo and check it later"
stores the resized photo, field and crop in a separate IndexedDB database
keyed by account (at most five). Nothing is uploaded until the farmer is
online and taps "Check saved photos now". The queue ID is the upload's
operation ID, so a retry cannot create a second check; a photo the server
rejects for good (404, 409, 422) is dropped and any other failure keeps it.
Permission is enforced by the server at upload, because permissions cannot
be read offline. With no signal the crop list comes from the bundled guide
library.

Snapshots include field selection, Today, timeline, cycles and satellite/context
metadata with saved times. Seven-day-old snapshots are discarded on read.
Missing/stale cached evidence remains labelled. Tokens and OTPs are never
cached, and photo bytes are kept only in the saved-photo queue above. Browser storage quota failures show an error instead of claiming a
note was saved.

Offline observation/outcome writes carry a client operation UUID; the queue
holds at most 100 records, each at most 10,000 serialized characters. Actual
API reachability, session and matching owner are checked before synchronization.
The app probes every ten seconds while visible with pending/offline work and
also on focus/reconnection. A 401 refreshes when permitted; a changed account,
revoked consent or 409 conflict leaves records reviewable, not overwritten.
Structural farm/plot/cycle edits require connection and server revision checks.

Logout clears private snapshots/outbox after explicit pending-loss confirmation,
blocks late background cache writes and broadcasts sign-out to other tabs.
Offline logout sets a non-authentication marker to revoke the cookie session on
reconnection/reload before sign-in. It cannot revoke an unreachable server
immediately. The written UI explains this limit.

Chromium/Firefox use offline network emulation in E2E. WebKit uses an actual
local-origin outage because [Playwright issue 42775](https://github.com/microsoft/playwright/issues/42775)
breaks service-worker navigation under its offline emulator. Both paths assert
full cached reload, selected field, queued write, recovery and cleared logout.
Physical Android/iOS and long-term device-storage usability remain unverified.

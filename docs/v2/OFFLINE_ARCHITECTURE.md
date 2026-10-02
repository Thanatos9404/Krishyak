# Offline behavior

The production service worker caches only the public shell, same-origin static
assets, manifest and icons. API responses, authentication and mutations are
network-only. Vite development does not register the worker. IndexedDB stores
owner-keyed private records only after an explicit device-cache opt-in.

Snapshots include field selection, Today, timeline, cycles and satellite/context
metadata with saved times. Seven-day-old snapshots are discarded on read.
Missing/stale cached evidence remains labelled. Photo bytes, tokens and OTPs are
not cached. Browser storage quota failures show an error instead of claiming a
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

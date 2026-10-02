# Cost and quota model

No paid accounts/resources, SMS, speech requests or government applications were
created or executed during implementation. Local Docker and existing public
repository workflows were used. Existing hosting is unchanged. A free farmer
interface does not imply that production infrastructure/providers are free.

| Driver | Accounting model and bound |
|---|---|
| OTP | Requested/checked verification events; 3 requests/mobile/10 min, 6/IP/10 min, 300 global/day |
| API | Redis atomic gateway budget 500/IP/min; server concurrency cap 16 |
| Photos | Clean object bytes × retained images; upload budget 10/owner/hour; 365-day default retention |
| Satellite | Up to 3 index jobs/selected plot/day; scheduler disabled, default 10 plots/day; 3 attempts/job |
| Weather | 2-hour stored cache, 6 refreshes/owner/hour; commercial provider terms unverified |
| Database | Row counts/size, indexed query latency, backup bytes and retained versions |
| Worker/storage | Runtime hours, private object GET/PUT/delete counts and egress |
| Speech | V2 installed local voice makes no provider request; existing Sarvam remains separately bounded |

Record actual provider units and invoices before filling currency totals. The
software does not infer costs from an unverified price schedule. Local read-load
measurements are not a cloud capacity estimate. Pilot model spreadsheet inputs
should include active farmers, plots, scans/day, clean average bytes, retention,
backup period, satellite clear/missing retries, SMS sends, API/worker uptime and
approved per-unit prices. INR/USD must be labelled and dated if conversion is used.

Operate one satellite worker while its provider-wide cache/caps are process-local.
Configure provider-side usage/billing ceilings and alerts before enabling keys;
application quotas cannot guarantee a zero invoice. Under the user's no-spend
instruction, all paid activation and upgrades remain off. Missing keys remain
blank in ignored environment configuration.

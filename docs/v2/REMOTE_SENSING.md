# Satellite evidence

The stored owner-authorized boundary drives CDSE Sentinel Hub Sentinel-2 L2A
requests. User-entered area cannot substitute for geometry. Both location and
satellite consent are required; the worker checks them before and after HTTP
processing. Missing credentials return unavailable; no zero-valued observation
or synthetic image is substituted.

NDVI uses `(B8−B4)/(B8+B4)` at 10 m. NDMI uses
`(B8−B11)/(B8+B11)` with mixed 10/20 m bands; NDRE uses
`(B8A−B5)/(B8A+B5)` at 20 m. SCL and dataMask remove unsuitable pixels.
At least 60% valid pixels are needed for a clear interval. Clouds, no scenes,
insufficient pixels and malformed responses remain explicit. Intervals may
combine acquisitions; exact contributing dates are not independently verified.

Jobs store derived means, valid fraction, interval dates, index/formula,
provider/processing version, boundary revision, retrieval time and limitations.
UUID-based interval deduplication avoids duplicate persisted observations.
Comparison uses the latest clear interval against the preceding four usable
equivalent intervals: median and `max(0.03, 2 × 1.4826 × MAD)`. This is an
uncalibrated statistical inspection trigger. A cloudy latest interval prevents
historical clear values from being promoted into a current alert.

Today can combine declining recent NDMI with a recent zero-rain forecast to
request moisture/irrigation inspection. It does not establish water stress,
disease, soil NPK, yield or an irrigation dose. Soil readings stay separately
reported with units/source/date. Map and private preview load on request.

Scheduling is opt-in and disabled by default. A database advisory lock enforces
a daily cap of 10 plots by default, configurable 1–50; each selected plot gets
NDVI/NDMI/NDRE jobs. Worker leases expire after five minutes, provider failures
retry at most three times, and stale boundary/consent results are discarded.
Provider cache/quota controls remain bounded per worker process; operate a
single satellite worker until shared provider-wide controls are introduced.

Live CDSE access is NOT VERIFIED without credentials. Fixture tests establish
software behavior, not scientific performance. Field validation must compare
quality/date/index behavior against independent imagery and consented inspections.
Primary reference: [CDSE statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html).

# Scientific limitations

Research date: 2026-09-30. This implements external observations, not a trained
satellite crop classifier or a validated Rajasthan advisory model.

| Layer | Formula | Nominal limiting band resolution |
|---|---|---|
| Natural color | RGB display stretch 2.5 × B04/B03/B02 | 10 m |
| NDVI | (B08 − B04)/(B08 + B04) | 10 m; mask 20 m |
| NDMI | (B08 − B11)/(B08 + B11) | 20 m |
| NDRE | (B8A − B05)/(B8A + B05) | 20 m |

Definitions: [official S2 bands and classification](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html),
[Sentinel Hub index scripts](https://custom-scripts.sentinel-hub.com/sentinel-2/).
Zero/near-zero denominators (≤1e-6) are masked. EVI/SAVI are deferred; no unused
indices are advertised. Negative index values are retained, not mapped to
disease. Negative/nonfinite input reflectances are excluded, preventing
unphysical ratios outside the normalized range from contaminating statistics.

SCL accepted: 4 vegetation, 5 bare soil. Excluded: 0 no data, 1 saturated/
defective, 2 dark pixels, 3 shadows, 6 water, 7 uncertain/low probability,
8/9 clouds, 10 cirrus, 11 snow/ice. This is conservative and may exclude
flooded rice and valid dark surfaces. SCL is not perfect ground truth.
Scene-wide cloud % is a catalog hint, never parcel clear-pixel quality.

Statistical intervals use mostRecent SIMPLE mosaicking. Different pixels can
come from different scenes in the interval; the time interval is **not** a
single acquisition. Exact contributing timestamps are not verified by this
release. Catalog dates are candidates only. Even one-day previews are labelled
day mosaics. [Official mosaicking/statistics semantics](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html).

Available-pixel counts exclude outside-field/no-data. Validity includes an
approximate nominal coverage safeguard using WGS84 geodesic area. 60% estimated
validity and 10 clear samples are engineering quality gates, not agronomic
health thresholds. Below either gate all index summary numbers are null.
No-data intervals remain gaps. A latest cloudy interval cannot be silently
replaced by an older clear interval and presented as current.

Trend requires the latest interval to be clear and four preceding clear
intervals. Baseline is their median; tolerance is max(0.03, 2×1.4826×MAD).
Increasing/stable/declining describes an index change only. Constants are
centralized in indices.py; the 0.03 floor is an unvalidated display/inspection
heuristic, **not** universal crop-health calibration. Normal phenology,
sowing, harvest, irrigation and residual atmosphere can cause these changes.

Color overlays show a fixed spectral ramp, not quantile disease zones. Very
small fields (<25 nominal 20 m pixels) show an explicit warning. There is no
sub-pixel detail, individual-leaf diagnosis, exact N/P/K, named pest detection,
soil moisture percentage or automatically inferred crop species. The farmer's
declared crop remains the operational crop. No indices alter economics.

Sentinel-1 future work must fix orbit, polarization, coefficient, incidence
geometry, terrain correction and speckle treatment before comparing signals.
VV/VH are backscatter, not calibrated soil-water percentages.
[Official S1 GRD reference](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S1GRD.html).

Before farmer advisory claims: collect consented Rajasthan fields, season and
crop stage observations; validate masking, small-parcel bias, false anomaly
rates and inspection usefulness against ground evidence. Add no universal
agronomic cutoffs without crop/stage/local validation. Existing phone-image
classifier limitations remain unchanged.

## GPS and context

A phone point can be at home/on a road/in a neighbour's field. The 200 m square
is device_neighborhood in UI/JSON/PNG, not an inferred field or ownership record.
The browser accuracy bound is an engineering guard, not a surveyed guarantee.
Marked polygons are farmer selections. Weather is a model estimate; climate
uses approximately 25 km ERA5 at 0.1° rounded coordinates. Temperature averages
10,958 daily means in 1991–2020; annual rain sums daily totals and divides by
30. Every day and unit must validate. It is not this season's expected rainfall,
an irrigation plan or a local station measurement.
[ERA5 reference](https://open-meteo.com/en/docs/historical-weather-api).

GPS cannot establish soil texture or N/P/K, crop species/history or a named
disease. Existing crop/soil inputs remain declared inputs. Regional farmer
reports are unverified; no reports does not prove pest-free. Official historical
outbreaks and soil records are not connected. ISRIC reports SoilGrids REST
temporarily paused, so no soil estimate is silently invented.
[ISRIC status](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html).
Crop-photo links support inspection; they do not form a validated joint EO
disease classifier. Source resolution, temporal alignment and ground evidence
are required before any research model or field advisory can be claimed.

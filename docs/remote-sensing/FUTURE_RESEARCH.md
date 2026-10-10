# Research and scale path

Operational release: **A** Sentinel-2 field observations. Next recommended
milestone is a consented Rajasthan field pilot measuring cloud-mask quality,
parcel-size effects and whether inspection cues help farmers. Do this before
adding classification/economic influence.

**B — Sentinel-1 fusion:** fixed-orbit VV/VH time series with terrain/speckle
processing and locally evaluated optical/radar features. Backscatter is not
exact soil moisture. Keep experimental capability/UI flags separate.

**C — Crop classification:** season-long ground-truthed field signatures.
Start Random Forest/XGBoost, compare temporal CNN/LSTM only with evidence;
transformer/foundation features only if they improve spatial/season holdouts.
No fake labels. Split by whole field, spatial district holdout and season/year
holdout. Report macro F1, class recall, confusion matrix and label uncertainty.

**D — Stress research:** satellite relative anomaly → visit → phone image,
weather, soil test and farmer observation. Assess causes from ground evidence,
not a satellite disease-name threshold.

**E — Drone/high resolution:** only with real data, consent and funding.
**F — FPO/government:** village/block/district/state aggregated precomputed
assets; job queue/object storage; batch Statistical API/openEO or contractually
appropriate Earth Engine. Never relax field endpoints to synchronous state-scale
requests. Report mapped-field denominator, dates, quality and uncertainty for
crop area, anomalies and inspection priority.

Dataset contract (design only; no records fabricated):
```json
{
  "field_id":"consented pseudonym",
  "polygon":"consented WGS84 Polygon",
  "crop":"farmer-declared and verified label",
  "variety":null,
  "sowing_date":null,
  "harvest_date":null,
  "season":null,
  "district":null,
  "state":null,
  "irrigation":null,
  "field_observations":[],
  "satellite_dates":[],
  "weather":[],
  "yield_if_consented":null,
  "label_source":null,
  "label_confidence":null,
  "consent":{"purpose":null,"granted_at":null,"withdrawal_method":null},
  "provenance":[]
}
```
Treat precise polygons as sensitive, access-controlled research data. Yield
labels require separate consent. Remote classification may support, never
silently replace, the declared operational crop. No unvalidated model enters
the current economics.

India references checked 2026-09-30: [NRSC agriculture applications](https://www.nrsc.gov.in/nrscnew/Agr_Apps.php?lang_code=en)
and [Bhuvan field/mobile workflows](https://bhuvanmaps.nrsc.gov.in/mobile/).
Government EO crop programs illustrate the need for regional/ground evidence;
they do not validate this application.

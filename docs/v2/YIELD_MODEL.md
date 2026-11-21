# District yield model

The field report starts from a forecast of what the farmer's district usually
harvests for that crop and season, then adjusts it for the farm. This page
summarises the forecast; the full record, including per-crop results, is
`backend/v2/data/yield_model_card.json`, written by `scripts/train_yield_model.py`.

## What it is

- **Data.** District-wise area, production and yield from the Directorate of
  Economics and Statistics, 1997-98 to 2022-23, plus the 2024-25 district file:
  175,232 cleaned rows in 14,123 district-crop-season series.
- **Model.** A scikit-learn gradient-boosted regressor predicts yield as a
  ratio of the district's own five-year mean, from that series' recent years,
  its trend and spread, and state and national context. Every feature uses
  only years before the forecast cutoff.
- **Selection.** For each crop, the candidate with the lowest median error on
  2020-21 and 2021-22, two years ahead, is served: the model, a blend of the
  model and the five-year mean, or the five-year mean alone.
- **Serving.** Forecasts for 2026-27 are precomputed into
  `backend/v2/data/district_yields.json.gz` with an 80 % interval. The API
  reads that table, so no machine-learning runtime is needed to serve it.
  When a district has no record the report falls back to the state and then
  the national figure and says which it used.

## How accurate it is

Two years ahead, median absolute percentage error:

| Tested on | Served forecast | District five-year mean | National average (the old starting point) |
|---|---:|---:|---:|
| 2022-23 (test) | 12.1 % | 13.2 % | 27.3 % |
| 2024-25 (separate file, out of time) | 13.3 % | 12.6 % | 25.9 % |

On 2022-23, 68 % of forecasts were within 20 % of the recorded yield. The
80 % interval contained the recorded yield 79 % and 77 % of the time.

## What that means

- Starting from the district instead of the national average halves the
  typical error. That is where the gain comes from.
- Against a plain five-year district mean the model is slightly better on
  2022-23 and slightly worse on 2024-25, so the learning step itself adds
  little. It is kept because it supplies the interval and handles short and
  gappy series, not because it beats the simple mean.
- It forecasts a district average. One field can sit well above or below it;
  the report moves the figure by at most 30 % for the farm's soil, water and
  inputs, and those adjustments are planning rules, not measurements.
- Weather in the coming season is not an input. A drought or flood year will
  miss.

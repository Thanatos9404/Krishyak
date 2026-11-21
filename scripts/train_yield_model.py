"""Train and appraise the district crop-yield model, then export its forecasts.

Data (not committed; see datasets/README.md):
  datasets/crop-wise-area-production-yield.csv   DES district APY, 1997-98 to 2022-23
  datasets/DES-District-Data-For-2024-25.csv     DES district APY, 2024-25 (out-of-time test)

The model forecasts a district's yield for a crop and season from that
district's own past yields, the state's and the country's recent level, and how
far ahead the forecast is. It is trained with a strict time split and compared
with the baselines it has to beat: the national average (what the planning
engine used before), last year's district yield and the district 5-year mean.

Outputs:
  backend/v2/data/district_yields.json.gz   forecasts the API serves (no ML runtime needed)
  backend/v2/data/yield_model_card.json     metrics, splits, limits

Run:  backend/venv/Scripts/python scripts/train_yield_model.py
"""

import argparse
import gzip
import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

# DES crop names -> Krishyak crop ids (crops the field report can assess).
CROPS = {
    "Wheat": "wheat",
    "Barley": "barley",
    "Rapeseed &Mustard": "mustard",
    "Gram": "chickpea",
    "Masoor": "lentil",
    "Lentil": "lentil",
    "Potato": "potato",
    "Onion": "onion",
    "Rice": "rice",
    "Maize": "maize",
    "Bajra": "bajra",
    "Jowar": "jowar",
    "Cotton(Lint)": "cotton",
    "Soyabean": "soybean",
    "Groundnut": "groundnut",
    "Moong(Green Gram)": "moong",
    "Moong": "moong",
    "Urad": "urad",
    "Arhar/Tur": "pigeon_pea",
    "Tur": "pigeon_pea",
    "Sesamum": "sesame",
    "Sugarcane": "sugarcane",
}
SEASONS = {
    "Kharif": "kharif",
    "Rabi": "rabi",
    "Summer": "summer",
    "Whole Year": "annual",
    "Winter": "winter",
    "Autumn": "autumn",
}
MIN_AREA_HA = 200  # tiny reported areas give unstable yields
HORIZONS = (1, 2, 3, 4)
TRAIN_UNTIL, VALID_YEARS, TEST_YEAR = 2019, (2020, 2021), 2022
FEATURES = [
    "lag1",
    "lag2",
    "lag3",
    "mean3",
    "mean5",
    "std5",
    "slope5",
    "best5",
    "worst5",
    "n_hist",
    "gap",
    "state_mean3",
    "nation_mean3",
    "nation_slope5",
    "log_area",
    "horizon",
    "target_year",
    "crop_code",
    "season_code",
]


def load_history():
    data = pd.read_csv(
        ROOT / "datasets/crop-wise-area-production-yield.csv", low_memory=False
    )
    data = data[data.crop_name.isin(CROPS) & data.season.isin(SEASONS)].copy()
    data["crop"] = data.crop_name.map(CROPS)
    data["season"] = data.season.map(SEASONS)
    data["year"] = data.year.str[:4].astype(int)
    data["yield_kg"] = data["yield"] * 1000  # tonnes/ha -> kg/ha
    data = data[(data.area >= MIN_AREA_HA) & (data.yield_kg > 0)]
    # Drop impossible records (unit slips): beyond 4x the crop's 99th percentile.
    cap = data.groupby("crop").yield_kg.transform(lambda s: s.quantile(0.99) * 4)
    data = data[data.yield_kg <= cap]
    data["state"] = data.state_name.str.strip()
    data["district"] = data.district_name.str.strip()
    keep = ["state", "district", "crop", "season", "year", "area", "yield_kg"]
    return data[keep].drop_duplicates(["state", "district", "crop", "season", "year"])


def load_recent():
    """2024-25 district yields: never used for fitting, only for the out-of-time test and to refresh forecasts."""
    data = pd.read_csv(ROOT / "datasets/DES-District-Data-For-2024-25.csv")
    data = data[data.Crop.isin(CROPS) & data.Season.isin(SEASONS)].copy()
    data["crop"] = data.Crop.map(CROPS)
    data["season"] = data.Season.map(SEASONS)
    data["year"] = 2024
    data["yield_kg"] = data["Yield-2024-25"].astype(float)
    data["area"] = (
        data["Area-2024-25"].astype(float) * 100_000
    )  # lakh ha -> ha (all-India wheat sums to 324)
    data = data[(data.area >= MIN_AREA_HA) & (data.yield_kg > 0)]
    data["state"] = data.State.str.strip()
    data["district"] = data.District.str.strip()
    return data[["state", "district", "crop", "season", "year", "area", "yield_kg"]]


def weighted_levels(history, keys):
    """Area-weighted yield per year for a grouping (state or nation), as (years, levels) arrays."""
    frame = history.assign(weighted=history.yield_kg * history.area)
    grouped = (
        frame.groupby(keys + ["year"])
        .agg(weighted=("weighted", "sum"), area=("area", "sum"))
        .reset_index()
    )
    grouped["level"] = grouped.weighted / grouped.area
    grouped = grouped.sort_values("year")
    return {
        key: (rows.year.values, rows.level.values)
        for key, rows in grouped.groupby(keys if len(keys) > 1 else keys[0])
    }


def recent(series, before, count):
    """The last ``count`` levels strictly before ``before`` (and not older than count + 2 years)."""
    if series is None:
        return np.empty(0), np.empty(0)
    years, levels = series
    stop = np.searchsorted(years, before)
    start = max(np.searchsorted(years, before - count - 2), stop - count)
    return years[start:stop], levels[start:stop]


def slope(years, values):
    if len(values) < 3:
        return 0.0
    x = years - years.mean()
    return float((x * (values - values.mean())).sum() / max((x * x).sum(), 1e-9))


def features_for(
    years, values, areas, cutoff, target_year, state_series, nation_series
):
    """Features from records strictly before ``cutoff`` for a forecast of ``target_year``."""
    n = int(np.searchsorted(years, cutoff))
    if n < 3:
        return None
    y, v = years[:n], values[:n]
    last5_y, last5 = y[-5:].astype(float), v[-5:]
    _, state_recent = recent(state_series, cutoff, 3)
    nation_years, nation_recent = recent(nation_series, cutoff, 5)
    return {
        "lag1": v[-1],
        "lag2": v[-2],
        "lag3": v[-3],
        "mean3": v[-3:].mean(),
        "mean5": last5.mean(),
        "std5": last5.std(),
        "slope5": slope(last5_y, last5),
        "best5": last5.max(),
        "worst5": last5.min(),
        "n_hist": n,
        "gap": int(cutoff - 1 - y[-1]),
        "state_mean3": float(state_recent.mean()) if len(state_recent) else np.nan,
        "nation_mean3": float(nation_recent[-3:].mean())
        if len(nation_recent)
        else np.nan,
        "nation_slope5": slope(nation_years.astype(float), nation_recent),
        "log_area": float(np.log1p(areas[n - 1])),
        "horizon": int(target_year - (cutoff - 1)),
        "target_year": int(target_year),
    }


def encode(frame):
    frame["crop_code"] = (
        frame.crop.astype("category")
        .cat.set_categories(sorted(set(CROPS.values())))
        .cat.codes
    )
    frame["season_code"] = (
        frame.season.astype("category")
        .cat.set_categories(sorted(set(SEASONS.values())))
        .cat.codes
    )
    return frame


def build_examples(history, targets, horizons):
    """One row per (series, target year, horizon); features only see data before the cutoff."""
    state_levels = weighted_levels(history, ["state", "crop", "season"])
    nation_levels = weighted_levels(history, ["crop", "season"])
    series = {
        key: (rows.year.values, rows.yield_kg.values, rows.area.values)
        for key, rows in history.sort_values("year").groupby(
            ["state", "district", "crop", "season"]
        )
    }
    rows = []
    for state, district, crop, season, year, actual in zip(
        targets.state.values,
        targets.district.values,
        targets.crop.values,
        targets.season.values,
        targets.year.values,
        targets.yield_kg.values,
        strict=True,
    ):
        past = series.get((state, district, crop, season))
        if past is None:
            continue
        for horizon in horizons:
            feats = features_for(
                *past,
                year - horizon + 1,
                year,
                state_levels.get((state, crop, season)),
                nation_levels.get((crop, season)),
            )
            if feats is None or feats["mean5"] <= 0:
                continue
            feats.update(
                state=state, district=district, crop=crop, season=season, actual=actual
            )
            rows.append(feats)
    return encode(pd.DataFrame(rows))


def fit(train, loss="absolute_error", quantile=None):
    model = HistGradientBoostingRegressor(
        loss=loss,
        quantile=quantile,
        learning_rate=0.08,
        max_iter=400,
        max_leaf_nodes=31,
        min_samples_leaf=40,
        l2_regularization=1.0,
        categorical_features=[
            FEATURES.index("crop_code"),
            FEATURES.index("season_code"),
        ],
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=30,
        random_state=7,
    )
    # The target is the yield relative to the district's own 5-year mean, so
    # one model serves crops whose yields differ by two orders of magnitude.
    return model.fit(train[FEATURES], train.actual / train.mean5)


def predict(model, frame):
    return model.predict(frame[FEATURES]) * frame.mean5.values


CANDIDATES = ("model", "blend", "mean5")


def candidate(model, frame, name):
    if name == "mean5":
        return frame.mean5.values
    predicted = predict(model, frame)
    return (predicted + frame.mean5.values) / 2 if name == "blend" else predicted


def choose_per_crop(model, valid):
    """For each crop, the candidate with the lowest median error on validation (two years ahead)."""
    rows = valid[valid.horizon == 2]
    choice = {}
    for crop, part in rows.groupby("crop"):
        errors = {name: float(np.median(np.abs(candidate(model, part, name) - part.actual) / part.actual)) for name in CANDIDATES}
        choice[crop] = min(errors, key=errors.get)
    return choice


def selected(model, frame, choice):
    result = np.empty(len(frame))
    crops = frame.crop.values
    for name in CANDIDATES:
        mask = np.array([choice.get(crop, "model") == name for crop in crops])
        if mask.any():
            result[mask] = candidate(model, frame[mask], name)
    return result


def score(actual, predicted):
    actual, predicted = np.asarray(actual, float), np.asarray(predicted, float)
    ape = np.abs(predicted - actual) / actual
    return {
        "n": int(len(actual)),
        "mae_kg_ha": round(float(mean_absolute_error(actual, predicted)), 1),
        "median_ape_pct": round(float(np.median(ape) * 100), 2),
        "mean_ape_pct": round(float(np.mean(np.clip(ape, 0, 3)) * 100), 2),
        "within_20pct": round(float(np.mean(ape <= 0.2) * 100), 1),
        "r2": round(float(r2_score(actual, predicted)), 4),
    }


def appraise(model, frame, national, choice):
    """Model against the baselines, overall and per crop, at each horizon."""
    report = {}
    for horizon, rows in frame.groupby("horizon"):
        nation = rows.apply(lambda r: national.get((r.crop, r.season), np.nan), axis=1)
        has_nation = nation.notna().values
        entry = {
            "served_per_crop_selection": score(rows.actual, selected(model, rows, choice)),
            "model": score(rows.actual, predict(model, rows)),
            "blend_model_and_5_year_mean": score(
                rows.actual, (predict(model, rows) + rows.mean5) / 2
            ),
            "district_last_year": score(rows.actual, rows.lag1),
            "district_5_year_mean": score(rows.actual, rows.mean5),
            "national_average_previous_engine": score(
                rows.actual[has_nation], nation[has_nation]
            ),
            "by_crop": {},
        }
        for crop, part in rows.groupby("crop"):
            if len(part) >= 30:
                entry["by_crop"][crop] = {
                    "served": score(part.actual, selected(model, part, choice)),
                    "served_method": choice.get(crop, "model"),
                    "model": score(part.actual, predict(model, part)),
                    "district_5_year_mean": score(part.actual, part.mean5),
                }
        report[f"horizon_{horizon}_years"] = entry
    return report


def main(output):
    history = load_history()
    recent = load_recent()
    print(
        f"history rows {len(history):,}; series {history.groupby(['state', 'district', 'crop', 'season']).ngroups:,}; 2024-25 rows {len(recent):,}"
    )

    examples = build_examples(history, history[history.year >= 2003], HORIZONS)
    train = examples[examples.target_year <= TRAIN_UNTIL]
    valid = examples[examples.target_year.isin(VALID_YEARS)]
    test = examples[examples.target_year == TEST_YEAR]
    print(f"examples: train {len(train):,} valid {len(valid):,} test {len(test):,}")

    model = fit(train)
    print("model fitted, iterations", model.n_iter_, flush=True)
    # What the previous engine used as its base: one all-India figure per crop and season.
    frame = history.assign(weighted=history.yield_kg * history.area)
    national = {}
    for (crop, season), rows in frame[
        frame.year.between(TRAIN_UNTIL - 2, TRAIN_UNTIL)
    ].groupby(["crop", "season"]):
        national[(crop, season)] = rows.weighted.sum() / rows.area.sum()

    card = {
        "model_id": f"district-yield-hgb-{date.today().isoformat()}",
        "algorithm": "scikit-learn HistGradientBoostingRegressor (absolute-error loss), target = yield / district 5-year mean",
        "features": FEATURES,
        "data": {
            "source": "Directorate of Economics and Statistics, district-wise area, production and yield (1997-98 to 2022-23; 2024-25)",
            "rows_after_cleaning": int(len(history)),
            "series": int(
                history.groupby(["state", "district", "crop", "season"]).ngroups
            ),
            "cleaning": f"reported area >= {MIN_AREA_HA} ha, positive yield, yield <= 4x the crop's 99th percentile",
        },
        "splits": {
            "train": f"harvest years 2003-04 to {TRAIN_UNTIL}-{str(TRAIN_UNTIL + 1)[2:]} ({len(train):,} examples)",
            "validation": f"2020-21 and 2021-22 ({len(valid):,})",
            "test": f"2022-23 ({len(test):,})",
            "out_of_time": "2024-25 district file, forecast from records up to 2022-23 (two years ahead)",
            "leakage_control": "every feature is computed only from years before the forecast cutoff",
        },
    }
    # Decided on validation only, before any test figure is computed.
    choice = choose_per_crop(model, valid)
    card["served_forecast"] = {
        "rule": "per crop, the candidate (model, model/5-year-mean blend, district 5-year mean) with the lowest "
        "median error on validation at the two-year horizon",
        "method_by_crop": choice,
    }
    card["validation"] = appraise(model, valid, national, choice)
    card["test"] = appraise(model, test, national, choice)

    # Out-of-time: 2024-25 from history ending 2022-23 (2023-24 district data is not in the files).
    oot = build_examples(history, recent, (2,))
    card["out_of_time_2024_25"] = appraise(model, oot, national, choice)

    # Prediction intervals from quantile models, checked on the test year.
    sample = train.sample(min(len(train), 250_000), random_state=7)
    low, high = fit(sample, "quantile", 0.1), fit(sample, "quantile", 0.9)
    print("interval models fitted", flush=True)
    inside = (test.actual >= predict(low, test)) & (test.actual <= predict(high, test))
    oot_inside = (oot.actual >= predict(low, oot)) & (oot.actual <= predict(high, oot))
    card["interval_80pct_coverage"] = {
        "test_2022_23": round(float(inside.mean() * 100), 1),
        "out_of_time_2024_25": round(float(oot_inside.mean() * 100), 1),
    }

    # Final models use every year up to 2022-23, then forecast the coming seasons.
    final_train = examples
    final_sample = final_train.sample(min(len(final_train), 250_000), random_state=7)
    final, final_low, final_high = (
        fit(final_train),
        fit(final_sample, "quantile", 0.1),
        fit(final_sample, "quantile", 0.9),
    )
    print("final models fitted", flush=True)
    combined = pd.concat([history, recent]).drop_duplicates(
        ["state", "district", "crop", "season", "year"], keep="last"
    )
    forecast_year = 2026  # the 2026-27 crop year; rabi 2026-27 is being sown now
    state_levels = weighted_levels(combined, ["state", "crop", "season"])
    nation_levels = weighted_levels(combined, ["crop", "season"])
    rows = []
    for (state, district, crop, season), past in combined.groupby(
        ["state", "district", "crop", "season"]
    ):
        past = past.sort_values("year")
        last_year = int(past.year.iloc[-1])
        if last_year < 2018:
            continue  # the district has stopped reporting this crop
        feats = features_for(
            past.year.values,
            past.yield_kg.values,
            past.area.values,
            last_year + 1,
            forecast_year,
            state_levels.get((state, crop, season)),
            nation_levels.get((crop, season)),
        )
        if feats is None:
            continue
        feats["horizon"] = min(feats["horizon"], max(HORIZONS))
        rows.append(
            {
                **feats,
                "state": state,
                "district": district,
                "crop": crop,
                "season": season,
                "last_year": last_year,
                "last_value": float(past.yield_kg.iloc[-1]),
            }
        )
    table = encode(pd.DataFrame(rows))
    table["forecast"] = selected(final, table, choice)
    table["low"] = np.minimum(predict(final_low, table), table.forecast)
    table["high"] = np.maximum(predict(final_high, table), table.forecast)

    from v2.locations import normalized_name

    districts, states = {}, {}
    for row in table.itertuples(index=False):
        entry = [
            round(row.forecast),
            round(row.low),
            round(row.high),
            int(row.n_hist),
            int(row.last_year),
            round(row.last_value),
        ]
        districts[
            f"{normalized_name(row.state)}|{normalized_name(row.district)}|{row.crop}|{row.season}"
        ] = entry
    weighted = combined[combined.year >= 2020].assign(
        weighted=lambda d: d.yield_kg * d.area
    )
    for (state, crop, season), part in weighted.groupby(["state", "crop", "season"]):
        states[f"{normalized_name(state)}|{crop}|{season}"] = [
            round(part.weighted.sum() / part.area.sum()),
            int(part.year.max()),
        ]
    nation = {
        f"{crop}|{season}": [
            round(part.weighted.sum() / part.area.sum()),
            int(part.year.max()),
        ]
        for (crop, season), part in weighted.groupby(["crop", "season"])
    }
    # What farmers in each district actually grow, by season: share of the listed crops' area, 2020-21 onwards.
    common = {}
    recent_area = (
        combined[combined.year >= 2020]
        .groupby(["state", "district", "season", "crop"])
        .area.mean()
        .reset_index()
    )
    for (state, district, season), part in recent_area.groupby(
        ["state", "district", "season"]
    ):
        total = part.area.sum()
        ranked = part.sort_values("area", ascending=False).head(6)
        entry = [
            [row.crop, round(row.area / total * 100)]
            for row in ranked.itertuples()
            if row.area / total >= 0.03
        ]
        if entry:
            common.setdefault(
                f"{normalized_name(state)}|{normalized_name(district)}", {}
            )[season] = entry
    payload = {
        "common_crops": common,
        "model_id": card["model_id"],
        "forecast_crop_year": f"{forecast_year}-{str(forecast_year + 1)[2:]}",
        "unit": "kg/ha",
        "district_fields": [
            "forecast",
            "low_10",
            "high_90",
            "years_of_records",
            "last_record_year",
            "last_record",
        ],
        "districts": districts,
        "states": states,
        "nation": nation,
        "notes": {
            "cotton": "Cotton figures are lint (ginned fibre), as DES reports them; seed cotton is roughly three times heavier.",
        },
    }
    card["served"] = {
        "district_series": len(districts),
        "state_series": len(states),
        "forecast_crop_year": payload["forecast_crop_year"],
    }
    card["limits"] = [
        "District averages across all farms; an individual field can differ widely with water, variety and management.",
        "No in-season weather: the forecast is made before the season from past yields.",
        "2023-24 district records are missing from the source files, so recent forecasts look two or more years ahead.",
        "Districts that changed name or were split are matched by name; unmatched fields fall back to the state average.",
    ]
    output.mkdir(parents=True, exist_ok=True)
    with gzip.open(
        output / "district_yields.json.gz", "wt", encoding="utf-8"
    ) as handle:
        json.dump(payload, handle, separators=(",", ":"), sort_keys=True)
    (output / "yield_model_card.json").write_text(
        json.dumps(card, indent=2) + "\n", encoding="utf-8"
    )
    brief = {
        name: card[name]["horizon_2_years"]
        for name in ("validation", "test")
        if "horizon_2_years" in card[name]
    }
    print("served:", card["served_forecast"]["method_by_crop"])
    for name, entry in brief.items():
        print(name, {k: v for k, v in entry.items() if k != "by_crop"})
    print(
        "out of time 2024-25",
        {
            k: v
            for k, v in card["out_of_time_2024_25"]["horizon_2_years"].items()
            if k != "by_crop"
        },
    )
    print(
        "interval coverage", card["interval_80pct_coverage"], "| served", card["served"]
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "backend/v2/data")
    main(parser.parse_args().output)

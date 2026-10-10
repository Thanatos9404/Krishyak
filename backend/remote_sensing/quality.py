import statistics

from .indices import MIN_TREND_HISTORY, TREND_FLOOR


def trend(observations):
    clear = [x for x in observations if x["quality_status"] == "clear" and x["mean"] is not None]
    # Do not substitute a historical clear interval for a cloudy latest interval.
    if len(clear) < MIN_TREND_HISTORY + 1 or not observations or observations[-1]["quality_status"] != "clear":
        return {"status": "insufficient_data", "baseline": None, "delta": None, "threshold": None}
    recent = clear[-(MIN_TREND_HISTORY + 1):-1]
    baseline = statistics.median(x["mean"] for x in recent)
    mad = statistics.median(abs(x["mean"] - baseline) for x in recent)
    threshold = max(TREND_FLOOR, 2 * 1.4826 * mad)
    delta = clear[-1]["mean"] - baseline
    # Floating-point noise at the exact boundary must not create an anomaly.
    status = "improving" if delta > threshold + 1e-12 else "declining" if delta < -threshold - 1e-12 else "stable"
    return {"status": status, "baseline": baseline, "delta": delta, "threshold": threshold,
            "method": "latest vs preceding four clear interval medians; max(0.03, 2 × scaled MAD)"}

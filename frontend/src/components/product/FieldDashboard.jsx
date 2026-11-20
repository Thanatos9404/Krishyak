import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bug,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  Droplets,
  Gauge,
  IndianRupee,
  Mountain,
  ShieldCheck,
  Sun,
  Wheat,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { ConsentPrompt } from "../../features/farms/ConsentPrompt";
import { useProductLocale } from "../../features/product/ProductLocale";
import { cropLabel, findCrop } from "../../features/product/crops";
import { rupees } from "./MarketView";

// One request per field and page: a field record that is missing, not yet
// allowed or temporarily unavailable is a state to explain, never an error box.
function useFieldRecord(path, deps) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    if (!path) {
      setState({ status: "idle" });
      return undefined;
    }
    setState({ status: "loading" });
    const controller = new AbortController();
    farmApi(path, { signal: controller.signal, retry: false, timeoutMs: 40000 })
      .then((data) => setState({ status: "ready", data }))
      .catch((error) => {
        if (!error.cancelled)
          setState({
            status: error.status === 422 ? "incomplete" : "unavailable",
            message: error.status === 422 ? error.message : null,
          });
      });
    return () => controller.abort();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

export function useFieldReport(w) {
  const allowed = w.consents.includes("agronomic_analysis");
  return useFieldRecord(
    w.selected && allowed && !w.offline
      ? `/plots/${w.selected}/assessment`
      : null,
    [w.selected, allowed, w.offline, w.cycles?.[0]?.id, w.plot?.revision],
  );
}

export function useOutlook(w) {
  const allowed = w.consents.includes("location_processing");
  return useFieldRecord(
    w.selected && allowed && !w.offline ? `/plots/${w.selected}/outlook` : null,
    [w.selected, allowed, w.offline],
  );
}

const SCORE_BAND = {
  good: ["Good", "leaf"],
  fair: ["Fair", "amber"],
  needs_care: ["Needs care", "brick"],
};
export const riskBand = (score) =>
  score < 35
    ? ["Low", "leaf"]
    : score < 60
      ? ["Medium", "amber"]
      : ["High", "brick"];
const RISKS = [
  ["weather", CloudRain, "Weather"],
  ["pest", Bug, "Pests and disease"],
  ["price", IndianRupee, "Price"],
  ["soil", Mountain, "Soil match"],
];
const LEVELS = {
  district: "From {{v0}} district records",
  state: "From {{v0}} state records",
  national: "From all-India records",
};

function Meter({ value, tone, label }) {
  return (
    <span
      className={`dash-meter tone-${tone}`}
      role="img"
      aria-label={`${label}: ${value} / 100`}
    >
      <span style={{ inlineSize: `${Math.max(4, Math.min(100, value))}%` }} />
    </span>
  );
}

// The four numbers a farmer asks first: how much, how much money, how risky, how good.
export function FieldNumbers({
  workspace: w,
  report,
  reportHref = "/app/assessment",
}) {
  const { tx } = useProductLocale();
  if (!w.consents.includes("agronomic_analysis"))
    return (
      <ConsentPrompt
        workspace={w}
        purposes={["agronomic_analysis"]}
        title="See your expected harvest, profit and risk"
        reason="Krishyak uses your field, crop and soil details to estimate them. You can turn this off in Settings."
      />
    );
  if (report.status === "idle") return null;
  if (report.status === "loading")
    return (
      <section className="dash-numbers is-loading" aria-busy="true">
        <p role="status">{tx("Working out your field numbers…")}</p>
      </section>
    );
  if (report.status !== "ready")
    return (
      <section className="dash-empty">
        <Wheat size={26} aria-hidden="true" />
        <p>
          {report.status === "incomplete"
            ? tx(
                "Add your crop, land size and soil to see your expected harvest, profit and risk.",
              )
            : tx(
                "Your field numbers could not be loaded just now. The rest of this page still works.",
              )}
        </p>
        {report.status === "incomplete" && (
          <a
            className="button secondary"
            href={w.selected ? `/app/farm/${w.selected}` : "/app/setup"}
          >
            {tx("Complete my field")} <ArrowRight size={16} />
          </a>
        )}
      </section>
    );
  const r = report.data;
  const crop = cropLabel(findCrop(r.crop_id), tx);
  const basis = r.harvest.basis;
  const profit = r.harvest.profit;
  const [riskLabel, riskTone] = riskBand(r.risk.overall);
  const [scoreLabel, scoreTone] = SCORE_BAND[r.score_band];
  const place =
    basis?.level === "district"
      ? w.farmer?.district
      : basis?.level === "state"
        ? w.farmer?.state
        : null;
  return (
    <section className="dash-numbers" aria-labelledby="dash-numbers-heading">
      <div className="section-heading">
        <h2 id="dash-numbers-heading">
          {tx("Your {{v0}} field at a glance", { v0: crop })}
        </h2>
        {reportHref && (
          <a className="text-link" href={reportHref}>
            {tx("Full field report")} <ArrowRight size={16} />
          </a>
        )}
      </div>
      <div className="dash-kpis">
        <article className="dash-kpi tone-leaf">
          <h3>
            <Wheat size={20} aria-hidden="true" /> {tx("Expected harvest")}
          </h3>
          <p className="dash-value">
            {r.harvest.total_quintals} <small>{tx("quintals")}</small>
          </p>
          <p className="dash-note">
            {tx("About {{v0}} kg per hectare", {
              v0: r.harvest.yield_kg_per_hectare.toLocaleString("en-IN"),
            })}
          </p>
        </article>
        {profit == null ? (
          <article className="dash-kpi tone-amber">
            <h3>
              <IndianRupee size={20} aria-hidden="true" />{" "}
              {tx("Expected profit")}
            </h3>
            <p className="dash-value dash-value-text">{tx("No price yet")}</p>
            <p className="dash-note">
              {tx(
                "No mandi or support price is available for this crop near you today, so profit is not estimated.",
              )}
            </p>
          </article>
        ) : (
          <article
            className={`dash-kpi ${profit >= 0 ? "tone-leaf" : "tone-brick"}`}
          >
            <h3>
              <IndianRupee size={20} aria-hidden="true" />{" "}
              {profit >= 0 ? tx("Expected profit") : tx("Expected loss")}
            </h3>
            <p className="dash-value">{rupees(Math.abs(profit))}</p>
            <p className="dash-note">
              {tx("Likely between {{v0}} and {{v1}}", {
                v0: rupees(r.harvest.profit_range[0]),
                v1: rupees(r.harvest.profit_range[1]),
              })}
            </p>
          </article>
        )}
        <article className={`dash-kpi tone-${riskTone}`}>
          <h3>
            <ShieldCheck size={20} aria-hidden="true" /> {tx("Risk")}
          </h3>
          <p className="dash-value">
            {r.risk.overall} <small>/ 100</small>
          </p>
          <p className="dash-note">
            <strong>{tx(riskLabel)}</strong>
          </p>
          <Meter value={r.risk.overall} tone={riskTone} label={tx("Risk")} />
        </article>
        <article className={`dash-kpi tone-${scoreTone}`}>
          <h3>
            <Gauge size={20} aria-hidden="true" /> {tx("Field score")}
          </h3>
          <p className="dash-value">
            {r.field_score} <small>/ 100</small>
          </p>
          <p className="dash-note">
            <strong>{tx(scoreLabel)}</strong>
          </p>
          <Meter
            value={r.field_score}
            tone={scoreTone}
            label={tx("Field score")}
          />
        </article>
      </div>
      <div className="dash-risks">
        <h3>{tx("Where the risk comes from")}</h3>
        <ul>
          {RISKS.map(([key, Icon, label]) => {
            const [, tone] = riskBand(r.risk[key]);
            return (
              <li key={key}>
                <Icon size={20} aria-hidden="true" />
                <span>{tx(label)}</span>
                <Meter value={r.risk[key]} tone={tone} label={tx(label)} />
                <strong>{r.risk[key]}</strong>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="small muted">
        {basis
          ? `${tx(LEVELS[basis.level], { v0: place || "" })}. ${tx(
              "Estimates, not promises. Your own field can differ.",
            )}`
          : tx("Estimates, not promises. Your own field can differ.")}
      </p>
    </section>
  );
}

const SKY = {
  clear: [Sun, "Clear"],
  cloudy: [Cloud, "Cloudy"],
  fog: [CloudFog, "Fog"],
  rain: [CloudRain, "Rain"],
  heavy_rain: [CloudRainWind, "Heavy rain"],
  storm: [CloudLightning, "Storm"],
};

// Seven days in one row, so rain, heat and a dry spell are seen at once.
export function WeekAhead({ workspace: w, outlook }) {
  const { tx, info } = useProductLocale();
  if (!w.consents.includes("location_processing") || outlook.status !== "ready")
    return null;
  const { forecast, climate, recent_rain: recent } = outlook.data;
  if (!forecast && !climate) return null;
  const weekday = new Intl.DateTimeFormat(info.speechCode, {
    weekday: "short",
  });
  const rainy = (forecast?.days || []).filter(
    (day) => day.rain_mm >= 1 || (day.rain_chance_percent ?? 0) >= 60,
  );
  const window = recent?.last_90_days;
  return (
    <section className="product-card week-card" aria-labelledby="week-heading">
      <h2 id="week-heading">
        <CloudRain size={22} aria-hidden="true" />{" "}
        {tx("Weather for the next 7 days")}
      </h2>
      {forecast && (
        <>
          <p className="week-summary">
            {rainy.length
              ? tx("Rain is likely on {{v0}} of the next 7 days.", {
                  v0: rainy.length,
                })
              : tx("No rain is expected in the next 7 days.")}
          </p>
          <ol className="week-days">
            {forecast.days.map((day, index) => {
              const [Icon, label] = SKY[day.sky] || SKY.clear;
              return (
                <li key={day.date} className={`sky-${day.sky}`}>
                  <span className="week-day">
                    {index === 0
                      ? tx("Today")
                      : weekday.format(new Date(`${day.date}T12:00:00`))}
                  </span>
                  <Icon size={26} aria-hidden="true" />
                  <span className="sr-only">{tx(label)}</span>
                  <strong>{Math.round(day.high_c)}°</strong>
                  <span className="week-low">{Math.round(day.low_c)}°</span>
                  <span className="week-rain">
                    {day.rain_mm >= 0.5
                      ? `${day.rain_mm} mm`
                      : day.rain_chance_percent != null
                        ? `${day.rain_chance_percent}%`
                        : "0 mm"}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {climate && (
        <ul className="week-facts">
          <li>
            <Droplets size={20} aria-hidden="true" />
            <span>
              {tx("Rain here in a normal year: {{v0}} mm", {
                v0: climate.annual_rain_mm,
              })}
            </span>
          </li>
          {window && (
            <li>
              <CloudRain size={20} aria-hidden="true" />
              <span>
                {window.percent_of_normal != null
                  ? tx("Last 90 days: {{v0}} mm of rain, {{v1}}% of normal", {
                      v0: window.rain_mm,
                      v1: window.percent_of_normal,
                    })
                  : tx("Last 90 days: {{v0}} mm of rain", {
                      v0: window.rain_mm,
                    })}
              </span>
            </li>
          )}
        </ul>
      )}
      <p className="small muted">
        {tx(
          "Forecasts change. Past rain is an estimate for your area, not a gauge in your field.",
        )}
      </p>
    </section>
  );
}

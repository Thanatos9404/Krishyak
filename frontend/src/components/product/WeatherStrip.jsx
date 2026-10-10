import { useProductLocale } from "../../features/product/ProductLocale";
import { useEffect, useState } from "react";
import {
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  Thermometer,
  Wind,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { readRecord, saveRecord } from "../../features/farms/offline";
import { ConsentPrompt } from "../../features/farms/ConsentPrompt";
import { cancelReadsOnExit } from "../../features/product/readCancellation";

const STALE_MS = 3 * 60 * 60 * 1000;
const NEEDS = ["location_processing", "agronomic_analysis"];

// Plain conclusions from model forecasts. They describe conditions and common
// timing considerations only; they never prescribe a product or dose.
export function weatherConclusions(payload) {
  const next = (payload.hourly || []).slice(0, 24);
  const rain = payload.precipitation_next_24h_mm ?? 0;
  const hottest = next.length
    ? Math.max(...next.map((row) => row.temperature))
    : payload.current.temperature;
  const windiest = next.length
    ? Math.max(...next.map((row) => row.wind_speed))
    : payload.current.wind_speed;
  const items = [];
  if (rain >= 10)
    items.push({
      kind: "rain",
      title: "Heavy rain likely in the next 24 hours",
      advice:
        "Postpone spraying and fertilizer. Check that water can drain from the field.",
    });
  else if (rain >= 2.5)
    items.push({
      kind: "rain",
      title: "Rain likely in the next 24 hours",
      advice: "Spray or fertilizer applied now may wash off.",
    });
  else if (rain >= 0.2)
    items.push({
      kind: "rain",
      title: "Light rain possible in the next 24 hours",
      advice: "Check the sky before spraying.",
    });
  else
    items.push({
      kind: "dry",
      title: "No rain expected in the next 24 hours",
      advice: "Plan irrigation by checking soil moisture by hand.",
    });
  if (hottest >= 38)
    items.push({
      kind: "heat",
      title: "Very hot afternoon expected",
      advice:
        "If the crop needs water, irrigate in the early morning or evening.",
    });
  if (windiest >= 20)
    items.push({
      kind: "wind",
      title: "Strong wind expected",
      advice: "Avoid spraying in strong wind; spray drifts away from the crop.",
    });
  return { items, rain, hottest, windiest };
}

export function WeatherStrip({ plotId, plot, owner, cache, workspace: w }) {
  const { tx, formatDate, formatNumber } = useProductLocale();
  const [record, setRecord] = useState(null),
    [savedAt, setSavedAt] = useState(null),
    [state, setState] = useState("loading"),
    [problem, setProblem] = useState("");
  const located = Boolean(plot?.centroid || plot?.approximate_location);
  const permitted = NEEDS.every((purpose) => w?.consents?.includes(purpose));
  const number = (value, digits = 0) =>
    formatNumber
      ? formatNumber(value, { maximumFractionDigits: digits })
      : value.toFixed(digits);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const endReads = cancelReadsOnExit(controller);
    setRecord(null);
    setSavedAt(null);
    setProblem("");
    setState("loading");
    const refresh = () =>
      farmApi(`/plots/${plotId}/weather/refresh`, {
        method: "POST",
        body: { operation_id: crypto.randomUUID() },
        signal: controller.signal,
        timeoutMs: 30000,
      });
    const load = async () => {
      try {
        const result = await farmApi(`/plots/${plotId}/weather`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        let observation = result.observation;
        const stale =
          !observation ||
          Date.now() - new Date(observation.created_at).getTime() > STALE_MS;
        if (stale && located && permitted && navigator.onLine) {
          try {
            observation = await refresh();
          } catch (error) {
            if (error.cancelled || cancelled) return;
            setProblem(error.message);
          }
        }
        if (cancelled) return;
        setRecord(observation);
        setState(observation ? "ready" : "empty");
        if (cache && observation)
          await saveRecord(owner, `weather:${plotId}`, { observation });
      } catch (problem) {
        if (cancelled || problem.cancelled) return;
        if (cache && problem.network) {
          const saved = await readRecord(owner, `weather:${plotId}`).catch(
            () => null,
          );
          if (saved && !cancelled) {
            setRecord(saved.data.observation);
            setSavedAt(saved.saved_at);
            setState("ready");
            return;
          }
        }
        setProblem(problem.message);
        setState("empty");
      }
    };
    load();
    return () => {
      cancelled = true;
      endReads();
    };
  }, [plotId, owner, cache, located, permitted]);
  const summary = record ? weatherConclusions(record.payload) : null;
  return (
    <section className="weather-card" aria-labelledby="weather-heading">
      <h2 id="weather-heading">
        <CloudSun size={22} aria-hidden="true" /> {tx("Weather")}
      </h2>
      {state === "loading" && (
        <p role="status">{tx("Checking the weather…")}</p>
      )}
      {summary && (
        <>
          <ul className="weather-conclusions">
            {summary.items.map((item) => (
              <li key={item.title} className={`weather-${item.kind}`}>
                {item.kind === "rain" ? (
                  <CloudRain size={22} aria-hidden="true" />
                ) : item.kind === "heat" ? (
                  <Thermometer size={22} aria-hidden="true" />
                ) : item.kind === "wind" ? (
                  <Wind size={22} aria-hidden="true" />
                ) : (
                  <CloudSun size={22} aria-hidden="true" />
                )}
                <span>
                  <strong>{tx(item.title)}</strong>
                  <small>{tx(item.advice)}</small>
                </span>
              </li>
            ))}
          </ul>
          <dl className="weather-facts">
            <div>
              <dt>{tx("Now")}</dt>
              <dd>{number(record.payload.current.temperature)} °C</dd>
            </div>
            <div>
              <dt>{tx("Rain, next 24 hours")}</dt>
              <dd>
                <Droplets size={15} aria-hidden="true" />{" "}
                {number(summary.rain, 1)} mm
              </dd>
            </div>
            <div>
              <dt>{tx("Hottest")}</dt>
              <dd>{number(summary.hottest)} °C</dd>
            </div>
            <div>
              <dt>{tx("Wind up to")}</dt>
              <dd>{number(summary.windiest)} km/h</dd>
            </div>
          </dl>
          <details className="evidence-details">
            <summary>{tx("Source and limits")}</summary>
            <p>
              {record.source} · {tx("retrieved")}{" "}
              {formatDate(record.created_at, { time: true })}
              {savedAt &&
                ` · ${tx("Saved on this device")} ${formatDate(savedAt, { time: true })}`}
            </p>
            <p>
              {tx(
                "Weather-model forecast for an area of about 1 km. It is not a measurement from your field and can be wrong.",
              )}
            </p>
          </details>
        </>
      )}
      {state === "empty" && !located && (
        <p className="inline-note">
          <MapPin size={16} aria-hidden="true" />{" "}
          {tx("Add your field's location to see local weather.")}{" "}
          <a href={`/app/farm/${plotId}`}>{tx("Open field")}</a>
        </p>
      )}
      {state === "empty" && located && !permitted && w && (
        <ConsentPrompt
          workspace={w}
          purposes={NEEDS}
          title="Show local weather for this field"
          reason="Krishyak sends the field's rounded location (about 1 km) to a weather service and keeps the forecast with your field records."
        />
      )}
      {problem && state !== "loading" && (
        <p className="inline-note" role="status">
          {tx(problem)}{" "}
          <button
            type="button"
            className="button text"
            onClick={() => location.reload()}
          >
            <RefreshCw size={14} /> {tx("Retry")}
          </button>
        </p>
      )}
    </section>
  );
}

import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useState } from "react";
import { farmApi } from "./api";
import { readRecord, saveRecord } from "./offline";
import { cancelReadsOnExit } from "../product/readCancellation";
const PARAMETERS = {
  ph: ["pH"],
  nitrogen: ["mg/kg", "kg/ha"],
  phosphorus: ["mg/kg", "kg/ha"],
  potassium: ["mg/kg", "kg/ha"],
  organic_carbon: ["%"],
  moisture: ["%"],
  conductivity: ["dS/m"],
};
const Input = ({ label, children }) => (
  <label className="v2-label">
    <span>{label}</span>
    {children}
  </label>
);
export default function PlotContext({
  plot,
  owner,
  offline,
  cache,
  consents,
  act,
  busy,
  onUpdated,
}) {
  const { tx, formatDate } = useProductLocale();
  const [evidence, setEvidence] = useState({}),
    [savedAt, setSavedAt] = useState(null);
  const [parameter, setParameter] = useState("ph"),
    [unit, setUnit] = useState("pH"),
    [value, setValue] = useState("");
  const [source, setSource] = useState(""),
    [method, setMethod] = useState("lab_report"),
    [depth, setDepth] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const key = `context:${plot.id}`;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const endReads = cancelReadsOnExit(controller);
    setEvidence({});
    setSavedAt(null);
    const load = async () => {
      try {
        const [soil, weather] = await Promise.all([
          farmApi(`/plots/${plot.id}/soil`, { signal: controller.signal }),
          farmApi(`/plots/${plot.id}/weather`, { signal: controller.signal }),
        ]);
        if (cancelled) return;
        setEvidence({
          soil,
          weather,
        });
        if (cache)
          await saveRecord(owner, key, {
            soil,
            weather,
          });
      } catch (error) {
        if (!error.network || !cache) return;
        const record = await readRecord(owner, key).catch(() => null);
        if (record && !cancelled) {
          setEvidence(record.data);
          setSavedAt(record.saved_at);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
      endReads();
    };
  }, [plot.id, plot.revision, owner, key, cache]);
  const soil = evidence.soil?.observation,
    weather = evidence.weather?.observation;
  const permitted = consents.includes("agronomic_analysis");
  return (
    <section className="v2-card" aria-label={tx("Soil and weather evidence")}>
      <h2>{tx("Soil and weather evidence")}</h2>
      {savedAt && (
        <p>
          {tx("Saved on this device:")} {formatDate(savedAt, { time: true })}
          {tx(". Live updates are unavailable offline.")}
        </p>
      )}
      <h3>{tx("Local weather model")}</h3>
      {weather ? (
        <>
          <p>
            {weather.source} {tx("\xB7 retrieved")}{" "}
            {formatDate(weather.created_at, { time: true })}{" "}
            {tx("\xB7 conditions at")}{" "}
            {formatDate(weather.observed_at, { time: true })}
          </p>
          <p>
            {weather.payload.current.temperature} {tx("\xB0C \xB7 humidity")}{" "}
            {weather.payload.current.humidity}
            {tx("% \xB7 wind")} {weather.payload.current.wind_speed} km/h
          </p>
          <p>
            {tx("Forecast precipitation, next 24 hours:")}{" "}
            {weather.payload.precipitation_next_24h_mm.toFixed(1)}{" "}
            {tx("mm. This is forecast rain, not measured rainfall.")}
          </p>
          <details>
            <summary>{tx("Hourly forecast and source limitations")}</summary>
            <div className="v2-table-scroll">
              <table>
                <caption>{tx("48-hour weather model forecast")}</caption>
                <thead>
                  <tr>
                    <th>{tx("Time")}</th>
                    <th>{tx("\xB0C")}</th>
                    <th>{tx("Humidity %")}</th>
                    <th>{tx("Rain mm")}</th>
                    <th>Wind km/h</th>
                  </tr>
                </thead>
                <tbody>
                  {weather.payload.hourly.map((row) => (
                    <tr key={row.timestamp}>
                      <td>{formatDate(row.timestamp, { time: true })}</td>
                      <td>{row.temperature}</td>
                      <td>{row.humidity}</td>
                      <td>{row.precipitation}</td>
                      <td>{row.wind_speed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul>
              {weather.provenance.limitations.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p>
          {tx(
            "Weather evidence is unavailable. An approximate mapped boundary and processing permissions are required.",
          )}
        </p>
      )}
      <button
        disabled={
          busy ||
          offline ||
          !permitted ||
          !consents.includes("location_processing") ||
          !plot.boundary
        }
        onClick={() =>
          act(async () => {
            const observation = await farmApi(
              `/plots/${plot.id}/weather/refresh`,
              {
                method: "POST",
                body: {
                  operation_id: crypto.randomUUID(),
                },
              },
            );
            const updated = {
              ...evidence,
              weather: {
                observation,
                status: "available",
              },
            };
            setEvidence(updated);
            if (cache) await saveRecord(owner, key, updated);
            await onUpdated();
          })
        }
      >
        {tx("Update local weather")}
      </button>
      <h3>{tx("Soil record")}</h3>
      {soil ? (
        <>
          <p>
            {soil.source} {tx("\xB7 reported method:")} {soil.provenance.method}{" "}
            · {formatDate(soil.observed_at)}
          </p>
          <p>
            {tx(
              "Farmer-reported evidence; source and measurements are not independently verified.",
            )}
          </p>
          {Array.isArray(soil.payload.measurements) ? (
            <ul>
              {soil.payload.measurements.map((row) => (
                <li key={`${row.parameter}:${row.depth_cm}`}>
                  {row.parameter.replaceAll("_", " ")}: {row.value} {row.unit}
                  {row.depth_cm != null &&
                    tx(" \xB7 depth {{v0}} cm", {
                      v0: row.depth_cm,
                    })}
                </li>
              ))}
            </ul>
          ) : (
            <p>{soil.payload.note}</p>
          )}
        </>
      ) : (
        <p>
          {tx(
            "No soil measurement is recorded. Satellite indices do not measure soil nutrients.",
          )}
        </p>
      )}
      <details>
        <summary>{tx("Enter a soil-card, lab or sensor reading")}</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            act(async () => {
              const observation = await farmApi(`/plots/${plot.id}/soil`, {
                method: "POST",
                body: {
                  operation_id: crypto.randomUUID(),
                  source,
                  reported_method: method,
                  observed_at: new Date(`${date}T00:00:00+05:30`).toISOString(),
                  measurements: [
                    {
                      parameter,
                      value: Number(value),
                      unit,
                      depth_cm: depth ? Number(depth) : null,
                    },
                  ],
                },
              });
              const updated = {
                ...evidence,
                soil: {
                  observation,
                  status: "available",
                },
              };
              setEvidence(updated);
              setValue("");
              if (cache) await saveRecord(owner, key, updated);
              await onUpdated();
            });
          }}
        >
          <Input label={tx("Soil source name")}>
            <input
              required
              value={source}
              maxLength={100}
              onChange={(event) => setSource(event.target.value)}
              placeholder={tx("Name on your report or sensor")}
            />
          </Input>
          <Input label={tx("Reported measurement method")}>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              {[
                "lab_report",
                "soil_card",
                "sensor_reading",
                "manual_estimate",
              ].map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Input>
          <Input label={tx("Soil parameter")}>
            <select
              value={parameter}
              onChange={(event) => {
                setParameter(event.target.value);
                setUnit(PARAMETERS[event.target.value][0]);
              }}
            >
              {Object.keys(PARAMETERS).map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Input>
          <Input label={tx("Soil value")}>
            <input
              required
              type="number"
              step="any"
              min="0"
              max={unit === "%" ? 100 : unit === "pH" ? 14 : 1000000}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Input>
          <Input label={tx("Soil unit")}>
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {PARAMETERS[parameter].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Input>
          <Input label={tx("Sample depth (cm), if known")}>
            <input
              type="number"
              min="0"
              max="200"
              step="any"
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
            />
          </Input>
          <Input label={tx("Soil observation date")}>
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Input>
          <button disabled={busy || offline || !permitted}>
            {tx("Save soil evidence")}
          </button>
        </form>
      </details>
    </section>
  );
}

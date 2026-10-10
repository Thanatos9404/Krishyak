import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useRef, useState } from "react";
import { deferredFeature } from "../../features/product/deferredProductFeature";
import { farmApi } from "./api";
import { readRecord, saveRecord } from "./offline";
import { cancelReadsOnExit } from "../product/readCancellation";

// Farmer words for each index; the index names stay in technical details.
const VIEWS = {
  ndvi: { name: "Crop greenness", rise: "greener", fall: "less green" },
  ndmi: { name: "Leaf moisture", rise: "moister", fall: "drier" },
  ndre: { name: "Crop vigour (dense crops)", rise: "stronger", fall: "weaker" },
};

// Compare the latest clear interval with the previous clear one. A change
// under 0.03 index points is within normal noise and reported as no change.
export function satelliteConclusion(values, index) {
  const clear = values.filter(
    (row) => row.quality_status === "clear" && typeof row.mean === "number",
  );
  if (clear.length < 2) return null;
  const latest = clear.at(-1),
    previous = clear.at(-2);
  const delta = latest.mean - previous.mean;
  const view = VIEWS[index];
  const direction = delta >= 0.03 ? "rise" : delta <= -0.03 ? "fall" : "same";
  return {
    direction,
    text:
      direction === "same"
        ? "No clear change since the previous clear satellite view."
        : direction === "rise"
          ? `Your field looks ${view.rise} than in the previous clear satellite view.`
          : `Your field looks ${view.fall} than in the previous clear satellite view. Walk the field to check why.`,
    from: previous.end,
    to: latest.end,
  };
}
const FieldMap = deferredFeature(() => import("../../components/FieldMap"));
const FieldTrendChart = deferredFeature(
  () => import("../../components/FieldTrendChart"),
);
export default function PlotHealth({
  plot,
  owner,
  consents,
  cache,
  offline,
  busy,
  act,
  refreshToken,
  providerStatus,
  onUpdated,
}) {
  const { tx, formatDate } = useProductLocale();
  const [records, setRecords] = useState([]),
    [job, setJob] = useState(null),
    [error, setError] = useState("");
  const [index, setIndex] = useState("ndvi"),
    [mapOpen, setMapOpen] = useState(false),
    [image, setImage] = useState(null),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const objectUrl = useRef(null),
    active = useRef(true);
  const updatedJob = useRef(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);
  useEffect(() => {
    let cancelled = false,
      timer;
    const controller = new AbortController();
    const endReads = cancelReadsOnExit(controller);
    const load = async () => {
      try {
        const response = await farmApi(
          `/plots/${plot.id}/remote-sensing?limit=100`,
          { signal: controller.signal },
        );
        if (cancelled) return;
        setError("");
        setRecords(
          response.items.filter(
            (row) => row.provenance.boundary_revision === plot.revision,
          ),
        );
        setJob(response.latest_job);
        if (
          response.latest_job?.status === "completed" &&
          updatedJob.current !== response.latest_job.id
        ) {
          updatedJob.current = response.latest_job.id;
          await onUpdated();
        }
        if (cache) await saveRecord(owner, `satellite:${plot.id}`, response);
        if (
          ["pending", "running", "retry"].includes(response.latest_job?.status)
        )
          timer = setTimeout(load, 10000);
      } catch (problem) {
        const saved =
          cache && problem.network
            ? await readRecord(owner, `satellite:${plot.id}`).catch(() => null)
            : null;
        if (cancelled) return;
        if (saved) {
          setRecords(
            saved.data.items.filter(
              (row) => row.provenance.boundary_revision === plot.revision,
            ),
          );
          setJob(saved.data.latest_job);
        } else setError(problem.message);
      }
    };
    load();
    return () => {
      cancelled = true;
      endReads();
      clearTimeout(timer);
    };
  }, [
    plot.id,
    plot.revision,
    owner,
    cache,
    refreshVersion,
    refreshToken,
    onUpdated,
  ]);
  const observations = records
    .filter((row) => row.payload.index === index)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  const values = observations.map((row) => row.payload.observation);
  const latest = observations.at(-1);
  const blocked = !plot.boundary
    ? "Draw your field boundary to use satellite views."
    : providerStatus !== "ready"
      ? "Satellite service is not available right now. Your saved views remain below."
      : !consents.includes("satellite_processing") ||
          !consents.includes("location_processing")
        ? "Turn on satellite permission in Settings to request new views."
        : null;
  return (
    <section className="v2-card">
      <h2>{tx("Satellite view of this field")}</h2>
      {(() => {
        const conclusion = satelliteConclusion(values, index);
        return conclusion ? (
          <p className={`satellite-conclusion ${conclusion.direction}`}>
            <strong>{tx(conclusion.text)}</strong>
            <small>
              {formatDate(conclusion.from)} → {formatDate(conclusion.to)}
            </small>
          </p>
        ) : (
          <p className="inline-note">
            {values.length
              ? tx(
                  "Not enough clear (cloud-free) satellite views yet to tell a change.",
                )
              : tx(
                  "No satellite views are saved for this field yet. This does not mean the field is healthy.",
                )}
          </p>
        );
      })()}
      <p className="small muted">
        {tx(
          "Satellite views show where to look in your field. They cannot name a disease, a nutrient problem or your yield.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {blocked && <p className="inline-note">{tx(blocked)}</p>}
      {job && ["pending", "running", "retry"].includes(job.status) && (
        <p role="status">
          {tx("Fetching new satellite views. This can take a minute.")}
        </p>
      )}
      {job?.status === "failed" && (
        <p className="inline-note">
          {tx(
            "The last satellite request did not finish. Earlier views are kept; try again later.",
          )}
        </p>
      )}
      <label className="v2-label">
        {tx("What to look at")}
        <select
          value={index}
          onChange={(event) => setIndex(event.target.value)}
        >
          {Object.entries(VIEWS).map(([key, view]) => (
            <option key={key} value={key}>
              {tx(view.name)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button secondary"
        disabled={
          busy ||
          providerStatus !== "ready" ||
          offline ||
          !plot.boundary ||
          !consents.includes("satellite_processing") ||
          !consents.includes("location_processing")
        }
        onClick={() =>
          act(async () => {
            const response = await farmApi(
              `/plots/${plot.id}/remote-sensing/refresh`,
              {
                method: "POST",
                body: {
                  operation_id: crypto.randomUUID(),
                  index,
                },
              },
            );
            if (active.current) {
              setJob(response);
              setRefreshVersion((value) => value + 1);
            }
          })
        }
      >
        {tx("Get latest satellite view")}
      </button>
      {values.length ? (
        <>
          <details>
            <summary>{tx("Technical details and trend chart")}</summary>
            <FieldTrendChart
              observations={values}
              index={index}
              description="Stored satellite interval means; cloudy intervals remain missing"
            />
            <p>
              {tx("Latest interval:")} {index.toUpperCase()} ·{" "}
              {latest.payload.observation.start.slice(0, 10)} to{" "}
              {latest.payload.observation.end.slice(0, 10)} {tx("\xB7 quality")}{" "}
              {latest.payload.observation.quality_status}{" "}
              {tx("\xB7 valid pixel fraction")}{" "}
              {latest.payload.observation.valid_fraction}
            </p>
            <details>
              <summary>{tx("How this index was measured")}</summary>
              <p>
                {latest.source} · {latest.provenance.formula}{" "}
                {tx("\xB7 resolution")} {latest.provenance.spatial_resolution_m}{" "}
                {tx("m \xB7 processing")} {latest.provenance.processing_version}
              </p>
              <p>
                {tx("Processed")}{" "}
                {formatDate(latest.created_at, { time: true })}
                {tx(
                  ". Interval composites may contain several acquisitions; exact contributing dates are not independently verified.",
                )}
              </p>
              <ul>
                {(latest.provenance.limitations || []).map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </details>
          </details>
        </>
      ) : null}
      <details>
        <summary>{tx("Optional field map and satellite preview")}</summary>
        <p>
          {tx(
            "Opening the map contacts the basemap provider. A mapped boundary and permissions are required for satellite retrieval.",
          )}
        </p>
        <button onClick={() => setMapOpen((value) => !value)}>
          {tx("Open or close field map")}
        </button>
        {mapOpen && plot.boundary && (
          <FieldMap
            vertices={plot.boundary.coordinates[0].slice(0, -1)}
            onVertices={() => {}}
            drawing={false}
            editing={false}
            center={plot.centroid?.coordinates}
            image={image}
            instructions="Saved field boundary and optional satellite overlay"
            unavailable="The map could not load. Stored evidence remains available below."
          />
        )}
        <label className="v2-label">
          {tx("Satellite preview date")}
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button
          disabled={
            busy ||
            providerStatus !== "ready" ||
            offline ||
            !plot.boundary ||
            !consents.includes("satellite_processing") ||
            !consents.includes("location_processing")
          }
          onClick={() =>
            act(async () => {
              const blob = await farmApi(
                `/plots/${plot.id}/remote-sensing/preview`,
                {
                  method: "POST",
                  body: {
                    date,
                    layer: index,
                  },
                  binary: true,
                },
              );
              if (!active.current) return;
              if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
              objectUrl.current = URL.createObjectURL(blob);
              setImage({
                geometry: plot.boundary,
                url: objectUrl.current,
              });
              setMapOpen(true);
            })
          }
        >
          {tx("Load quality-masked preview")}
        </button>
        <p>
          NDVI = (B8 − B4) / (B8 + B4); NDMI = (B8 − B11) / (B8 + B11); NDRE =
          (B8A − B5) / (B8A + B5). Masked or insufficient pixels are
          unavailable, not zero.
        </p>
      </details>
    </section>
  );
}

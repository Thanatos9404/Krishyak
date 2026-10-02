import React, { useEffect, useRef, useState } from "react";
import { deferredFeature } from "../../components/deferredFeature";
import { farmApi } from "./api";
import { readRecord, saveRecord } from "./offline";

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
    const load = async () => {
      try {
        const response = await farmApi(
          `/plots/${plot.id}/remote-sensing?limit=100`,
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
  return (
    <section className="v2-card">
      <h2>Plot Health · satellite evidence</h2>
      <p>
        Vegetation and moisture indices provide inspection context. They do not
        identify disease, soil nutrients, crop yield or a universal health
        score.
      </p>
      {error && <p role="alert">{error}</p>}
      {providerStatus !== "ready" && (
        <p>
          Satellite access is unavailable:{" "}
          {providerStatus || "configuration unknown"}. Stored evidence and
          manual observations remain available.
        </p>
      )}
      {job && (
        <p>
          Latest request: {job.status}
          {job.error_code ? ` · ${job.error_code.replaceAll("_", " ")}` : ""}.
          Failed requests preserve earlier observations.
        </p>
      )}
      <label className="v2-label">
        Vegetation index
        <select
          value={index}
          onChange={(event) => setIndex(event.target.value)}
        >
          <option value="ndvi">NDVI · vegetation</option>
          <option value="ndmi">NDMI · moisture context</option>
          <option value="ndre">NDRE · red-edge vegetation</option>
        </select>
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
            const response = await farmApi(
              `/plots/${plot.id}/remote-sensing/refresh`,
              {
                method: "POST",
                body: { operation_id: crypto.randomUUID(), index },
              },
            );
            if (active.current) {
              setJob(response);
              setRefreshVersion((value) => value + 1);
            }
          })
        }
      >
        Queue {index.toUpperCase()} observations
      </button>
      {values.length ? (
        <>
          <FieldTrendChart
            observations={values}
            index={index}
            description="Stored satellite interval means; cloudy intervals remain missing"
          />
          <p>
            Latest interval: {latest.payload.observation.start.slice(0, 10)} to{" "}
            {latest.payload.observation.end.slice(0, 10)} · quality{" "}
            {latest.payload.observation.quality_status} · valid pixel fraction{" "}
            {latest.payload.observation.valid_fraction}
          </p>
          <details>
            <summary>How this index was measured</summary>
            <p>
              {latest.source} · {latest.provenance.formula} · resolution{" "}
              {latest.provenance.spatial_resolution_m} m · processing{" "}
              {latest.provenance.processing_version}
            </p>
            <p>
              Processed {new Date(latest.created_at).toLocaleString()}. Interval
              composites may contain several acquisitions; exact contributing
              dates are not independently verified.
            </p>
            <ul>
              {(latest.provenance.limitations || []).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p>
          No observations for {index.toUpperCase()} and the current field
          boundary are stored. This is missing evidence, not a healthy-field
          result.
        </p>
      )}
      <details>
        <summary>Optional field map and satellite preview</summary>
        <p>
          Opening the map contacts the basemap provider. A mapped boundary and
          permissions are required for satellite retrieval.
        </p>
        <button onClick={() => setMapOpen((value) => !value)}>
          Open or close field map
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
          Satellite preview date
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
                { method: "POST", body: { date, layer: index }, binary: true },
              );
              if (!active.current) return;
              if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
              objectUrl.current = URL.createObjectURL(blob);
              setImage({ geometry: plot.boundary, url: objectUrl.current });
              setMapOpen(true);
            })
          }
        >
          Load quality-masked preview
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

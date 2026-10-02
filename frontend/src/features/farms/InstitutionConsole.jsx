import React, { useEffect, useState } from "react";
import { farmApi } from "./api";

export default function InstitutionConsole({ farmer, act, busy }) {
  const expert = ["admin", "agronomist"].includes(farmer.role),
    institution = ["admin", "organisation_admin"].includes(farmer.role);
  const [queue, setQueue] = useState([]),
    [labels, setLabels] = useState([]),
    [correction, setCorrection] = useState(""),
    [note, setNote] = useState(""),
    [photo, setPhoto] = useState(null);
  const [cohorts, setCohorts] = useState([]),
    [report, setReport] = useState(null),
    [monitoring, setMonitoring] = useState(null);
  const [name, setName] = useState(""),
    [district, setDistrict] = useState(""),
    [crops, setCrops] = useState("Tomato"),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (expert) {
          const [records, model, aggregate] = await Promise.all([
            farmApi("/review-queue"),
            farmApi("/model"),
            farmApi("/admin/model-monitoring"),
          ]);
          if (!cancelled) {
            setQueue(records.items);
            setLabels(model.classes);
            setMonitoring(aggregate);
          }
        }
        if (institution) {
          const records = await farmApi("/admin/pilots");
          if (!cancelled) setCohorts(records.items);
        }
      } catch (problem) {
        if (!cancelled) setError(problem.message);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [expert, institution]);
  return (
    <section className="v2-card">
      <h2>Institutional workspace</h2>
      <p>
        Privileged operations require a fresh OTP sign-in within ten minutes.
        Refreshing the session does not extend that verification.
      </p>
      {error && (
        <p role="alert">
          {error}. Sign out and sign in again if fresh verification is required.
        </p>
      )}
      {expert && (
        <>
          <h3>Consented expert review</h3>
          <p>
            Only photographs with current model-improvement consent appear here.
            Corrections do not retrain or promote a model.
          </p>
          {queue.length ? (
            queue.map((item) => (
              <article className="v2-event" key={item.image_id}>
                <p>
                  {item.result.model_id} · {item.result.status} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
                <button onClick={() => setPhoto(item.image_id)}>
                  View consented photograph
                </button>
                {photo === item.image_id && (
                  <img
                    className="v2-review-photo"
                    src={`/api/v2/review-queue/${item.image_id}/image`}
                    alt="Consented crop photograph for expert review"
                  />
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    act(async () => {
                      await farmApi(`/review-queue/${item.image_id}`, {
                        method: "POST",
                        body: {
                          operation_id: crypto.randomUUID(),
                          corrected_class: correction,
                          note,
                        },
                      });
                      setQueue((values) =>
                        values.filter(
                          (value) => value.image_id !== item.image_id,
                        ),
                      );
                      setPhoto(null);
                      setNote("");
                    });
                  }}
                >
                  <label className="v2-label">
                    Corrected classifier label
                    <select
                      required
                      value={correction}
                      onChange={(event) => setCorrection(event.target.value)}
                    >
                      <option value="">Select a supported label</option>
                      {labels.map((label) => (
                        <option key={label}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="v2-label">
                    Expert review notes
                    <textarea
                      required
                      maxLength={2000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Save audited review</button>
                </form>
              </article>
            ))
          ) : (
            <p>No consented photographs are available for review.</p>
          )}
          {monitoring && (
            <details>
              <summary>Model monitoring from consented records</summary>
              <p>
                {monitoring.scans} consented scans ·{" "}
                {monitoring.farmer_responses} farmer responses ·{" "}
                {monitoring.expert_reviews} expert reviews.
              </p>
              <p>
                Farmer disagreement:{" "}
                {monitoring.farmer_disagreement_rate == null
                  ? "unavailable"
                  : `${(monitoring.farmer_disagreement_rate * 100).toFixed(1)}%`}{" "}
                · expert disagreement:{" "}
                {monitoring.expert_disagreement_rate == null
                  ? "unavailable"
                  : `${(monitoring.expert_disagreement_rate * 100).toFixed(1)}%`}
                . These are selected feedback records, not field accuracy.
              </p>
              <ul>
                {Object.entries(monitoring.by_status).map(([status, count]) => (
                  <li key={status}>
                    {status || "unknown"}: {count}
                  </li>
                ))}
              </ul>
              <ul>
                {monitoring.limitations.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {institution && (
        <>
          <h3>Pilot cohorts</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              act(async () => {
                const record = await farmApi("/admin/pilots", {
                  method: "POST",
                  body: {
                    name,
                    district,
                    crops: crops
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                });
                setCohorts((values) => [record, ...values]);
                setName("");
              });
            }}
          >
            <label className="v2-label">
              Cohort name
              <input
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="v2-label">
              Pilot district
              <input
                required
                maxLength={100}
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
              />
            </label>
            <label className="v2-label">
              Pilot crops, separated by commas
              <input
                required
                maxLength={500}
                value={crops}
                onChange={(event) => setCrops(event.target.value)}
              />
            </label>
            <button disabled={busy}>Create pilot cohort</button>
          </form>
          {cohorts.map((cohort) => (
            <article className="v2-event" key={cohort.id}>
              <h3>{cohort.name}</h3>
              <p>
                {cohort.district} · {cohort.crops.join(", ")}
              </p>
              <p>
                Enrollment code: <code>{cohort.id}</code>
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () =>
                    setReport(
                      await farmApi(`/admin/pilots/${cohort.id}/report`),
                    ),
                  )
                }
              >
                View aggregate report
              </button>
            </article>
          ))}
          {report && (
            <article>
              <h3>{report.cohort.name} · aggregate report</h3>
              <p>
                {report.enrolled_farmers} consented farmers ·{" "}
                {report.enrolled_plots} selected fields.
              </p>
              <p>
                Yield improvement: not measured. Income improvement: not
                measured. Field validation: incomplete.
              </p>
              {report.suppressed_small_cohort ? (
                <p>
                  Distributions are hidden until at least five farmers have
                  current pilot consent.
                </p>
              ) : (
                <>
                  <h4>Recorded events</h4>
                  <ul>
                    {Object.entries(report.recorded_events || {}).map(
                      ([kind, count]) => (
                        <li key={kind}>
                          {kind.replaceAll("_", " ")}: {count}
                        </li>
                      ),
                    )}
                  </ul>
                  <h4>Active crops</h4>
                  <ul>
                    {Object.entries(report.crop_distribution || {}).map(
                      ([crop, count]) => (
                        <li key={crop}>
                          {crop}: {count}
                        </li>
                      ),
                    )}
                  </ul>
                  <p>
                    In-app acknowledgements: {report.in_app_acknowledgements}
                  </p>
                </>
              )}
              <ul>
                {report.limitations.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </article>
          )}
        </>
      )}
    </section>
  );
}

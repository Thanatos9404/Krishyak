import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useState } from "react";
import { farmApi } from "./api";
export default function InstitutionConsole({ farmer, act, busy }) {
  const { tx } = useProductLocale();
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
      <h2>{tx("Institutional workspace")}</h2>
      <p>
        {tx(
          "Privileged operations require a fresh OTP sign-in within ten minutes. Refreshing the session does not extend that verification.",
        )}
      </p>
      {error && (
        <p role="alert">
          {error}
          {tx(
            ". Sign out and sign in again if fresh verification is required.",
          )}
        </p>
      )}
      {expert && (
        <>
          <h3>{tx("Consented expert review")}</h3>
          <p>
            {tx(
              "Only photographs with current model-improvement consent appear here. Corrections do not retrain or promote a model.",
            )}
          </p>
          {queue.length ? (
            queue.map((item) => (
              <article className="v2-event" key={item.image_id}>
                <p>
                  {item.result.model_id} · {item.result.status} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
                <button onClick={() => setPhoto(item.image_id)}>
                  {tx("View consented photograph")}
                </button>
                {photo === item.image_id && (
                  <img
                    className="v2-review-photo"
                    src={`/api/v2/review-queue/${item.image_id}/image`}
                    alt={tx("Consented crop photograph for expert review")}
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
                    {tx("Corrected classifier label")}
                    <select
                      required
                      value={correction}
                      onChange={(event) => setCorrection(event.target.value)}
                    >
                      <option value="">{tx("Select a supported label")}</option>
                      {labels.map((label) => (
                        <option key={label}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="v2-label">
                    {tx("Expert review notes")}
                    <textarea
                      required
                      maxLength={2000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                  <button disabled={busy}>{tx("Save audited review")}</button>
                </form>
              </article>
            ))
          ) : (
            <p>{tx("No consented photographs are available for review.")}</p>
          )}
          {monitoring && (
            <details>
              <summary>{tx("Model monitoring from consented records")}</summary>
              <p>
                {monitoring.scans} {tx("consented scans \xB7")}{" "}
                {monitoring.farmer_responses} {tx("farmer responses \xB7")}{" "}
                {monitoring.expert_reviews} {tx("expert reviews.")}
              </p>
              <p>
                {tx("Farmer disagreement:")}{" "}
                {monitoring.farmer_disagreement_rate == null
                  ? "unavailable"
                  : tx("{{v0}}%", {
                      v0: (monitoring.farmer_disagreement_rate * 100).toFixed(
                        1,
                      ),
                    })}{" "}
                {tx("\xB7 expert disagreement:")}{" "}
                {monitoring.expert_disagreement_rate == null
                  ? "unavailable"
                  : tx("{{v0}}%", {
                      v0: (monitoring.expert_disagreement_rate * 100).toFixed(
                        1,
                      ),
                    })}
                {tx(
                  ". These are selected feedback records, not field accuracy.",
                )}
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
          <h3>{tx("Pilot cohorts")}</h3>
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
              {tx("Cohort name")}
              <input
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="v2-label">
              {tx("Pilot district")}
              <input
                required
                maxLength={100}
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
              />
            </label>
            <label className="v2-label">
              {tx("Pilot crops, separated by commas")}
              <input
                required
                maxLength={500}
                value={crops}
                onChange={(event) => setCrops(event.target.value)}
              />
            </label>
            <button disabled={busy}>{tx("Create pilot cohort")}</button>
          </form>
          {cohorts.map((cohort) => (
            <article className="v2-event" key={cohort.id}>
              <h3>{cohort.name}</h3>
              <p>
                {cohort.district} · {cohort.crops.join(", ")}
              </p>
              <p>
                {tx("Enrollment code:")} <code>{cohort.id}</code>
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
                {tx("View aggregate report")}
              </button>
            </article>
          ))}
          {report && (
            <article>
              <h3>
                {report.cohort.name} {tx("\xB7 aggregate report")}
              </h3>
              <p>
                {report.enrolled_farmers} {tx("consented farmers \xB7")}{" "}
                {report.enrolled_plots} {tx("selected fields.")}
              </p>
              <p>
                {tx(
                  "Yield improvement: not measured. Income improvement: not measured. Field validation: incomplete.",
                )}
              </p>
              {report.suppressed_small_cohort ? (
                <p>
                  {tx(
                    "Distributions are hidden until at least five farmers have current pilot consent.",
                  )}
                </p>
              ) : (
                <>
                  <h4>{tx("Recorded events")}</h4>
                  <ul>
                    {Object.entries(report.recorded_events || {}).map(
                      ([kind, count]) => (
                        <li key={kind}>
                          {kind.replaceAll("_", " ")}: {count}
                        </li>
                      ),
                    )}
                  </ul>
                  <h4>{tx("Active crops")}</h4>
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
                    {tx("In-app acknowledgements:")}{" "}
                    {report.in_app_acknowledgements}
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

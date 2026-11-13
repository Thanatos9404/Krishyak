import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  FileCheck2,
  Printer,
  RefreshCw,
  Users,
} from "lucide-react";
import { farmApi } from "./api";
import { useProductLocale } from "../product/ProductLocale";
import { cropLabel, findCrop } from "../product/crops";
import {
  PURPOSES,
  REASONS,
  VerdictBadge,
} from "../../components/product/SharingViews";
import { CAUSES } from "../../components/product/ClaimView";

const explain = (error) =>
  error.status === 401
    ? "Sign out and sign in again to continue. Creating groups and checks needs a sign-in from the last ten minutes."
    : error.status === 403
      ? "This account does not have an institutional role."
      : error.message;

// FPO Command Centre: every shared member field on one screen.
export function CommandCentre({ act, busy }) {
  const { tx, formatDate } = useProductLocale();
  const [groups, setGroups] = useState([]),
    [open, setOpen] = useState(""),
    [board, setBoard] = useState(null),
    [name, setName] = useState(""),
    [district, setDistrict] = useState(""),
    [problem, setProblem] = useState("");
  const loadGroups = useCallback(async () => {
    try {
      const result = await farmApi("/admin/groups");
      setGroups(result.items);
      setOpen((value) => value || result.items[0]?.id || "");
    } catch (error) {
      setProblem(explain(error));
    }
  }, []);
  const loadBoard = useCallback(async () => {
    if (!open) return;
    try {
      setBoard(await farmApi(`/admin/groups/${open}/dashboard`));
      setProblem("");
    } catch (error) {
      setProblem(explain(error));
    }
  }, [open]);
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);
  useEffect(() => {
    setBoard(null);
    loadBoard();
    // A live board: refresh each minute while the tab is visible.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadBoard();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadBoard]);
  const needs = (row) =>
    row.photo_check?.status === "detected" ||
    row.nearby_alerts.length > 0 ||
    row.loss_report;
  return (
    <section className="product-card desk" aria-labelledby="command-centre">
      <h2 id="command-centre">
        <Users size={24} aria-hidden="true" /> {tx("FPO Command Centre")}
      </h2>
      <p>
        {tx(
          "Fields your members chose to share. You see names, crops and alerts; never phone numbers, field outlines or photos.",
        )}
      </p>
      {problem && (
        <p role="alert" className="error-panel inline">
          {tx(problem)}
        </p>
      )}
      <form
        className="desk-form"
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            try {
              const group = await farmApi("/admin/groups", {
                method: "POST",
                body: { name: name.trim(), district: district.trim() },
              });
              setName("");
              setDistrict("");
              await loadGroups();
              setOpen(group.id);
            } catch (error) {
              setProblem(explain(error));
            }
          });
        }}
      >
        <label className="v2-label">
          {tx("New group name")}
          <input
            value={name}
            minLength={2}
            maxLength={100}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="v2-label">
          {tx("District")}
          <input
            value={district}
            minLength={2}
            maxLength={100}
            required
            onChange={(event) => setDistrict(event.target.value)}
          />
        </label>
        <button className="button secondary" disabled={busy}>
          {tx("Create group")}
        </button>
      </form>
      {groups.length > 0 && (
        <label className="v2-label">
          {tx("Group")}
          <select
            value={open}
            onChange={(event) => setOpen(event.target.value)}
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {tx("{{v0}} members", { v0: group.members })}
              </option>
            ))}
          </select>
        </label>
      )}
      {board && (
        <>
          <div className="desk-code">
            <span>{tx("Members join with this code")}</span>
            <strong dir="ltr">{board.group.join_code}</strong>
            <span>{tx("In the app: More, then My farmer group")}</span>
          </div>
          <dl className="desk-totals">
            {[
              ["members", "Members"],
              ["fields", "Fields"],
              ["hectares", "Hectares"],
              ["need_attention", "Need attention"],
              ["photo_checks_60_days", "Photo checks, 60 days"],
              ["mapped_fields", "Mapped fields"],
            ].map(([key, label]) => (
              <div
                key={key}
                className={
                  key === "need_attention" && board.totals[key] ? "alert" : ""
                }
              >
                <dt>{tx(label)}</dt>
                <dd>{board.totals[key]}</dd>
              </div>
            ))}
          </dl>
          {board.fields.length ? (
            <div
              className="desk-table-wrap"
              tabIndex={0}
              role="region"
              aria-label={tx("Member fields")}
            >
              <table className="desk-table">
                <thead>
                  <tr>
                    <th scope="col">{tx("Member")}</th>
                    <th scope="col">{tx("Field")}</th>
                    <th scope="col">{tx("Crop")}</th>
                    <th scope="col">{tx("Hectares")}</th>
                    <th scope="col">{tx("Photo check")}</th>
                    <th scope="col">{tx("Greenness")}</th>
                    <th scope="col">{tx("Alerts")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...board.fields]
                    .sort((a, b) => Boolean(needs(b)) - Boolean(needs(a)))
                    .map((row, index) => (
                      <tr key={index} className={needs(row) ? "attention" : ""}>
                        <th scope="row">
                          {row.farmer}
                          <small>{row.village}</small>
                        </th>
                        <td>{row.field}</td>
                        <td>
                          {cropLabel(findCrop(row.crop_id), tx) ||
                            row.crop ||
                            "-"}
                          {row.sowing_date && (
                            <small>
                              {tx("sown {{v0}}", {
                                v0: formatDate(row.sowing_date),
                              })}
                            </small>
                          )}
                        </td>
                        <td>{row.area_hectares ?? "-"}</td>
                        <td>
                          {row.photo_check ? (
                            <>
                              {row.photo_check.status === "detected"
                                ? tx(
                                    row.photo_check.likely_problem ||
                                      "Problem found",
                                  )
                                : row.photo_check.status === "healthy"
                                  ? tx("No disease seen")
                                  : tx("Unclear")}
                              <small>{formatDate(row.photo_check.date)}</small>
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {row.satellite ? (
                            <>
                              {row.satellite.ndvi}
                              <small>{formatDate(row.satellite.date)}</small>
                            </>
                          ) : row.mapped ? (
                            tx("No clear view")
                          ) : (
                            tx("Not mapped")
                          )}
                        </td>
                        <td>
                          {row.nearby_alerts.map((alert) => (
                            <span key={alert} className="desk-flag">
                              <AlertTriangle size={14} aria-hidden="true" />{" "}
                              {tx(alert)}
                            </span>
                          ))}
                          {row.loss_report && (
                            <span className="desk-flag loss">
                              {tx("Loss: {{v0}}", {
                                v0: tx(
                                  CAUSES[row.loss_report.cause]?.[1] ||
                                    "Something else",
                                ),
                              })}
                              <small>{formatDate(row.loss_report.date)}</small>
                            </span>
                          )}
                          {!row.nearby_alerts.length && !row.loss_report && "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="inline-note">
              {tx(
                "No member has shared a field yet. Give members the code above.",
              )}
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="button secondary"
              onClick={loadBoard}
            >
              <RefreshCw size={16} aria-hidden="true" /> {tx("Refresh")}
            </button>
            <span className="small muted">
              {tx("Updated {{v0}}. Refreshes every minute.", {
                v0: formatDate(board.generated_at, { time: true }),
              })}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function Series({ points }) {
  if (!points?.length) return null;
  const width = 300,
    height = 80;
  const x = (index) =>
    points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
  const y = (value) => height - Math.max(0, Math.min(1, value)) * height;
  return (
    <svg
      className="verify-series"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="NDVI over the season"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        points={points
          .map((point, index) => `${x(index)},${y(point.ndvi)}`)
          .join(" ")}
      />
      {points.map((point, index) => (
        <circle
          key={point.from}
          cx={x(index)}
          cy={y(point.ndvi)}
          r="3.5"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

// Krishyak Verify: request a consented satellite check of one farm.
export function VerifyDesk({ act, busy }) {
  const { tx, formatDate } = useProductLocale();
  const [items, setItems] = useState([]),
    [reference, setReference] = useState(""),
    [purpose, setPurpose] = useState("crop_loan"),
    [report, setReport] = useState(null),
    [created, setCreated] = useState(null),
    [problem, setProblem] = useState("");
  const load = useCallback(async () => {
    try {
      setItems((await farmApi("/admin/verifications")).items);
    } catch (error) {
      setProblem(explain(error));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const openReport = (id) =>
    act(async () => {
      try {
        setReport(await farmApi(`/admin/verifications/${id}`));
        await load();
      } catch (error) {
        setProblem(explain(error));
      }
    });
  return (
    <section className="product-card desk" aria-labelledby="verify-desk">
      <h2 id="verify-desk">
        <FileCheck2 size={24} aria-hidden="true" /> {tx("Krishyak Verify")}
      </h2>
      <p>
        {tx(
          "Ask a farmer for a satellite check of one field. Give the farmer the code; nothing is shared until they agree in their app.",
        )}
      </p>
      {problem && (
        <p role="alert" className="error-panel inline">
          {tx(problem)}
        </p>
      )}
      <form
        className="desk-form"
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            try {
              setCreated(
                await farmApi("/admin/verifications", {
                  method: "POST",
                  body: { reference: reference.trim(), purpose },
                }),
              );
              setReference("");
              await load();
            } catch (error) {
              setProblem(explain(error));
            }
          });
        }}
      >
        <label className="v2-label">
          {tx("Your reference (loan or policy number)")}
          <input
            value={reference}
            maxLength={60}
            required
            onChange={(event) => setReference(event.target.value)}
          />
        </label>
        <label className="v2-label">
          {tx("Purpose")}
          <select
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          >
            {Object.entries(PURPOSES).map(([value, label]) => (
              <option key={value} value={value}>
                {tx(label)}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" disabled={busy}>
          {tx("Create check")}
        </button>
      </form>
      {created && (
        <div className="desk-code" role="status">
          <span>
            {tx("Give this code to the farmer for {{v0}}", {
              v0: created.reference,
            })}
          </span>
          <strong dir="ltr">{created.code}</strong>
          <span>
            {tx("In the app: More, then Farm check. Valid for 30 days.")}
          </span>
        </div>
      )}
      {items.length > 0 && (
        <div
          className="desk-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={tx("Verification requests")}
        >
          <table className="desk-table">
            <thead>
              <tr>
                <th scope="col">{tx("Reference")}</th>
                <th scope="col">{tx("Purpose")}</th>
                <th scope="col">{tx("Status")}</th>
                <th scope="col">{tx("Report")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    {item.reference}
                    <small>{formatDate(item.created_at)}</small>
                  </th>
                  <td>{tx(PURPOSES[item.purpose])}</td>
                  <td>
                    {item.status === "awaiting_farmer" ? (
                      <>
                        {tx("Waiting for the farmer")}
                        <small dir="ltr">{item.code}</small>
                      </>
                    ) : item.status === "withdrawn" ? (
                      tx("Withdrawn by the farmer")
                    ) : item.status === "processing" ? (
                      tx("Satellite check running")
                    ) : (
                      tx("Ready")
                    )}
                  </td>
                  <td>
                    {["ready", "processing"].includes(item.status) ? (
                      <button
                        type="button"
                        className="button text"
                        disabled={busy}
                        onClick={() => openReport(item.id)}
                      >
                        {tx("Open report")}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report?.result && (
        <article
          className="verify-report claim-sheet"
          aria-labelledby="verify-report-title"
        >
          <header>
            <h2 id="verify-report-title">
              <Building2 size={20} aria-hidden="true" />{" "}
              {tx("Farm verification report")}
            </h2>
            <p>
              {report.reference} · {tx(PURPOSES[report.purpose])} ·{" "}
              {formatDate(report.result.evaluated_at, { time: true })}
            </p>
          </header>
          <VerdictBadge verdict={report.result.verdict} />
          <p>{tx(REASONS[report.result.reason] || "")}</p>
          <dl className="claim-facts">
            <div>
              <dt>{tx("Farmer")}</dt>
              <dd>{report.farmer?.name}</dd>
            </div>
            <div>
              <dt>{tx("Village, district")}</dt>
              <dd>
                {[
                  report.farmer?.village,
                  report.farmer?.district,
                  report.farmer?.state,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>{tx("Declared crop")}</dt>
              <dd>
                {cropLabel(findCrop(report.declared.crop_id), tx) ||
                  report.declared.crop}{" "}
                ·{" "}
                {tx("sown {{v0}}", {
                  v0: formatDate(report.declared.sowing_date),
                })}
              </dd>
            </div>
            <div>
              <dt>{tx("Area")}</dt>
              <dd>
                {tx("{{v0}} ha mapped", {
                  v0: report.declared.mapped_hectares,
                })}
                {report.declared.entered_hectares != null &&
                  ` · ${tx("{{v0}} ha declared", { v0: report.declared.entered_hectares })}`}
              </dd>
            </div>
            <div>
              <dt>{tx("Location (about 1 km)")}</dt>
              <dd dir="ltr">
                {report.declared.location.latitude},{" "}
                {report.declared.location.longitude}
              </dd>
            </div>
            <div>
              <dt>{tx("Clear satellite views in season")}</dt>
              <dd>{report.result.findings.clear_views_in_season}</dd>
            </div>
            <div>
              <dt>{tx("Greenness at sowing, then peak")}</dt>
              <dd>
                {report.result.findings.greenness_at_sowing ?? "-"} →{" "}
                {report.result.findings.peak_greenness ?? "-"}
              </dd>
            </div>
            <div>
              <dt>{tx("Leaf photos of this crop")}</dt>
              <dd>{report.result.leaf_photos_of_declared_crop}</dd>
            </div>
          </dl>
          <Series points={report.result.series} />
          <p className="small">{report.result.satellite}</p>
          <ul className="care-steps">
            {report.result.limitations.map((item) => (
              <li key={item}>{tx(item)}</li>
            ))}
          </ul>
          {report.result.human_review && (
            <p className="status-panel">
              {tx(
                "This check needs a person: visit or call the farmer before deciding.",
              )}
            </p>
          )}
          <button
            type="button"
            className="button secondary claim-screen-only"
            onClick={() => window.print()}
          >
            <Printer size={18} aria-hidden="true" />{" "}
            {tx("Print or save as PDF")}
          </button>
        </article>
      )}
    </section>
  );
}

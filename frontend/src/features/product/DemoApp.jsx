"use client";
import { useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  Droplets,
  MapPin,
  Plus,
  Sprout,
  Sun,
} from "lucide-react";
import { I18nProvider } from "../../i18n";
import { ProductShell } from "../../components/product/ProductShell";
import { Dialog } from "../../components/product/Dialog";
import { Timeline } from "../../components/product/Timeline";
import { Photo } from "../../components/public/Photo";

const FIELDS = [
  { id: "example-north", name: "North field", area: 1.6 },
  { id: "example-east", name: "East field", area: 0.8 },
];
const ACTIONS = [
  {
    title: "Check the drier corner.",
    why: "An example moisture trend has changed. A field visit can help distinguish uneven watering from a temporary signal.",
    source: "Synthetic satellite observation",
    limit:
      "A moisture index is not a direct soil-water measurement. This example has no connection to a real field.",
  },
  {
    title: "Look at the leaves closely.",
    why: "A recorded example mentions yellowing. Take a clear photograph and compare symptoms before deciding what to do.",
    source: "Synthetic farmer observation",
    limit:
      "Yellowing has many causes. A photo suggestion does not confirm disease or prescribe a treatment.",
  },
  {
    title: "Record what you did today.",
    why: "A simple note about watering or field work gives future observations more context.",
    source: "Illustrative record-keeping prompt",
    limit:
      "These next steps are examples of the experience, not advice for your farm.",
  },
];
const START_EVENTS = [
  {
    id: "example-1",
    kind: "farmer_observation",
    observed_at: "2026-09-28T04:30:00Z",
    payload: { note: "Example record: some lower leaves appeared yellow." },
    source: "Synthetic demo",
    source_type: "farmer_reported",
  },
  {
    id: "example-2",
    kind: "irrigation",
    observed_at: "2026-09-26T05:00:00Z",
    payload: { note: "Example record: watered the north section." },
    source: "Synthetic demo",
    source_type: "farmer_reported",
  },
];
function ExampleMap() {
  return (
    <div className="example-field-map">
      <Photo name="fields" sizes="(max-width: 800px) 100vw, 65vw" />
      <svg
        viewBox="0 0 600 340"
        aria-label="Illustrative field boundary, not a real registered farm"
        role="img"
      >
        <path
          d="M110 110 L395 65 L488 220 L175 282 Z"
          fill="#e5f1bd55"
          stroke="#f9ffce"
          strokeWidth="4"
          strokeDasharray="8 5"
        />
        <g fill="#fffbdc">
          {[
            [110, 110],
            [395, 65],
            [488, 220],
            [175, 282],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="7" />
          ))}
        </g>
      </svg>
      <span className="badge">
        Synthetic boundary · illustrative photograph
      </span>
    </div>
  );
}
function Demo() {
  const [view] = useState(() => {
    const value = new URLSearchParams(location.search).get("view");
    return ["today", "farm", "scan", "market", "more"].includes(value)
      ? value
      : "today";
  });
  const [selected, setSelected] = useState(FIELDS[0].id),
    [why, setWhy] = useState(null),
    [record, setRecord] = useState(false),
    [events, setEvents] = useState(START_EVENTS),
    [notice, setNotice] = useState(""),
    [exampleResult, setExampleResult] = useState(false);
  const plot = FIELDS.find((item) => item.id === selected);
  const w = {
    farmer: { display_name: "Example farm" },
    plots: FIELDS,
    selected,
    setSelected,
    offline: false,
    pending: 0,
    notice,
  };
  const pathname = `/app/${view === "scan" ? "health" : view}`;
  return (
    <ProductShell workspace={w} pathname={pathname} demo>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">EXPLORE THE EXPERIENCE</span>
          <h1>
            {view === "today"
              ? "Today on an example farm."
              : view === "farm"
                ? "An example field, in focus."
                : view === "scan"
                  ? "A photo suggestion, explained."
                  : view === "market"
                    ? "An example market snapshot."
                    : "Tools for the days ahead."}
          </h1>
          <p>
            All figures and records below are illustrative. The demo resets when
            you leave.
          </p>
        </div>
        {view === "today" && (
          <button className="button primary" onClick={() => setRecord(true)}>
            <Plus size={18} />
            Try recording an update
          </button>
        )}
      </header>
      {view === "today" && (
        <>
          <div className="context-strip">
            <Sun size={26} />
            <div>
              <strong>{plot.name} · Example tomato crop</strong>
              <span>
                Weather example: 29°C · cloud cover. Synthetic, not a current
                forecast.
              </span>
            </div>
            <a href="/demo?view=farm">
              View example field <ArrowRight size={16} />
            </a>
          </div>
          <div className="section-heading">
            <h2>What might need attention</h2>
            <span className="badge amber">Example next steps</span>
          </div>
          <div className="attention-grid">
            {ACTIONS.map((action, index) => (
              <article className="attention-card" key={action.title}>
                <span className="attention-number">0{index + 1}</span>
                <h3>{action.title}</h3>
                <p>{action.why}</p>
                <button className="text-link" onClick={() => setWhy(action)}>
                  Why this matters <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
          <Timeline items={events} />
        </>
      )}
      {view === "farm" && (
        <>
          <div className="farm-layout">
            <section className="product-card field-list">
              <h2>Example fields</h2>
              {FIELDS.map((field) => (
                <button
                  className={`field-list-item ${selected === field.id ? "selected" : ""}`}
                  key={field.id}
                  onClick={() => setSelected(field.id)}
                  aria-pressed={selected === field.id}
                >
                  <MapPin size={22} />
                  <span>
                    <strong>{field.name}</strong>
                    <small>{field.area} ha · synthetic boundary</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </section>
            <section className="product-card field-overview">
              <div className="section-heading">
                <h2>{plot.name}</h2>
                <Sprout size={25} />
              </div>
              <div className="field-facts">
                <div>
                  <span>Example area</span>
                  <strong>
                    {plot.area} <small>ha</small>
                  </strong>
                </div>
                <div>
                  <span>Example crop</span>
                  <strong>Tomato</strong>
                </div>
              </div>
              <ExampleMap />
              <p className="small muted">
                A real field uses the boundary you provide. This drawing is a
                visual example over a licensed photograph.
              </p>
            </section>
          </div>
          <section className="product-card demo-trend">
            <div>
              <span className="eyebrow">ILLUSTRATIVE CHANGE OVER TIME</span>
              <h2>See change. Ask better questions.</h2>
              <p>
                A trend can prompt a field visit. It cannot establish disease,
                yield or soil nutrients.
              </p>
              <button className="text-link" onClick={() => setWhy(ACTIONS[0])}>
                Understand this example <ArrowRight size={17} />
              </button>
            </div>
            <svg
              viewBox="0 0 440 160"
              role="img"
              aria-label="Synthetic trend illustration without measured data"
            >
              <path
                d="M20 130H425M20 75H425M20 20H425"
                fill="none"
                stroke="#d9e2d6"
              />
              <path
                d="M20 95L100 72L180 85L260 51L340 61L425 29"
                fill="none"
                stroke="#426748"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <text x="20" y="153">
                Earlier
              </text>
              <text x="355" y="153">
                More recent
              </text>
            </svg>
          </section>
        </>
      )}
      {view === "scan" && (
        <div className="scan-layout">
          <section className="product-card camera-card">
            <div className="camera-frame demo-leaf">
              <Photo name="tomatoes" sizes="(max-width: 800px) 100vw, 50vw" />
              <span>Illustrative crop photograph · not analysed</span>
            </div>
            <button
              className="button primary"
              onClick={() => setExampleResult(true)}
            >
              <Camera size={20} />
              Show an example result
            </button>
          </section>
          <section className="product-card scan-details">
            <h2>A suggestion is a starting point.</h2>
            <p>
              A real scan needs your field, a supported crop, a clear
              photograph, permission and a connection.
            </p>
            {exampleResult ? (
              <div className="scan-result">
                <span className="badge amber">Synthetic photo result</span>
                <h3>Example: symptoms may resemble leaf spot.</h3>
                <p>
                  This is written demonstration copy. No model has analysed this
                  stock photograph.
                </p>
                <p>
                  Confirm the symptoms in the field or with an agronomist. There
                  is no treatment or dosage recommendation.
                </p>
                <button
                  className="button secondary"
                  onClick={() =>
                    setNotice(
                      "Example feedback recorded for this visit only. Nothing was sent to an API.",
                    )
                  }
                >
                  <Check size={18} />
                  Try giving feedback
                </button>
              </div>
            ) : (
              <p>Use the button to see how a result explains its limits.</p>
            )}
            <a className="text-link" href="/technology">
              See the real model evidence <ArrowRight size={16} />
            </a>
          </section>
        </div>
      )}
      {view === "market" && (
        <section className="product-card">
          <span className="badge amber">
            Synthetic prices · no live market feed
          </span>
          <h2>Compare place, date and unit.</h2>
          <div className="table-scroll">
            <table className="product-table">
              <caption>
                Illustrative rice price records · 28 September 2026
              </caption>
              <thead>
                <tr>
                  <th>Example market</th>
                  <th>Minimum</th>
                  <th>Maximum</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Market A", 1950, 2150],
                  ["Market B", 2000, 2200],
                  ["Market C", 1850, 2100],
                ].map(([market, min, max]) => (
                  <tr key={market}>
                    <th>{market}</th>
                    <td>₹{min.toLocaleString()}</td>
                    <td>₹{max.toLocaleString()}</td>
                    <td>quintal</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            These numbers are invented examples. Real prices need source, date,
            crop variety and market checks; actual offers may differ.
          </p>
          <a href="/app/market" className="button secondary">
            Open my market workspace <ArrowRight size={18} />
          </a>
        </section>
      )}
      {view === "more" && (
        <div className="more-grid">
          {[
            [
              "/app/more/planning",
              Sprout,
              "Explore a planning scenario",
              "Change assumptions and compare simulated outcomes.",
            ],
            [
              "/how-it-works",
              Droplets,
              "Understand the experience",
              "See the flow from field records to inspection context.",
            ],
            [
              "/app/today",
              Plus,
              "Start my own farm",
              "Sign in when the account service is available.",
            ],
          ].map(([href, Icon, title, description]) => (
            <a className="more-card" key={href} href={href}>
              <Icon size={28} />
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <ArrowRight size={18} />
            </a>
          ))}
        </div>
      )}
      {why && (
        <Dialog title="Why this matters" onClose={() => setWhy(null)}>
          <span className="badge amber">Synthetic evidence</span>
          <h3>{why.title}</h3>
          <p>{why.why}</p>
          <h3>Where this comes from</h3>
          <p>{why.source}</p>
          <h3>Limits</h3>
          <p>{why.limit}</p>
          <button className="button primary" onClick={() => setWhy(null)}>
            Understood
          </button>
        </Dialog>
      )}
      {record && (
        <Dialog title="Try a field update" onClose={() => setRecord(false)}>
          <p>
            This update stays in this demo visit. It is not saved to a farmer
            account.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const note = new FormData(event.currentTarget).get("note").trim();
              if (!note) return;
              setEvents((items) => [
                {
                  id: crypto.randomUUID(),
                  kind: "farmer_observation",
                  observed_at: new Date().toISOString(),
                  payload: { note: `Demo only: ${note}` },
                  source: "Synthetic demo",
                  source_type: "farmer_reported",
                },
                ...items,
              ]);
              setRecord(false);
              setNotice(
                "Demo update added for this visit only. Nothing was sent to an API.",
              );
            }}
          >
            <label className="v2-label">
              What did you notice?
              <textarea name="note" required maxLength={2000} rows={4} />
            </label>
            <button className="button primary">Add example update</button>
          </form>
        </Dialog>
      )}
    </ProductShell>
  );
}
export default function DemoApp() {
  return (
    <I18nProvider>
      <Demo />
    </I18nProvider>
  );
}

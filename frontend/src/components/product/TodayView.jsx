import { useState } from "react";
import { ArrowRight, Plus, Sun, Sprout, Info } from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { deferredFeature } from "../deferredFeature";
import { Dialog } from "./Dialog";
import { Timeline } from "./Timeline";
import { ActionSheet } from "./ActionSheet";
import { WeatherStrip } from "./WeatherStrip";
const LocalReadout = deferredFeature(
  () => import("../../features/farms/LocalReadout"),
);
const NoticeList = deferredFeature(
  () => import("../../features/farms/NoticeList"),
);

export function TodayView({ workspace: w }) {
  const [evidence, setEvidence] = useState(null),
    [recording, setRecording] = useState(false),
    [all, setAll] = useState(false);
  const actions = w.today?.actions || [];
  return (
    <>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <h1>Today on your farm.</h1>
          <p>
            {w.plot
              ? `Your next steps for ${w.plot.name}. Inspect the field before acting.`
              : "Add a field to bring your observations and next steps together."}
          </p>
        </div>
        {w.plot && (
          <button className="button primary" onClick={() => setRecording(true)}>
            <Plus size={18} />
            Record an update
          </button>
        )}
      </header>
      {!w.plot ? (
        <section className="product-card welcome-card">
          <Sprout size={42} />
          <h2>Start with one field.</h2>
          <p>
            Give it a name and an area. You can draw its boundary whenever you
            are ready.
          </p>
          <a className="button primary" href="/app/farm">
            Add my first field <ArrowRight size={18} />
          </a>
          <a className="text-link" href="/demo">
            See an example first
          </a>
        </section>
      ) : (
        <>
          <div className="context-strip">
            <Sun size={24} />
            <div>
              <strong>{w.cycles[0]?.crop || "No crop cycle recorded"}</strong>
              <span>
                {w.cycles[0]
                  ? `Sown ${w.cycles[0].sowing_date} · ${w.cycles[0].growth_stage || "stage not recorded"}`
                  : "Add the crop and sowing date in Farm."}
              </span>
            </div>
            <a href={`/app/farm/${w.selected}`}>
              View field <ArrowRight size={16} />
            </a>
          </div>
          <WeatherStrip
            plotId={w.selected}
            owner={w.farmer.id}
            cache={w.offlineOpt}
          />
          {w.savedAt && (
            <p className="status-panel">
              Saved on this device: {new Date(w.savedAt).toLocaleString()}.
              These next steps reflect that snapshot; confirm current
              conditions.
            </p>
          )}
          <section aria-labelledby="attention-heading">
            <div className="section-heading">
              <h2 id="attention-heading">What needs your attention</h2>
              <span className="badge neutral">
                {w.offline ? "Saved view" : "Source-aware guidance"}
              </span>
            </div>
            {w.evidenceLoading && !w.today ? (
              <div className="product-card" role="status">
                Loading your field context…
              </div>
            ) : actions.length ? (
              <div className="attention-grid">
                {(all ? actions : actions.slice(0, 5)).map((action, index) => (
                  <article
                    className="attention-card"
                    key={`${index}:${action.title}`}
                  >
                    <span className="attention-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{action.title}</h3>
                    <p>{action.why}</p>
                    <button
                      className="text-link"
                      onClick={() => setEvidence(action)}
                    >
                      Why this matters <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="product-card empty-inline">
                <Info size={28} />
                <p>
                  {w.today
                    ? "No next steps are currently stored. This does not confirm that the field is healthy. Keep observing and record anything that changes."
                    : "Field context is unavailable. Your manual observations remain useful."}
                </p>
              </div>
            )}
            {actions.length > 5 && (
              <button className="button text" onClick={() => setAll(!all)}>
                {all ? "Show fewer" : "See all next steps"}
              </button>
            )}
            {actions.length > 0 && (
              <LocalReadout
                text={actions
                  .map(
                    (action) =>
                      `${action.title}. ${action.why}. Source: ${action.evidence.source}. ${action.evidence.limitations.join(". ")}`,
                  )
                  .join(". ")}
              />
            )}
          </section>
          <Timeline
            items={w.timeline}
            busy={w.busy}
            offline={w.offline}
            onMore={() =>
              w.act(async () => {
                const owner = w.ownerRef.current,
                  field = w.selected;
                const records = await farmApi(
                  `/plots/${field}/timeline?offset=${w.timeline.length}`,
                );
                if (
                  w.ownerRef.current === owner &&
                  w.selectedRef.current === field
                )
                  w.setTimeline((values) => [...values, ...records.items]);
              })
            }
          />
          <NoticeList
            owner={w.farmer.id}
            act={w.act}
            busy={w.busy}
            offline={w.offline}
          />
        </>
      )}
      {recording && w.plot && (
        <ActionSheet workspace={w} onClose={() => setRecording(false)} />
      )}{" "}
      {evidence && (
        <Dialog title="Why this matters" onClose={() => setEvidence(null)}>
          <span className="badge neutral">
            {String(evidence.evidence.freshness).replaceAll("_", " ")}
          </span>
          <h3>{evidence.title}</h3>
          <p>{evidence.why}</p>
          <h3>Where this comes from</h3>
          <p>{evidence.evidence.source}</p>
          {evidence.evidence.observed_at && (
            <p>
              Observed{" "}
              {new Date(evidence.evidence.observed_at).toLocaleString()}
            </p>
          )}
          <h3>What to keep in mind</h3>
          <ul>
            {evidence.evidence.limitations.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <p className="status-panel">
            Check the field yourself. This context does not prescribe a
            fertilizer or pesticide dose.
          </p>
          <a className="button secondary" href={`/app/farm/${w.selected}`}>
            View field evidence
          </a>
        </Dialog>
      )}
    </>
  );
}

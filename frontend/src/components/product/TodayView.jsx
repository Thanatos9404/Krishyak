import { useProductLocale } from "../../features/product/ProductLocale";
import { useState } from "react";
import {
  ArrowRight,
  Camera,
  Info,
  Plus,
  Sprout,
  Store,
  Sun,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { deferredFeature } from "../../features/product/deferredProductFeature";
import { Dialog } from "./Dialog";
import { Timeline } from "./Timeline";
import { ActionSheet } from "./ActionSheet";
import { WeatherStrip } from "./WeatherStrip";
import { cropLabel } from "../../features/product/crops";
import { locationFromProfile } from "../../features/product/indiaLocations";
import { MarketPrices, useMarketPrices } from "./MarketView";

function PriceGlance({ w, cycle }) {
  const { tx } = useProductLocale();
  const place = locationFromProfile(w.farmer || {});
  const result = useMarketPrices({
    crop: cycle?.crop_id,
    state: place.state,
    district: place.district,
  });
  if (!cycle) return null;
  return (
    <section className="product-card glance" aria-labelledby="price-heading">
      <h2 id="price-heading">
        <Store size={22} aria-hidden="true" />{" "}
        {tx("{{v0}} price near you", { v0: cropLabel(cycle, tx) })}
      </h2>
      {place.state ? (
        <MarketPrices result={result} crop={cycle.crop_id} compact />
      ) : (
        <p className="inline-note">
          {tx("Add your state and district to see nearby mandi prices.")}{" "}
          <a href="/app/more/settings">{tx("Open settings")}</a>
        </p>
      )}
      <a className="text-link" href="/app/market">
        {tx("All mandi prices")} <ArrowRight size={16} />
      </a>
    </section>
  );
}
const LocalReadout = deferredFeature(
  () => import("../../features/farms/LocalReadout"),
);
const NoticeList = deferredFeature(
  () => import("../../features/farms/NoticeList"),
);
export function TodayView({ workspace: w }) {
  const { tx, formatDate } = useProductLocale();
  const [evidence, setEvidence] = useState(null),
    [recording, setRecording] = useState(false),
    [all, setAll] = useState(false);
  const actions = w.today?.actions || [];
  const cycle =
    w.cycles.find((item) => item.status === "active") || w.cycles[0];
  return (
    <>
      <header className="product-page-heading">
        <div>
          <h1>{tx("Today on your farm.")}</h1>
          <p>
            {w.plot
              ? tx(
                  "Your next steps for {{v0}}. Inspect the field before acting.",
                  {
                    v0: w.plot.name,
                  },
                )
              : tx(
                  "Add a field to bring your observations and next steps together.",
                )}
          </p>
        </div>
        {w.plot && (
          <button className="button primary" onClick={() => setRecording(true)}>
            <Plus size={18} />
            {tx("Record an update")}
          </button>
        )}
      </header>
      {!w.plot ? (
        <section className="product-card welcome-card">
          <Sprout size={42} />
          <h2>{tx("Start with one field.")}</h2>
          <p>
            {tx(
              "Give it a name and an area. You can draw its boundary whenever you are ready.",
            )}
          </p>
          <a className="button primary" href="/app/farm">
            {tx("Add my first field")} <ArrowRight size={18} />
          </a>
          <a className="text-link" href="/demo">
            {tx("See an example first")}
          </a>
        </section>
      ) : (
        <>
          <div className="today-glance">
            <WeatherStrip
              plotId={w.selected}
              plot={w.plot}
              owner={w.farmer.id}
              cache={w.offlineOpt}
              workspace={w}
            />
            <PriceGlance w={w} cycle={cycle} />
          </div>
          <nav className="quick-actions" aria-label={tx("Quick actions")}>
            <button type="button" onClick={() => setRecording(true)}>
              <Plus size={24} aria-hidden="true" />
              {tx("Note what I saw")}
            </button>
            <a href="/app/health">
              <Camera size={24} aria-hidden="true" />
              {tx("Check a sick plant")}
            </a>
            <a href="/app/market">
              <Store size={24} aria-hidden="true" />
              {tx("Mandi prices")}
            </a>
          </nav>
          <div className="context-strip">
            <Sun size={24} />
            <div>
              <strong>
                {cropLabel(w.cycles[0], tx) || tx("No crop cycle recorded")}
              </strong>
              <span>
                {w.cycles[0]
                  ? tx("Sown {{v0}} \xB7 {{v1}}", {
                      v0: formatDate(w.cycles[0].sowing_date),
                      v1: w.cycles[0].growth_stage || tx("Stage not recorded"),
                    })
                  : tx("Add the crop and sowing date in Farm.")}
              </span>
            </div>
            <a href={`/app/farm/${w.selected}`}>
              {tx("View field")} <ArrowRight size={16} />
            </a>
          </div>
          {w.savedAt && (
            <p className="status-panel">
              {tx("Saved on this device:")}{" "}
              {formatDate(w.savedAt, { time: true })}
              {tx(
                ". These next steps reflect that snapshot; confirm current conditions.",
              )}
            </p>
          )}
          <section aria-labelledby="attention-heading">
            <div className="section-heading">
              <h2 id="attention-heading">{tx("What to do next")}</h2>
              {w.offline && (
                <span className="badge neutral">{tx("Saved view")}</span>
              )}
            </div>
            {w.evidenceLoading && !w.today ? (
              <div className="product-card" role="status">
                {tx("Loading your field context\u2026")}
              </div>
            ) : actions.length ? (
              <div className="attention-grid">
                {(all ? actions : actions.slice(0, 5)).map((action, index) => (
                  <article
                    className="attention-card"
                    key={`${index}:${action.title}`}
                  >
                    <h3>{tx(action.title)}</h3>
                    <p>{tx(action.why)}</p>
                    <button
                      className="text-link"
                      onClick={() => setEvidence(action)}
                    >
                      {tx("Why?")} <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="product-card empty-inline">
                <Info size={28} />
                <p>
                  {w.today
                    ? tx(
                        "No next steps are currently stored. This does not confirm that the field is healthy. Keep observing and record anything that changes.",
                      )
                    : tx(
                        "Field context is unavailable. Your manual observations remain useful.",
                      )}
                </p>
              </div>
            )}
            {actions.length > 5 && (
              <button className="button text" onClick={() => setAll(!all)}>
                {all ? tx("Show fewer") : tx("See all next steps")}
              </button>
            )}
            {actions.length > 0 && (
              <LocalReadout
                workspace={w}
                text={actions
                  .map(
                    (action) =>
                      `${tx(action.title)}. ${tx(action.why)}. ${tx("Source")}: ${tx(action.evidence.source)}. ${action.evidence.limitations.map((value) => tx(value)).join(". ")}`,
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
        <Dialog
          title={tx("Why this matters")}
          onClose={() => setEvidence(null)}
        >
          <span className="badge neutral">
            {String(evidence.evidence.freshness).replaceAll("_", " ")}
          </span>
          <h3>{tx(evidence.title)}</h3>
          <p>{tx(evidence.why)}</p>
          <h3>{tx("Where this comes from")}</h3>
          <p>{evidence.evidence.source}</p>
          {evidence.evidence.observed_at && (
            <p>
              {tx("Observed")}{" "}
              {formatDate(evidence.evidence.observed_at, { time: true })}
            </p>
          )}
          <h3>{tx("What to keep in mind")}</h3>
          <ul>
            {evidence.evidence.limitations.map((limit) => (
              <li key={limit}>{tx(limit)}</li>
            ))}
          </ul>
          <p className="status-panel">
            {tx(
              "Check the field yourself. This context does not prescribe a fertilizer or pesticide dose.",
            )}
          </p>
          <a className="button secondary" href={`/app/farm/${w.selected}`}>
            {tx("View field evidence")}
          </a>
        </Dialog>
      )}
    </>
  );
}

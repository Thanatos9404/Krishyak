import { useProductLocale } from "../../features/product/ProductLocale";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Gauge,
  IndianRupee,
  Info,
  Landmark,
  Mic,
  NotebookPen,
  Phone,
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
import {
  SUGGESTIONS,
  useVoiceLauncher,
} from "../../features/product/voiceLauncher";

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
const TILES = [
  ["/app/assessment", Gauge, "My field report", "Harvest, profit, risk", "sky"],
  ["/app/health", Camera, "Check a sick plant", "Photo of a leaf", "leaf"],
  ["/app/market", IndianRupee, "Mandi prices", "Today's rates", "amber"],
  ["#note", NotebookPen, "Note what I saw", "Keep a record", "earth"],
  [
    "/app/more/benefits",
    Landmark,
    "Government schemes",
    "Official help",
    "plum",
  ],
  [
    "tel:18001801551",
    Phone,
    "Call Kisan helpline",
    "Free, 1800-180-1551",
    "brick",
  ],
];

function VoiceHero() {
  const { tx, info } = useProductLocale();
  const openVoice = useVoiceLauncher();
  const still = useReducedMotion();
  if (!openVoice) return null;
  return (
    <section className="voice-hero" aria-labelledby="voice-hero-heading">
      <div className="voice-hero-copy">
        <h2 id="voice-hero-heading">{tx("Ask Krishyak anything")}</h2>
        <p>
          {tx("Speak in {{v0}}. Krishyak listens and answers aloud.", {
            v0: info.nativeName,
          })}
        </p>
        <ul className="voice-hero-examples" aria-label={tx("Try asking")}>
          {SUGGESTIONS.slice(0, 3).map((question) => (
            <li key={question}>“{tx(question)}”</li>
          ))}
        </ul>
      </div>
      <motion.button
        type="button"
        className="voice-hero-mic"
        onClick={openVoice}
        aria-haspopup="dialog"
        whileTap={still ? undefined : { scale: 0.95 }}
      >
        <span className="voice-hero-pulse" aria-hidden="true" />
        <Mic size={44} strokeWidth={1.8} aria-hidden="true" />
        <span>{tx("Tap to speak")}</span>
      </motion.button>
    </section>
  );
}

export function TodayView({ workspace: w }) {
  const { tx, formatDate, info } = useProductLocale();
  const [evidence, setEvidence] = useState(null),
    [recording, setRecording] = useState(false),
    [all, setAll] = useState(false);
  const actions = w.today?.actions || [];
  const cycle =
    w.cycles.find((item) => item.status === "active") || w.cycles[0];
  useEffect(() => {
    if (w.plot && location.hash === "#note") {
      // Open once for a voice-mode link, then forget the request.
      history.replaceState(null, "", location.pathname + location.search);
      setRecording(true);
    }
  }, [w.plot]);
  const today = new Intl.DateTimeFormat(info.speechCode, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return (
    <>
      <header className="home-greeting">
        <span className="home-date">{today}</span>
        <h1>
          {tx("Namaste, {{v0}}", {
            v0: w.farmer.display_name || tx("farmer"),
          })}
        </h1>
        <p>
          {w.plot
            ? tx("Here is today for {{v0}}.", { v0: w.plot.name })
            : tx("Let us set up your first field.")}
        </p>
      </header>
      <VoiceHero />
      <nav className="home-tiles" aria-label={tx("Quick actions")}>
        {TILES.filter(
          ([href]) =>
            (href !== "#note" && href !== "/app/assessment") || w.plot,
        ).map(([href, Icon, title, hint, tone]) =>
          href === "#note" ? (
            <button
              type="button"
              key={href}
              className={`home-tile tone-${tone}`}
              onClick={() => setRecording(true)}
            >
              <Icon size={30} aria-hidden="true" />
              <strong>{tx(title)}</strong>
              <small>{tx(hint)}</small>
            </button>
          ) : (
            <a key={href} href={href} className={`home-tile tone-${tone}`}>
              <Icon size={30} aria-hidden="true" />
              <strong>{tx(title)}</strong>
              <small>{tx(hint)}</small>
            </a>
          ),
        )}
      </nav>
      {!w.plot ? (
        <section className="setup-hero" aria-labelledby="setup-hero-heading">
          <Mic size={40} aria-hidden="true" />
          <div>
            <h2 id="setup-hero-heading">
              {tx("Tell Krishyak about your farm")}
            </h2>
            <p>
              {tx(
                "Say your village, land, crop and soil in your language. Krishyak fills everything in and shows your expected harvest, profit, risks and the schemes for you.",
              )}
            </p>
            <a className="button primary large" href="/app/setup">
              {tx("Speak about my farm")} <ArrowRight size={18} />
            </a>
            <a className="text-link" href="/app/farm">
              {tx("Or add a field by hand")}
            </a>
          </div>
        </section>
      ) : (
        <>
          <div className="today-glance" id="weather">
            <WeatherStrip
              plotId={w.selected}
              plot={w.plot}
              owner={w.farmer.id}
              cache={w.offlineOpt}
              workspace={w}
            />
            <PriceGlance w={w} cycle={cycle} />
          </div>
          <div className="context-strip">
            <Sun size={24} aria-hidden="true" />
            <div>
              <strong>
                {cropLabel(w.cycles[0], tx) || tx("No crop cycle recorded")}
              </strong>
              <span>
                {w.cycles[0]
                  ? tx("Sown {{v0}} · {{v1}}", {
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

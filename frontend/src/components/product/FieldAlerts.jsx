import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Droplets,
  Eye,
  Radar,
  Shovel,
  Sprout,
  Wheat,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { ConsentPrompt, useGrant } from "../../features/farms/ConsentPrompt";
import { useProductLocale } from "../../features/product/ProductLocale";
import { PictureSteps } from "../../features/product/PictureGuide";
import { cropLabel, findCrop } from "../../features/product/crops";

function useFieldRecord(path, deps) {
  const [record, setRecord] = useState(null);
  useEffect(() => {
    setRecord(null);
    if (!path) return undefined;
    const controller = new AbortController();
    farmApi(path, { signal: controller.signal })
      .then(setRecord)
      .catch(() => setRecord(null));
    return () => controller.abort();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return record;
}

// Pest Radar: an early warning when a disease is spreading within 10 km.
export function usePestRadar(w) {
  return useFieldRecord(
    w.selected && !w.offline ? `/plots/${w.selected}/pest-radar` : null,
    [
      w.selected,
      w.offline,
      w.consents.includes("location_processing"),
      w.consents.includes("community_alerts"),
    ],
  );
}

// ``show`` picks the part to render: "alert" leads the page, "status" sits lower.
export function RadarCard({ workspace: w, radar, show }) {
  const { tx } = useProductLocale();
  const grant = useGrant(w);
  if (!radar || radar.status === "needs_crop") return null;
  if ((radar.status === "alert") !== (show === "alert")) return null;
  if (radar.status === "needs_permission")
    return (
      <ConsentPrompt
        workspace={w}
        purposes={["location_processing"]}
        title="Get disease alerts for this field"
        reason="Krishyak uses this field's rough location to warn you when a crop disease is spreading within 10 km."
      />
    );
  if (radar.status === "needs_location")
    return (
      <p className="inline-note">
        <Radar size={18} aria-hidden="true" />{" "}
        {tx(
          "Add this field's location to get disease alerts from nearby farms.",
        )}{" "}
        <a href={`/app/farm/${w.selected}`}>{tx("Open field")}</a>
      </p>
    );
  const crop = cropLabel(findCrop(radar.crop_id), tx);
  if (radar.status !== "alert")
    return (
      <section className="radar-quiet" aria-label={tx("Pest Radar")}>
        <Radar size={22} aria-hidden="true" />
        <p>
          <strong>
            {tx("No disease alerts for {{v0}} within 10 km.", { v0: crop })}
          </strong>{" "}
          {radar.sharing
            ? tx(
                "Your photo checks help warn your neighbours, without your name.",
              )
            : tx(
                "Share your photo-check results, without your name, to warn nearby farmers too.",
              )}
        </p>
        {!radar.sharing && (
          <button
            type="button"
            className="button secondary"
            disabled={w.busy || w.offline}
            onClick={() => grant(["community_alerts"])}
          >
            {tx("Share to help neighbours")}
          </button>
        )}
      </section>
    );
  return (
    <section className="radar-alert" aria-labelledby="radar-heading">
      <h2 id="radar-heading">
        <BellRing size={26} aria-hidden="true" /> {tx("Disease alert near you")}
      </h2>
      {radar.alerts.map((alert) => (
        <article key={alert.disease}>
          <h3>{tx(alert.name)}</h3>
          <p>
            {tx(
              "{{v0}} or more farms within 10 km found this on {{v1}} in the last two weeks.",
              { v0: alert.farms_at_least, v1: crop },
            )}{" "}
            {alert.rising && tx("It is spreading this week.")}{" "}
            {alert.urgent &&
              tx("This disease moves fast. Check your crop today.")}
          </p>
          <PictureSteps
            steps={alert.steps.slice(0, 3)}
            label={tx("How to protect your crop")}
          />
        </article>
      ))}
      <a className="button primary large" href="/app/health">
        {tx("Check my crop with a photo")} <ArrowRight size={18} />
      </a>
      <p className="small">
        {tx(
          "From photo checks by nearby farmers who chose to share. No names or places are shown. It is a warning, not a diagnosis of your field.",
        )}
      </p>
    </section>
  );
}

const KINDS = {
  water: [Droplets, "Water"],
  weed: [Shovel, "Weed"],
  thin: [Sprout, "Thin"],
  watch: [Eye, "Watch"],
  harvest: [Wheat, "Harvest"],
};

// Crop calendar: what the crop usually needs this week, counted from sowing.
export function CalendarCard({ workspace: w }) {
  const { tx, formatDate } = useProductLocale();
  const plan = useFieldRecord(
    w.selected && !w.offline ? `/plots/${w.selected}/calendar` : null,
    [w.selected, w.offline, w.cycles?.[0]?.id],
  );
  if (!plan || plan.status !== "available") return null;
  const crop = cropLabel(findCrop(plan.crop_id), tx);
  const row = (item, when) => {
    const [Icon, label] = KINDS[item.kind] || KINDS.watch;
    return (
      <li key={item.task} className={`calendar-${item.kind}`}>
        <span className="calendar-icon">
          <Icon size={24} aria-hidden="true" />
          <span>{tx(label)}</span>
        </span>
        <span>
          <strong>{when}</strong>
          {tx(item.task)}
        </span>
      </li>
    );
  };
  return (
    <section
      className="product-card calendar-card"
      aria-labelledby="calendar-heading"
    >
      <h2 id="calendar-heading">
        <CalendarDays size={22} aria-hidden="true" />{" "}
        {tx("This week on your {{v0}}", { v0: crop })}
      </h2>
      <p className="calendar-day">
        {plan.counted_from === "transplanting"
          ? tx("Day {{v0}} after transplanting", { v0: plan.day })
          : tx("Day {{v0}} after sowing", { v0: plan.day })}
      </p>
      <ul className="calendar-list">
        {plan.now.map((item) => row(item, tx("Do this week")))}
        {plan.next &&
          row(
            plan.next,
            plan.next.in_days <= 1
              ? tx("Tomorrow")
              : tx("In {{v0}} days ({{v1}})", {
                  v0: plan.next.in_days,
                  v1: formatDate(plan.next.from),
                }),
          )}
        {!plan.now.length && !plan.next && (
          <li>
            {tx(
              "The season's tasks are done. Record your harvest in your field notes.",
            )}
          </li>
        )}
      </ul>
      <p className="small muted">
        {tx(
          "General reminders for this crop. The weather and your local agriculture officer come first.",
        )}
      </p>
    </section>
  );
}

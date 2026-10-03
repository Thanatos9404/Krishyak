import {
  Sprout,
  CloudSun,
  Droplets,
  Camera,
  ClipboardCheck,
  Circle,
} from "lucide-react";
export const EVENT_NAMES = {
  farmer_observation: "Field observation",
  soil: "Soil record",
  pest_report: "Pest spotted",
  irrigation: "Watering recorded",
  fertilizer_action: "Fertilizer applied",
  harvest: "Harvest recorded",
  market_sale: "Produce sold",
  advisory_acknowledgement: "Advice reviewed",
  follow_up: "Follow-up check",
  crop_loss: "Crop loss reported",
  actual_cost: "Expense recorded",
  treatment_action: "Treatment recorded",
  satisfaction: "Experience feedback",
  advisory_usefulness: "Advice feedback",
  remote_sensing: "Satellite observation",
  weather: "Weather context",
  disease_scan: "Crop photograph",
};
const ICONS = {
  remote_sensing: Sprout,
  weather: CloudSun,
  disease_scan: Camera,
  irrigation: Droplets,
  farmer_observation: ClipboardCheck,
};
export function eventDescription(item) {
  const data = item.payload || {};
  if (data.note) return data.note;
  if (item.kind === "remote_sensing")
    return "Satellite evidence is available for review. Check its date, coverage and quality before acting.";
  if (item.kind === "weather")
    return "Forecast retrieved. Local conditions may differ from the weather model.";
  if (item.kind === "disease_scan")
    return `Photo analysis ${String(data.status || data.result?.status || "recorded").replaceAll("_", " ")}. Confirm symptoms in the field.`;
  if (Array.isArray(data.measurements))
    return data.measurements
      .map(
        (row) =>
          `${row.parameter.replaceAll("_", " ")}: ${row.value} ${row.unit}`,
      )
      .join(" · ");
  return "Saved evidence. Review the source and its limitations.";
}
export function Timeline({ items, onMore, busy, offline }) {
  return (
    <section className="product-card timeline">
      <header className="section-heading">
        <div>
          <span className="eyebrow">YOUR FIELD RECORD</span>
          <h2>What happened, and when.</h2>
        </div>
      </header>
      {items.length ? (
        <ol>
          {items.map((item) => {
            const Icon = ICONS[item.kind] || Circle;
            return (
              <li key={item.id}>
                <span className="timeline-icon">
                  <Icon size={18} />
                </span>
                <div>
                  <h3>{EVENT_NAMES[item.kind] || "Field update"}</h3>
                  <time dateTime={item.observed_at}>
                    {new Date(item.observed_at).toLocaleString()}
                  </time>
                  <p>{eventDescription(item)}</p>
                  <details>
                    <summary>Source details</summary>
                    <p>
                      {item.source_type?.replaceAll("_", " ")} · {item.source}
                    </p>
                  </details>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="empty-inline">
          <ClipboardCheck size={30} />
          <p>
            No field updates yet. Record what you notice and build a useful
            history.
          </p>
        </div>
      )}
      {items.length > 0 && items.length % 20 === 0 && (
        <button
          className="button secondary"
          disabled={busy || offline}
          onClick={onMore}
        >
          Load earlier updates
        </button>
      )}
    </section>
  );
}

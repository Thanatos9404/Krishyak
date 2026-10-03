import { useProductLocale } from "../../features/product/ProductLocale";
import { useState } from "react";
import {
  ClipboardCheck,
  Droplets,
  Bug,
  Sprout,
  Package,
  IndianRupee,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { OUTCOMES } from "../../features/product/useWorkspace";
import { EVENT_NAMES } from "./Timeline";
import { Dialog } from "./Dialog";
const CHOICES = [
  ["farmer_observation", ClipboardCheck, "Something I noticed"],
  ["irrigation", Droplets, "I watered the field"],
  ["pest_report", Bug, "I spotted pests"],
  ["fertilizer_action", Sprout, "I applied fertilizer"],
  ["harvest", Package, "I harvested a crop"],
  ["market_sale", IndianRupee, "I sold produce"],
  ["soil", Sprout, "I have a soil result"],
  ["follow_up", ClipboardCheck, "I checked again"],
  ["actual_cost", IndianRupee, "I paid an expense"],
  ["crop_loss", Sprout, "I lost some crop"],
  ["treatment_action", ClipboardCheck, "I used a treatment"],
  ["advisory_acknowledgement", ClipboardCheck, "I reviewed advice"],
  ["satisfaction", MessageSquare, "Share my experience"],
  ["advisory_usefulness", MessageSquare, "Rate some advice"],
];
export function ActionSheet({ workspace: w, onClose }) {
  const { tx } = useProductLocale();
  const [kind, setKind] = useState(null),
    [note, setNote] = useState(""),
    [value, setValue] = useState("");
  return (
    <Dialog
      title={kind ? EVENT_NAMES[kind] : tx("What would you like to record?")}
      onClose={onClose}
      className="action-sheet"
    >
      {!kind ? (
        <div className="action-picker">
          {CHOICES.map(([id, Icon, label]) => (
            <button key={id} type="button" onClick={() => setKind(id)}>
              <Icon size={23} />
              <span>{tx(label)}</span>
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            w.act(async () => {
              await w.recordObservation({
                kind,
                note,
                value,
              });
              onClose();
            });
          }}
        >
          <button
            className="button text"
            type="button"
            onClick={() => setKind(null)}
          >
            <ArrowLeft size={16} />
            {tx("Choose a different update")}
          </button>
          <p>
            {tx("For")} <strong>{w.plot.name}</strong>
            {tx(". Your record describes what you observed.")}
          </p>
          {OUTCOMES[kind] && (
            <label className="v2-label">
              {tx("Amount (")}
              {OUTCOMES[kind][1]}
              {tx(") \xB7 optional")}
              <input
                type="number"
                step="any"
                min={
                  ["satisfaction", "advisory_usefulness"].includes(kind) ? 1 : 0
                }
                max={
                  kind === "crop_loss"
                    ? 100
                    : ["satisfaction", "advisory_usefulness"].includes(kind)
                      ? 5
                      : 1000000000
                }
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          )}
          <label className="v2-label">
            {tx("What happened?")}
            <textarea
              required
              maxLength={2000}
              rows={4}
              placeholder={tx("Describe what you saw or did…")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {w.error && (
            <p role="alert" className="error-panel">
              {tx(w.error)}
            </p>
          )}
          <button
            className="button primary"
            disabled={
              w.busy ||
              (!w.consents.includes("agronomic_analysis") && !w.offline)
            }
          >
            {tx("Save field update")}
          </button>
          {!w.consents.includes("agronomic_analysis") && !w.offline && (
            <p>
              {tx("Enable field analysis in")}{" "}
              <a href="/app/more/settings">{tx("Settings")}</a>{" "}
              {tx("to save observations.")}
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}

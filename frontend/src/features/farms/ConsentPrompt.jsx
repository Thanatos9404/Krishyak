import { ShieldCheck } from "lucide-react";
import { useProductLocale } from "../product/ProductLocale";
import { farmApi } from "./api";

// Explicit, purpose-specific permission asked at the moment it is needed.
// Each permission stays revocable in Settings.
export function useGrant(w) {
  return (purposes) =>
    w.act(async () => {
      for (const purpose of purposes)
        if (!w.consents.includes(purpose))
          await farmApi("/consents", {
            method: "POST",
            body: { purpose, granted: true, policy_version: "2026-10-03" },
          });
      await w.loadConsents();
    });
}

export function ConsentPrompt({
  workspace: w,
  purposes,
  title,
  reason,
  children,
}) {
  const { tx } = useProductLocale();
  const grant = useGrant(w);
  const missing = purposes.filter((purpose) => !w.consents.includes(purpose));
  if (!missing.length) return children ?? null;
  return (
    <div className="consent-prompt">
      <ShieldCheck size={22} aria-hidden="true" />
      <div>
        <strong>{tx(title)}</strong>
        <p>{tx(reason)}</p>
        <div className="button-row">
          <button
            type="button"
            className="button primary"
            disabled={w.busy || w.offline}
            onClick={() => grant(missing)}
          >
            {tx("Allow")}
          </button>
          <a className="text-link" href="/app/more/settings">
            {tx("See all permissions")}
          </a>
        </div>
      </div>
    </div>
  );
}

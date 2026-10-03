import { Download, LogOut, ShieldCheck } from "lucide-react";
import { useConsentChanges } from "../../features/product/useConsentChanges";
import { farmApi } from "../../features/farms/api";
import { clearOwner } from "../../features/farms/offline";
import { useTranslation } from "../../i18n";
import { deferredFeature } from "../deferredFeature";
const AccountDetails = deferredFeature(
  () => import("../../features/farms/AccountDetails"),
);
const PendingPanel = deferredFeature(
  () => import("../../features/farms/PendingPanel"),
);
const PURPOSES = [
  [
    "location_processing",
    "Use my field location",
    "Enables location-based context for fields you provide.",
  ],
  [
    "satellite_processing",
    "Retrieve satellite observations",
    "Uses your mapped boundary when the satellite service is configured.",
  ],
  [
    "agronomic_analysis",
    "Analyse my field records and photos",
    "Enables observations and crop-photo suggestions.",
  ],
  [
    "model_improvement",
    "Contribute to model improvement",
    "Optional. Separate from using the crop-photo service.",
  ],
  [
    "pilot_research",
    "Participate in pilot research",
    "Optional. Pilot enrollment and field selection remain separate.",
  ],
];
export function SettingsView({ workspace: w }) {
  const { language } = useTranslation();
  const { states: permissionChanges, change: changePermission } =
    useConsentChanges(w);
  return (
    <>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">CLEAR CHOICES, ALWAYS</span>
          <h1>Your account. Your decisions.</h1>
          <p>
            Choose which services may use your records, and what this device
            stores.
          </p>
        </div>
        <ShieldCheck size={30} />
      </header>
      <section className="product-card">
        <h2>Privacy & permissions</h2>
        <p>
          Turn on only the services you want to use. Research participation is
          optional.
        </p>
        <div className="consent-list">
          {PURPOSES.map(([purpose, title, description]) => (
            <div
              key={purpose}
              aria-busy={Boolean(permissionChanges[purpose]?.saving)}
            >
              <label className="consent-row">
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <input
                  type="checkbox"
                  checked={
                    permissionChanges[purpose]?.saving
                      ? permissionChanges[purpose].granted
                      : w.consents.includes(purpose)
                  }
                  disabled={
                    w.busy ||
                    w.offline ||
                    Boolean(permissionChanges[purpose]?.saving)
                  }
                  aria-busy={Boolean(permissionChanges[purpose]?.saving)}
                  onChange={(event) => {
                    const granted = event.target.checked;
                    void changePermission(purpose, granted);
                  }}
                />
              </label>
              {permissionChanges[purpose]?.saving && (
                <p role="status">Saving your permission choice…</p>
              )}
              {permissionChanges[purpose]?.error && (
                <div role="alert">
                  <p>{permissionChanges[purpose].error}</p>
                  <button
                    className="button secondary"
                    disabled={w.offline || w.busy}
                    onClick={() =>
                      changePermission(
                        purpose,
                        permissionChanges[purpose].granted,
                      )
                    }
                  >
                    Retry permission choice
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {w.offline && (
          <p role="status">
            Connect to the internet to change permissions. Your saved choices
            still apply.
          </p>
        )}
        <p className="small muted">
          Withdrawing research permissions stops future research linkage and
          review.
        </p>
      </section>
      <section className="product-card">
        <h2>Saved on this device</h2>
        <label className="consent-row">
          <span>
            <strong>Keep farm records for offline use</strong>
            <small>
              Optional on a private device. Records expire after seven days.
              Photographs are not saved offline.
            </small>
          </span>
          <input
            type="checkbox"
            checked={w.offlineOpt}
            disabled={w.busy}
            onChange={(event) => w.enableOffline(event.target.checked)}
          />
        </label>
        <p>
          {w.pending
            ? `${w.pending} update${w.pending === 1 ? "" : "s"} waiting to sync.`
            : "All recorded updates have been sent, or there are no queued updates."}
        </p>
        <button
          className="button secondary"
          disabled={w.busy || !w.pending}
          onClick={() => w.act(w.sync)}
        >
          Sync saved updates
        </button>
        <details>
          <summary>Advanced sync details</summary>
          <PendingPanel
            owner={w.farmer.id}
            count={w.pending}
            onChanged={w.setPending}
          />
        </details>
      </section>
      <section className="product-card">
        <AccountDetails
          farmer={w.farmer}
          language={language}
          plots={w.plots}
          consents={w.consents}
          act={w.act}
          busy={w.busy}
          offline={w.offline}
          onUpdated={(updated) => {
            if (w.ownerRef.current === updated.id) w.setFarmer(updated);
          }}
        />
      </section>
      <section className="product-card">
        <h2>Account controls</h2>
        <div className="button-row">
          <button
            className="button secondary"
            disabled={w.busy || w.offline}
            onClick={() =>
              w.act(async () => {
                const data = await farmApi("/me/export"),
                  url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    }),
                  );
                const link = document.createElement("a");
                link.href = url;
                link.download = "krishyak-account.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            <Download size={18} />
            Download my account data
          </button>
          <button
            className="button secondary"
            disabled={w.busy}
            onClick={w.signOut}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
        <details className="danger-details">
          <summary>Delete my account</summary>
          <p>
            This permanently removes the account and its farm records; private
            photograph removal is queued. This cannot be undone.
          </p>
          <button
            className="button danger"
            disabled={w.busy || w.offline}
            onClick={() =>
              w.act(async () => {
                if (
                  !window.confirm(
                    "Permanently delete your account, fields and records? This cannot be undone.",
                  )
                )
                  return;
                const owner = w.farmer.id;
                await farmApi("/me", { method: "DELETE" });
                w.clearSession();
                await clearOwner(owner, true);
                location.reload();
              })
            }
          >
            Permanently delete account
          </button>
        </details>
        <p className="small">
          <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms</a> ·
          Draft policies require legal review before commercial release.
        </p>
      </section>
    </>
  );
}

import {
  Sun,
  Map,
  ScanLine,
  Store,
  Ellipsis,
  ArrowUpRight,
  WifiOff,
  CircleCheck,
  Settings,
} from "lucide-react";
import { Brand } from "../public/Brand";
import LanguageSelector from "../LanguageSelector";
const NAV = [
  ["/app/today", Sun, "Today"],
  ["/app/farm", Map, "Farm"],
  ["/app/health", ScanLine, "Scan"],
  ["/app/market", Store, "Market"],
  ["/app/more", Ellipsis, "More"],
];
export function ProductShell({
  workspace: w,
  pathname,
  children,
  demo = false,
  institution = false,
}) {
  const nav = (location) => (
    <nav
      className={`product-nav ${location}`}
      aria-label={
        location === "desktop-nav"
          ? "Workspace navigation"
          : "Mobile workspace navigation"
      }
    >
      {NAV.map(([href, Icon, title]) => (
        <a
          href={demo ? `/demo?view=${title.toLowerCase()}` : href}
          key={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
        >
          <Icon size={23} />
          <span>{title}</span>
        </a>
      ))}
    </nav>
  );
  return (
    <div
      className={`product-shell ${demo ? "demo-shell" : ""} ${institution ? "institution-shell" : ""}`}
    >
      <a href="#workspace-content" className="skip-link">
        Skip to workspace
      </a>
      <aside className="product-sidebar">
        <Brand />
        <span className="sidebar-caption">
          {institution ? "INSTITUTIONAL WORKSPACE" : "YOUR FIELD COMPANION"}
        </span>
        {!institution && nav("desktop-nav")}
        <div className="sidebar-bottom">
          <a href="/how-it-works">
            How it works <ArrowUpRight size={17} />
          </a>
          <a href="/">
            Back to website <ArrowUpRight size={17} />
          </a>
          <p>
            Observe. Understand.
            <br />
            Verify in the field.
          </p>
        </div>
      </aside>
      <div className="product-body">
        <header className="workspace-topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          {w.farmer && !institution && (
            <label className="workspace-field-picker">
              <Map size={19} />
              <select
                aria-label="Selected field"
                value={w.selected}
                onChange={(event) => w.setSelected(event.target.value)}
              >
                <option value="">Select a field</option>
                {w.plots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="workspace-tools">
            {!demo && <LanguageSelector />}
            {w.farmer && (
              <a
                className="account-link"
                href="/app/more/settings"
                aria-label="Account and settings"
              >
                <Settings size={20} />
                <span>{w.farmer.display_name || "My account"}</span>
              </a>
            )}
            {!w.farmer && !demo && (
              <a className="button secondary" href="/app/today">
                Sign in
              </a>
            )}
          </div>
        </header>
        {demo && (
          <div className="demo-banner" role="status">
            <span>
              <strong>Illustrative demo</strong> · Synthetic records. Nothing
              here is your farm or a live recommendation.
            </span>
            <a href="/app/today">
              Start my farm <ArrowUpRight size={17} />
            </a>
          </div>
        )}
        {w.farmer && !demo && (
          <div
            className={`connection-status ${w.offline ? "disconnected" : ""}`}
            role="status"
          >
            {w.offline ? <WifiOff size={16} /> : <CircleCheck size={16} />}
            <span>
              {w.offline ? "Offline · showing saved records" : "Connected"}
              {w.pending > 0 ? ` · ${w.pending} waiting to sync` : ""}
            </span>
            {w.pending > 0 && (
              <button disabled={w.busy} onClick={() => w.act(w.sync)}>
                Sync now
              </button>
            )}
          </div>
        )}
        <main id="workspace-content" className="workspace-content" lang="en">
          {w.status?.development_identity && (
            <p role="status" className="status-panel">
              Development account service · test data only.
            </p>
          )}
          {w.error && (
            <div role="alert" className="error-panel">
              {w.error}{" "}
              <button className="button text" onClick={() => location.reload()}>
                Retry
              </button>
            </div>
          )}
          {w.notice && (
            <p role="status" className="status-panel">
              {w.notice}
            </p>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          Field context supports your judgement. Verify before acting.{" "}
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
        </footer>
      </div>
      {!institution && nav("mobile-nav")}
    </div>
  );
}

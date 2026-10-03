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
import { ProductLanguageChooser } from "./ProductLanguageChooser";
import { useProductLocale } from "../../features/product/ProductLocale";
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
  const { tx, info } = useProductLocale();
  const nav = (location) => (
    <nav
      className={`product-nav ${location}`}
      aria-label={
        location === "desktop-nav"
          ? tx("Workspace navigation")
          : tx("Mobile workspace navigation")
      }
    >
      {NAV.map(([href, Icon, title]) => (
        <a
          href={demo ? `/demo?view=${title.toLowerCase()}` : href}
          key={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
        >
          <Icon size={23} />
          <span>{tx(title)}</span>
        </a>
      ))}
    </nav>
  );
  return (
    <div
      className={`product-shell ${demo ? "demo-shell" : ""} ${institution ? "institution-shell" : ""}`}
    >
      <a href="#workspace-content" className="skip-link">
        {tx("Skip to workspace")}
      </a>
      <aside className="product-sidebar">
        <Brand />
        <span className="sidebar-caption">
          {institution
            ? tx("INSTITUTIONAL WORKSPACE")
            : tx("YOUR FIELD COMPANION")}
        </span>
        {!institution && nav("desktop-nav")}
        <div className="sidebar-bottom">
          <a href="/how-it-works">
            {tx("How it works")} <ArrowUpRight size={17} />
          </a>
          <a href="/">
            {tx("Back to website")} <ArrowUpRight size={17} />
          </a>
          <p>
            {tx("Observe. Understand.")}
            <br />
            {tx("Verify in the field.")}
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
                aria-label={tx("Selected field")}
                value={w.selected}
                onChange={(event) => w.setSelected(event.target.value)}
              >
                <option value="">{tx("Select a field")}</option>
                {w.plots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="workspace-tools">
            {!demo && <ProductLanguageChooser />}
            {w.farmer && (
              <a
                className="account-link"
                href="/app/more/settings"
                aria-label={tx("Account and settings")}
              >
                <Settings size={20} />
                <span>{w.farmer.display_name || tx("My account")}</span>
              </a>
            )}
            {!w.farmer && !demo && (
              <a className="button secondary" href="/app/today">
                {tx("Sign in")}
              </a>
            )}
          </div>
        </header>
        {demo && (
          <div className="demo-banner" role="status">
            <span>
              <strong>{tx("Illustrative demo")}</strong>{" "}
              {tx(
                "\xB7 Synthetic records. Nothing here is your farm or a live recommendation.",
              )}
            </span>
            <a href="/app/today">
              {tx("Start my farm")} <ArrowUpRight size={17} />
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
              {w.offline
                ? tx("Offline · showing saved records")
                : tx("Connected")}
              {w.pending > 0
                ? tx(" \xB7 {{v0}} waiting to sync", {
                    v0: w.pending,
                  })
                : ""}
            </span>
            {w.pending > 0 && (
              <button disabled={w.busy} onClick={() => w.act(w.sync)}>
                {tx("Sync now")}
              </button>
            )}
          </div>
        )}
        <main
          id="workspace-content"
          className="workspace-content"
          lang={info.speechCode}
          dir={info.direction}
        >
          {w.status?.development_identity && (
            <p role="status" className="status-panel">
              {tx("Development account service \xB7 test data only.")}
            </p>
          )}
          {w.error && (
            <div role="alert" className="error-panel">
              {tx(w.error)}{" "}
              <button className="button text" onClick={() => location.reload()}>
                {tx("Retry")}
              </button>
            </div>
          )}
          {w.notice && (
            <p role="status" className="status-panel">
              {tx(w.notice)}
            </p>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          {tx("Field context supports your judgement. Verify before acting.")}{" "}
          <a href="/privacy">{tx("Privacy")}</a> ·{" "}
          <a href="/terms">{tx("Terms")}</a>
        </footer>
      </div>
      {!institution && nav("mobile-nav")}
    </div>
  );
}

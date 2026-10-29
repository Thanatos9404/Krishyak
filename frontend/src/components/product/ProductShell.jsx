import {
  ArrowLeft,
  CircleCheck,
  House,
  IndianRupee,
  LayoutGrid,
  Leaf,
  Map,
  Mic,
  Settings,
  WifiOff,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Brand } from "../public/Brand";
import { ProductLanguageChooser } from "./ProductLanguageChooser";
import { useProductLocale } from "../../features/product/ProductLocale";
import { useCallback, useEffect, useState } from "react";
import { deferredFeature } from "../../features/product/deferredProductFeature";
import { voiceEligible } from "../../features/product/voiceValues";
import { VoiceLauncher } from "../../features/product/voiceLauncher";
const FormVoiceInput = deferredFeature(() =>
  import("./FormVoiceInput").then((module) => ({
    default: module.FormVoiceInput,
  })),
);
const VoiceMode = deferredFeature(() =>
  import("./VoiceMode").then((module) => ({ default: module.VoiceMode })),
);
// [path, icon, label, demo view]
const NAV = [
  ["/app/today", House, "Home", "today"],
  ["/app/health", Leaf, "Plant check", "scan"],
  ["/app/market", IndianRupee, "Mandi prices", "market"],
  ["/app/farm", Map, "My fields", "farm"],
  ["/app/more", LayoutGrid, "More", "more"],
];
export function ProductShell({
  workspace: w,
  pathname,
  children,
  demo = false,
  institution = false,
}) {
  const { tx, info } = useProductLocale();
  const [voiceTarget, setVoiceTarget] = useState(null),
    [voiceOpen, setVoiceOpen] = useState(false);
  const signedOut = !w.farmer && !demo;
  const voiceReady = Boolean(w.farmer) && !demo && !institution;
  const openVoice = useCallback(() => setVoiceOpen(true), []);
  useEffect(() => {
    if (voiceReady && location.hash === "#voice") {
      history.replaceState(null, "", location.pathname + location.search);
      setVoiceOpen(true);
    }
  }, [voiceReady]);
  const link = (href, view) => (demo ? `/demo?view=${view}` : href);
  const current = (href) =>
    href === "/app/today"
      ? pathname === href || pathname === "/app"
      : pathname.startsWith(href);
  const mic = (className) =>
    voiceReady && (
      <button
        key={className}
        type="button"
        className={className}
        onClick={openVoice}
        aria-haspopup="dialog"
      >
        <Mic size={className === "nav-mic" ? 30 : 24} aria-hidden="true" />
        <span>{tx("Ask Krishyak")}</span>
      </button>
    );
  return (
    <VoiceLauncher.Provider value={voiceReady ? openVoice : null}>
      <div
        className={`product-shell ${demo ? "demo-shell" : ""} ${institution ? "institution-shell" : ""} ${signedOut ? "signed-out-shell" : ""}`}
      >
        <a href="#workspace-content" className="skip-link">
          {tx("Skip to workspace")}
        </a>
        {!signedOut && (
          <aside className="product-sidebar">
            <Brand />
            <span className="sidebar-caption">
              {institution
                ? tx("INSTITUTIONAL WORKSPACE")
                : tx("YOUR FARMING HELPER")}
            </span>
            {mic("sidebar-mic")}
            {!institution && (
              <nav
                className="product-nav desktop-nav"
                aria-label={tx("Workspace navigation")}
              >
                {NAV.map(([href, Icon, title, view]) => (
                  <a
                    href={link(href, view)}
                    key={href}
                    aria-current={current(href) ? "page" : undefined}
                  >
                    <Icon size={23} aria-hidden="true" />
                    <span>{tx(title)}</span>
                  </a>
                ))}
              </nav>
            )}
            <div className="sidebar-bottom">
              <a href="tel:18001801551" className="helpline-link">
                {tx("Kisan Call Centre")}
                <strong>1800-180-1551</strong>
              </a>
              <a href="/">{tx("Krishyak home page")}</a>
            </div>
          </aside>
        )}
        <div className="product-body">
          <header className="workspace-topbar">
            <div className="mobile-brand">
              <Brand />
            </div>
            {signedOut && (
              <a className="back-home" href="/">
                <ArrowLeft size={18} aria-hidden="true" />
                {tx("Home page")}
              </a>
            )}
            {w.farmer && !institution && w.plots.length > 0 && (
              <label className="workspace-field-picker">
                <Map size={19} aria-hidden="true" />
                <span className="sr-only">{tx("Selected field")}</span>
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
              {!signedOut && !institution && (
                <a
                  className="mobile-more"
                  href={link("/app/more", "more")}
                  aria-current={current("/app/more") ? "page" : undefined}
                >
                  <LayoutGrid size={20} aria-hidden="true" />
                  <span>{tx("More")}</span>
                </a>
              )}
              {!demo && <ProductLanguageChooser />}
              {w.farmer && (
                <a
                  className="account-link"
                  href="/app/more/settings"
                  aria-label={tx("Account and settings")}
                >
                  <Settings size={20} aria-hidden="true" />
                  <span>{w.farmer.display_name || tx("My account")}</span>
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
              <a href="/app/today">{tx("Start my farm")}</a>
            </div>
          )}
          {w.farmer && !demo && (w.offline || w.pending > 0) && (
            <div
              className={`connection-status ${w.offline ? "disconnected" : ""}`}
              role="status"
            >
              {w.offline ? (
                <WifiOff size={16} aria-hidden="true" />
              ) : (
                <CircleCheck size={16} aria-hidden="true" />
              )}
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
            onFocusCapture={(event) => {
              if (voiceEligible(event.target)) setVoiceTarget(event.target);
            }}
          >
            {w.status?.development_identity && (
              <p role="status" className="status-panel">
                {tx("Development account service \xB7 test data only.")}
              </p>
            )}
            {w.error && (
              <div role="alert" className="error-panel">
                {tx(w.error)}{" "}
                <button
                  className="button text"
                  onClick={() => location.reload()}
                >
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
            {!demo && !institution && w.farmer && voiceTarget && (
              <FormVoiceInput target={voiceTarget} workspace={w} />
            )}
          </main>
          <footer className="workspace-footer">
            {tx("Krishyak gives guidance. Check your field before acting.")}{" "}
            <a href="/privacy">{tx("Privacy")}</a> ·{" "}
            <a href="/terms">{tx("Terms")}</a>
          </footer>
        </div>
        {!institution && !signedOut && (
          <nav
            className="product-nav mobile-nav"
            aria-label={tx("Mobile workspace navigation")}
          >
            {NAV.slice(0, 4).flatMap(([href, Icon, title, view], index) => [
              index === 2 ? mic("nav-mic") : null,
              <a
                key={href}
                href={link(href, view)}
                aria-current={current(href) ? "page" : undefined}
              >
                <Icon size={23} aria-hidden="true" />
                <span>{tx(title)}</span>
              </a>,
            ])}
          </nav>
        )}
        <AnimatePresence>
          {voiceOpen && voiceReady && (
            <VoiceMode workspace={w} onClose={() => setVoiceOpen(false)} />
          )}
        </AnimatePresence>
      </div>
    </VoiceLauncher.Provider>
  );
}

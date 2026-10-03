"use client";
import { useEffect, useState } from "react";
import { I18nProvider, useTranslation } from "../../i18n";
import { useWorkspace } from "./useWorkspace";
import { deferredFeature } from "../../components/deferredFeature";
import { ProductShell } from "../../components/product/ProductShell";
import { SignIn } from "../../components/product/SignIn";
const TodayView = deferredFeature(() =>
  import("../../components/product/TodayView").then((module) => ({
    default: module.TodayView,
  })),
);
const FarmView = deferredFeature(() =>
  import("../../components/product/FarmView").then((module) => ({
    default: module.FarmView,
  })),
);
const ScanView = deferredFeature(() =>
  import("../../components/product/ScanView").then((module) => ({
    default: module.ScanView,
  })),
);
const MarketView = deferredFeature(() =>
  import("../../components/product/MarketView").then((module) => ({
    default: module.MarketView,
  })),
);
const MoreView = deferredFeature(() =>
  import("../../components/product/MoreView").then((module) => ({
    default: module.MoreView,
  })),
);
const SettingsView = deferredFeature(() =>
  import("../../components/product/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);
const PlanningView = deferredFeature(() =>
  import("../../components/product/PlanningView").then((module) => ({
    default: module.PlanningView,
  })),
);
const BenefitsPanel = deferredFeature(() => import("../farms/BenefitsPanel"));
const InstitutionConsole = deferredFeature(
  () => import("../farms/InstitutionConsole"),
);

function Workspace() {
  const w = useWorkspace(),
    { language } = useTranslation();
  const { setNotice } = w;
  const [pathname] = useState(() => location.pathname);
  useEffect(() => {
    const restored = (event) => {
      if (event.persisted) location.reload();
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() =>
          setNotice(
            "Offline app loading is unavailable in this browser. Online access remains available.",
          ),
        );
  }, [setNotice]);
  let content;
  if (w.loading)
    content = (
      <div className="workspace-loading" role="status">
        <span className="loading-leaf" />
        <h1>Opening your workspace…</h1>
        <p>Checking the account and saved records.</p>
      </div>
    );
  else if (pathname === "/app/more/planning") content = <PlanningView />;
  else if (!w.farmer) content = <SignIn workspace={w} />;
  else if (pathname === "/institution")
    content = ["admin", "organisation_admin", "agronomist"].includes(
      w.farmer.role,
    ) ? (
      <>
        <h1>Institutional workspace</h1>
        <p>Consented pilot evidence and role-scoped research review.</p>
        <InstitutionConsole farmer={w.farmer} act={w.act} busy={w.busy} />
      </>
    ) : (
      <section className="product-card">
        <h1>Institutional access is required.</h1>
        <p>
          This account does not have permission for the institutional workspace.
        </p>
        <a className="button primary" href="/app/today">
          Return to my farm
        </a>
      </section>
    );
  else if (pathname.startsWith("/app/farm"))
    content = <FarmView workspace={w} plotId={pathname.split("/")[3]} />;
  else if (pathname === "/app/health") content = <ScanView workspace={w} />;
  else if (pathname === "/app/market") content = <MarketView workspace={w} />;
  else if (pathname === "/app/more/settings")
    content = <SettingsView workspace={w} />;
  else if (pathname === "/app/more/benefits")
    content = (
      <>
        <h1>Benefits & official services</h1>
        <p>Use official sources to verify eligibility and enrollment.</p>
        <BenefitsPanel />
      </>
    );
  else if (pathname === "/app/more") content = <MoreView workspace={w} />;
  else content = <TodayView workspace={w} />;
  return (
    <ProductShell
      workspace={w}
      pathname={pathname}
      institution={pathname === "/institution"}
    >
      {language !== "en" && (
        <p className="status-panel">
          These workspace screens currently use English. The existing planning
          tools use your selected language; translations still need human
          review.
        </p>
      )}
      {content}
    </ProductShell>
  );
}
export default function ProductApp() {
  return (
    <I18nProvider>
      <Workspace />
    </I18nProvider>
  );
}

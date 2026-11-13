"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ProductLocaleProvider, useProductLocale } from "./ProductLocale";
import { useWorkspace } from "./useWorkspace";
import { deferredFeature } from "../../features/product/deferredProductFeature";
import { ProductShell } from "../../components/product/ProductShell";
import { SignIn } from "../../components/product/SignIn";
const loadTodayView = () =>
  import("../../components/product/TodayView").then((module) => ({
    default: module.TodayView,
  }));
const TodayView = deferredFeature(loadTodayView);
const loadFarmView = () =>
  import("../../components/product/FarmView").then((module) => ({
    default: module.FarmView,
  }));
const FarmView = deferredFeature(loadFarmView);
const loadScanView = () =>
  import("../../components/product/ScanView").then((module) => ({
    default: module.ScanView,
  }));
const ScanView = deferredFeature(loadScanView);
const MarketView = deferredFeature(() =>
  import("../../components/product/MarketView").then((module) => ({
    default: module.MarketView,
  })),
);
const loadMoreView = () =>
  import("../../components/product/MoreView").then((module) => ({
    default: module.MoreView,
  }));
const MoreView = deferredFeature(loadMoreView);
const FarmSetupView = deferredFeature(() =>
  import("../../components/product/FarmSetupView").then((module) => ({
    default: module.FarmSetupView,
  })),
);
const AssessmentView = deferredFeature(() =>
  import("../../components/product/AssessmentView").then((module) => ({
    default: module.AssessmentView,
  })),
);
const loadGuidesView = () =>
  import("../../components/product/GuidesView").then((module) => ({
    default: module.GuidesView,
  }));
const GuidesView = deferredFeature(loadGuidesView);
const LiveView = deferredFeature(() =>
  import("../../components/product/LiveView").then((module) => ({
    default: module.LiveView,
  })),
);
const ClaimView = deferredFeature(() =>
  import("../../components/product/ClaimView").then((module) => ({
    default: module.ClaimView,
  })),
);
const ClaimKitView = deferredFeature(() =>
  import("../../components/product/ClaimView").then((module) => ({
    default: module.ClaimKitView,
  })),
);
const GroupView = deferredFeature(() =>
  import("../../components/product/SharingViews").then((module) => ({
    default: module.GroupView,
  })),
);
const VerifyView = deferredFeature(() =>
  import("../../components/product/SharingViews").then((module) => ({
    default: module.VerifyView,
  })),
);
const CommandCentre = deferredFeature(() =>
  import("../farms/InstitutionDesk").then((module) => ({
    default: module.CommandCentre,
  })),
);
const VerifyDesk = deferredFeature(() =>
  import("../farms/InstitutionDesk").then((module) => ({
    default: module.VerifyDesk,
  })),
);
const loadSettingsView = () =>
  import("../../components/product/SettingsView").then((module) => ({
    default: module.SettingsView,
  }));
const SettingsView = deferredFeature(loadSettingsView);
const PlanningView = deferredFeature(() =>
  import("../../components/product/PlanningView").then((module) => ({
    default: module.PlanningView,
  })),
);
const BenefitsPanel = deferredFeature(() => import("../farms/BenefitsPanel"));
const InstitutionConsole = deferredFeature(
  () => import("../farms/InstitutionConsole"),
);

// Screens a farmer can open with no signal: saved records, saving a leaf photo
// for later and the picture guides.
const OFFLINE_SCREENS = [
  loadTodayView,
  loadGuidesView,
  loadScanView,
  () => import("../farms/ScanHistory"),
  loadFarmView,
  loadMoreView,
  loadSettingsView,
];

function Workspace() {
  const w = useWorkspace(),
    { tx } = useProductLocale();
  const { setNotice } = w;
  const pathname = usePathname();
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
  useEffect(() => {
    // While online, quietly fetch the screens that work with no signal, so the
    // service worker has them ready in the field.
    if (!navigator.onLine) return undefined;
    const timer = setTimeout(async () => {
      for (const load of OFFLINE_SCREENS) await load().catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, []);
  let content;
  if (w.loading)
    content = (
      <div className="workspace-loading" role="status">
        <span className="loading-leaf" />
        <h1>{tx("Opening your workspace…")}</h1>
        <p>{tx("Checking the account and saved records.")}</p>
      </div>
    );
  else if (pathname === "/app/more/planning")
    content = <PlanningView workspace={w} />;
  // Picture guides hold no personal data, so they open without an account
  // and without a connection.
  else if (pathname === "/app/guides") content = <GuidesView workspace={w} />;
  else if (!w.farmer)
    content = (
      <>
        {w.offline && (
          <p className="inline-note">
            {tx("You are offline. Picture guides still work.")}{" "}
            <a href="/app/guides">{tx("Picture guides")}</a>
          </p>
        )}
        <SignIn workspace={w} />
      </>
    );
  else if (pathname === "/institution")
    content = ["admin", "organisation_admin", "agronomist"].includes(
      w.farmer.role,
    ) ? (
      <>
        <h1>{tx("Institutional workspace")}</h1>
        <p>{tx("Consented pilot evidence and role-scoped research review.")}</p>
        {["admin", "organisation_admin"].includes(w.farmer.role) && (
          <>
            <CommandCentre act={w.act} busy={w.busy} />
            <VerifyDesk act={w.act} busy={w.busy} />
          </>
        )}
        <InstitutionConsole farmer={w.farmer} act={w.act} busy={w.busy} />
      </>
    ) : (
      <section className="product-card">
        <h1>{tx("Institutional access is required.")}</h1>
        <p>
          {tx(
            "This account does not have permission for the institutional workspace.",
          )}
        </p>
        <a className="button primary" href="/app/today">
          {tx("Return to my farm")}
        </a>
      </section>
    );
  else if (pathname === "/app/live") content = <LiveView workspace={w} />;
  else if (pathname === "/app/claim") content = <ClaimView workspace={w} />;
  else if (pathname.startsWith("/app/claim/"))
    content = <ClaimKitView workspace={w} reportId={pathname.split("/")[3]} />;
  else if (pathname === "/app/more/group")
    content = <GroupView workspace={w} />;
  else if (pathname === "/app/more/verify")
    content = <VerifyView workspace={w} />;
  else if (pathname === "/app/setup") content = <FarmSetupView workspace={w} />;
  else if (pathname === "/app/assessment")
    content = <AssessmentView workspace={w} />;
  else if (pathname.startsWith("/app/farm"))
    content = <FarmView workspace={w} plotId={pathname.split("/")[3]} />;
  else if (pathname === "/app/health") content = <ScanView workspace={w} />;
  else if (pathname === "/app/market") content = <MarketView workspace={w} />;
  else if (pathname === "/app/more/settings")
    content = <SettingsView workspace={w} />;
  else if (pathname === "/app/more/benefits")
    content = (
      <>
        <h1>{tx("Benefits & official services")}</h1>
        <p>
          {tx("Use official sources to verify eligibility and enrollment.")}
        </p>
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
      {content}
    </ProductShell>
  );
}
export default function ProductApp() {
  return (
    <ProductLocaleProvider>
      <Workspace />
    </ProductLocaleProvider>
  );
}

import { useProductLocale } from "../../features/product/ProductLocale";
import { useState } from "react";
import { SlidersHorizontal, Calculator } from "lucide-react";
import { I18nProvider, useTranslation } from "../../i18n";
import { useSimulation } from "../../features/product/useSimulation";
import useFarmCatalog from "../../hooks/useFarmCatalog";
import { deferredFeature } from "../deferredFeature";
import { Dialog } from "./Dialog";
const Sidebar = deferredFeature(() => import("../Sidebar"));
const Dashboard = deferredFeature(() => import("../Dashboard"));
const ScenarioComparison = deferredFeature(
  () => import("../ScenarioComparison"),
);
const RecommendationPanel = deferredFeature(
  () => import("../RecommendationPanel"),
);
const VoiceInputModal = deferredFeature(() => import("../VoiceInputModal"));
export function PlanningView() {
  const { language } = useProductLocale();
  return (
    <I18nProvider preferredLanguage={language}>
      <PlanningContent />
    </I18nProvider>
  );
}
function PlanningContent() {
  const { tx } = useProductLocale();
  const simulation = useSimulation(),
    { crops, soilTypes } = useFarmCatalog(),
    { language } = useTranslation();
  const [view, setView] = useState("summary"),
    [inputsOpen, setInputsOpen] = useState(false),
    [voiceOpen, setVoiceOpen] = useState(false);
  const run = async () => {
    setInputsOpen(false);
    setView("summary");
    await simulation.run();
  };
  const inputs = (
    <Sidebar
      formData={simulation.formData}
      setFormData={simulation.setFormData}
      crops={crops}
      soilTypes={soilTypes}
      loading={simulation.loading}
      onSimulate={run}
      onOpenVoice={() => setVoiceOpen(true)}
    />
  );
  return (
    <>
      <header className="product-page-heading">
        <div>
          <span className="eyebrow">{tx("EXPLORE BEFORE YOU COMMIT")}</span>
          <h1>{tx("What could this season look like?")}</h1>
          <p>
            {tx(
              "Change the assumptions. Compare simulated outcomes. Keep your field judgement.",
            )}
          </p>
        </div>
        <Calculator size={30} />
      </header>
      <p className="status-panel">
        {tx(
          "These are scenario assumptions, not measurements of your field. Defaults are illustrative. Simulated profit improvements are not measured real-world gains.",
        )}
      </p>
      {simulation.saved && (
        <p className="status-panel" role="status">
          {tx(
            "Showing saved simulation results for these exact inputs. Market and weather assumptions may be out of date.",
          )}
        </p>
      )}
      {simulation.error && (
        <p role="alert" className="error-panel">
          {simulation.error}{" "}
          <button className="button text" onClick={run}>
            {tx("Retry simulation")}
          </button>
        </p>
      )}
      <button
        className="button secondary mobile-inputs-button"
        onClick={() => setInputsOpen(true)}
      >
        <SlidersHorizontal size={18} />
        {tx("Edit scenario inputs")}
      </button>
      <div className="planning-layout legacy-tools" lang={language}>
        <aside className="planning-inputs">{inputs}</aside>
        <section className="planning-results" aria-busy={simulation.loading}>
          <div className="segmented-control" aria-label={tx("Simulation view")}>
            {[
              ["summary", "Summary"],
              ["compare", "Compare scenarios"],
              ["recommend", "Ideas to consider"],
            ].map(([id, title]) => (
              <button
                key={id}
                aria-pressed={view === id}
                disabled={id !== "summary" && !simulation.data}
                onClick={() => setView(id)}
              >
                {title}
              </button>
            ))}
          </div>
          {simulation.loading && (
            <p role="status" className="status-panel">
              {tx("Running the scenario and comparing alternatives\u2026")}
            </p>
          )}
          {view === "summary" && (
            <Dashboard
              simulationData={simulation.data?.simulation}
              formData={simulation.formData}
              crops={crops}
            />
          )}{" "}
          {view === "compare" && (
            <ScenarioComparison comparisonData={simulation.data?.comparison} />
          )}{" "}
          {view === "recommend" && (
            <RecommendationPanel
              recommendationData={simulation.data?.recommendations}
              simulationData={simulation.data?.simulation}
              formData={simulation.formData}
            />
          )}
        </section>
      </div>
      {inputsOpen && (
        <Dialog
          title={tx("Scenario inputs")}
          onClose={() => setInputsOpen(false)}
        >
          <div className="legacy-tools" lang={language}>
            {inputs}
          </div>
        </Dialog>
      )}
      {voiceOpen && (
        <VoiceInputModal
          isOpen
          onClose={() => setVoiceOpen(false)}
          onApply={(values) => {
            simulation.setFormData((previous) => ({
              ...previous,
              ...values,
            }));
            setVoiceOpen(false);
          }}
        />
      )}
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bug,
  CloudRain,
  ExternalLink,
  IndianRupee,
  Landmark,
  Mountain,
  Package,
  RefreshCw,
  Sparkles,
  Sprout,
  Volume2,
  Wheat,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { useProductLocale } from "../../features/product/ProductLocale";
import { cropLabel, findCrop } from "../../features/product/crops";
import { createSpeaker } from "../../features/product/speakAnswer";
import { rupees } from "./MarketView";
import { SOILS } from "./FarmSetupView";

export const SCHEMES = {
  "pm-kisan": [
    "PM-KISAN",
    "₹6,000 a year in three instalments for farm families who own land. Needs eKYC and land records.",
    "https://pmkisan.gov.in/",
  ],
  pmfby: [
    "Crop insurance (PMFBY)",
    "Protects your {{v0}} against drought, flood, pests and disease. You pay only {{v1}}% of the insured amount.",
    "https://pmfby.gov.in/",
  ],
  "soil-health-card": [
    "Soil Health Card",
    "A free soil test. It tells exactly how much fertilizer your field needs, so you do not waste money.",
    "https://soilhealth.dac.gov.in/",
  ],
  kcc: [
    "Kisan Credit Card",
    "Low-interest loans for seed, fertilizer and farm costs, repaid after harvest.",
    "https://www.myscheme.gov.in/schemes/kcc",
  ],
  pmksy: [
    "Drip and sprinkler subsidy (PMKSY)",
    "Help to buy drip or sprinkler irrigation, which saves water on dry land.",
    "https://pmksy.gov.in/",
  ],
  "pm-kusum": [
    "Solar pump scheme (PM-KUSUM)",
    "Support for a solar pump, so watering does not depend on diesel or power cuts.",
    "https://pmkusum.mnre.gov.in/",
  ],
  enam: [
    "e-NAM online mandi",
    "Sell your harvest online to buyers in registered mandis and compare rates.",
    "https://enam.gov.in/",
  ],
};
const BAND = {
  good: ["Good", "tone-leaf"],
  fair: ["Fair", "tone-amber"],
  needs_care: ["Needs care", "tone-brick"],
};
const RISKS = [
  ["weather", CloudRain, "Weather"],
  ["pest", Bug, "Pests and disease"],
  ["price", IndianRupee, "Price"],
  ["soil", Mountain, "Soil match"],
];
const FERTILIZERS = { DAP: "DAP", Urea: "Urea", MOP: "MOP (potash)" };
const PLAN_STEPS = {
  seed: "Use certified seed from a trusted shop.",
  pest_watch: "Check the field every week for pests and act early.",
  soil_test:
    "Get a free soil test so you buy only the fertilizer your field needs.",
};

function ScoreRing({ score, band }) {
  const { tx } = useProductLocale();
  const still = useReducedMotion();
  const circumference = 2 * Math.PI * 52;
  const [label, tone] = BAND[band];
  return (
    <div className={`score-ring ${tone}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" className="score-track" />
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          className="score-value"
          strokeDasharray={circumference}
          initial={{
            strokeDashoffset: still
              ? circumference * (1 - score / 100)
              : circumference,
          }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div>
        <strong>{score}</strong>
        <span>{tx(label)}</span>
      </div>
    </div>
  );
}

export function assessmentSpeech(report, tx, language) {
  const crop = cropLabel(findCrop(report.crop_id), tx);
  const parts = [
    tx("Your field score is {{v0}} out of 100.", { v0: report.field_score }),
    tx("Expected harvest is about {{v0}} quintals of {{v1}}.", {
      v0: report.harvest.total_quintals,
      v1: crop,
    }),
  ];
  if (report.price)
    parts.push(
      tx("Expected profit is about {{v0}}.", {
        v0: rupees(report.harvest.profit, language),
      }),
    );
  if (report.better_crop)
    parts.push(
      tx("{{v0}} could earn about {{v1}} more on this soil this season.", {
        v0: cropLabel(findCrop(report.better_crop.crop_id), tx),
        v1: rupees(report.better_crop.profit - report.harvest.profit, language),
      }),
    );
  return parts.join(" ");
}

export function AssessmentView({ workspace: w }) {
  const { tx, language, info, formatDate } = useProductLocale();
  const [report, setReport] = useState(null),
    [problem, setProblem] = useState(""),
    [loading, setLoading] = useState(false),
    [speaking, setSpeaking] = useState(false);
  const speaker = useRef(null);
  useEffect(() => {
    speaker.current = createSpeaker();
    return () => speaker.current?.close();
  }, []);
  const needsPermission = !w.consents.includes("agronomic_analysis");
  const load = useCallback(async () => {
    if (!w.selected || needsPermission) return;
    setLoading(true);
    setProblem("");
    try {
      setReport(
        await farmApi(`/plots/${w.selected}/assessment`, {
          method: "POST",
          body: {},
          retry: false,
          timeoutMs: 40000,
        }),
      );
    } catch (error) {
      setReport(null);
      setProblem(
        error.status === 422
          ? error.message
          : error.status === 429
            ? "Many farmers are checking right now. Please retry in a minute."
            : "The field report could not be made right now. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [w.selected, needsPermission]);
  useEffect(() => {
    load();
  }, [load]);
  const listen = async () => {
    if (speaking) {
      speaker.current?.stop();
      setSpeaking(false);
      return;
    }
    speaker.current?.unlock();
    setSpeaking(true);
    try {
      await speaker.current?.speak(assessmentSpeech(report, tx, language), {
        language,
        speechCode: info.speechCode,
        server: w.consents.includes("speech_processing") && !w.offline,
      });
    } catch {
      /* The written report stays on screen. */
    } finally {
      setSpeaking(false);
    }
  };
  if (!w.plot)
    return (
      <section className="product-card welcome-card">
        <Sprout size={42} aria-hidden="true" />
        <h1>{tx("Your field report")}</h1>
        <p>{tx("Tell Krishyak about your farm first.")}</p>
        <a className="button primary large" href="/app/setup">
          {tx("Tell Krishyak about your farm")} <ArrowRight size={18} />
        </a>
      </section>
    );
  const crop = report && cropLabel(findCrop(report.crop_id), tx);
  return (
    <>
      <header className="home-greeting report-heading">
        <h1>{tx("Your field report")}</h1>
        <p>
          {report
            ? tx("{{v0}} on {{v1}} hectares of {{v2}} soil, {{v3}} season.", {
                v0: crop,
                v1: report.area_hectares,
                v2: tx(SOILS[report.soil.soil_type] || report.soil.soil_type),
                v3:
                  report.season === "rabi"
                    ? tx("rabi")
                    : report.season === "kharif"
                      ? tx("kharif")
                      : tx("full-year"),
              })
            : w.plot.name}
        </p>
      </header>
      {needsPermission && (
        <p className="status-panel">
          {tx("Allow field analysis in Settings to see your field report.")}{" "}
          <a href="/app/more/settings">{tx("Open settings")}</a>
        </p>
      )}
      {loading && (
        <div className="product-card report-loading" role="status">
          <span className="loading-leaf" />
          {tx("Working out your harvest, costs and risks…")}
        </div>
      )}
      {problem && (
        <p role="alert" className="error-panel inline">
          {tx(problem)}{" "}
          {problem.startsWith("Add") ? (
            <a href="/app/setup">{tx("Tell Krishyak about your farm")}</a>
          ) : (
            <button type="button" className="button text" onClick={load}>
              {tx("Retry")}
            </button>
          )}
        </p>
      )}
      {report && (
        <div className="report-grid">
          <section
            className="product-card report-score"
            aria-labelledby="score-heading"
          >
            <ScoreRing score={report.field_score} band={report.score_band} />
            <div>
              <h2 id="score-heading">{tx("Field score")}</h2>
              <p>
                {tx(
                  "Based on weather, pests, price and how well {{v0}} suits your soil ({{v1}}% match).",
                  { v0: crop, v1: report.soil.suitability_percent },
                )}
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={listen}
              >
                <Volume2 size={18} aria-hidden="true" />
                {speaking ? tx("Stop") : tx("Listen to my report")}
              </button>
            </div>
          </section>
          <section
            className="product-card report-stat tone-leaf"
            aria-labelledby="harvest-heading"
          >
            <Wheat size={28} aria-hidden="true" />
            <h2 id="harvest-heading">{tx("Expected harvest")}</h2>
            <p className="report-big">
              {tx("{{v0}} quintals", { v0: report.harvest.total_quintals })}
            </p>
            <p>
              {tx("About {{v0}}–{{v1}} kg per hectare", {
                v0: report.harvest.range_kg_per_hectare[0],
                v1: report.harvest.range_kg_per_hectare[1],
              })}
            </p>
          </section>
          <section
            className="product-card report-stat tone-amber"
            aria-labelledby="money-heading"
          >
            <IndianRupee size={28} aria-hidden="true" />
            <h2 id="money-heading">
              {report.harvest.profit < 0
                ? tx("Expected loss")
                : tx("Expected profit")}
            </h2>
            {report.price ? (
              <>
                <p className="report-big">
                  {rupees(Math.abs(report.harvest.profit), language)}
                </p>
                <p>
                  {tx("Sale {{v0}} − costs {{v1}}", {
                    v0: rupees(report.harvest.revenue, language),
                    v1: rupees(report.harvest.cost, language),
                  })}
                </p>
                <p className="small">
                  {report.price.source === "mandi"
                    ? tx("Price {{v0}}/quintal at {{v1}} mandi on {{v2}}", {
                        v0: rupees(report.price.per_quintal, language),
                        v1: report.price.market,
                        v2: formatDate(report.price.date),
                      })
                    : tx(
                        "Price {{v0}}/quintal, the government MSP for 2025-26",
                        {
                          v0: rupees(report.price.per_quintal, language),
                        },
                      )}
                </p>
              </>
            ) : (
              <p>{tx("No price is available for this crop yet.")}</p>
            )}
          </section>
          <section
            className="product-card report-inputs"
            aria-labelledby="inputs-heading"
          >
            <h2 id="inputs-heading">
              <Package size={24} aria-hidden="true" />{" "}
              {tx("What you will need")}
            </h2>
            <ul className="report-list">
              <li>
                <strong>{tx("Seed")}</strong>
                <span>{tx("{{v0}} kg", { v0: report.inputs.seed_kg })}</span>
              </li>
              {Object.entries(report.inputs.fertilizer_kg)
                .filter(([, kg]) => kg > 0)
                .map(([name, kg]) => (
                  <li key={name}>
                    <strong>{tx(FERTILIZERS[name] || name)}</strong>
                    <span>{tx("{{v0}} kg", { v0: kg })}</span>
                  </li>
                ))}
              <li>
                <strong>{tx("Watering")}</strong>
                <span>
                  {report.inputs.waterings
                    ? tx("About {{v0}} times this season", {
                        v0: report.inputs.waterings,
                      })
                    : tx("Rain only")}
                </span>
              </li>
              <li>
                <strong>{tx("Ready to harvest")}</strong>
                <span>
                  {tx("In about {{v0}} days", {
                    v0: report.inputs.days_to_harvest,
                  })}
                </span>
              </li>
            </ul>
            <p className="small muted">
              {tx(
                "General amounts for your whole field. A soil test can lower your fertilizer cost.",
              )}
            </p>
          </section>
          <section
            className="product-card report-risks"
            aria-labelledby="risk-heading"
          >
            <h2 id="risk-heading">
              {tx("Risks")}{" "}
              <span className="badge neutral">
                {tx("Overall {{v0}}/100", { v0: report.risk.overall })}
              </span>
            </h2>
            <ul className="risk-bars">
              {RISKS.map(([key, Icon, label]) => (
                <li key={key}>
                  <span>
                    <Icon size={18} aria-hidden="true" /> {tx(label)}
                  </span>
                  <span
                    className={`risk-bar ${report.risk[key] >= 60 ? "high" : report.risk[key] >= 35 ? "medium" : "low"}`}
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={report.risk[key]}
                    aria-label={tx(label)}
                  >
                    <i style={{ width: `${Math.max(4, report.risk[key])}%` }} />
                  </span>
                  <b>{report.risk[key]}</b>
                </li>
              ))}
            </ul>
            {report.pests.active.length > 0 && (
              <>
                <h3>{tx("Pests to watch now")}</h3>
                <ul className="care-steps">
                  {report.pests.active.map((pest) => (
                    <li key={pest.name}>
                      <strong>{pest.name}</strong>: {pest.symptoms}
                    </li>
                  ))}
                </ul>
                <a className="text-link" href="/app/health">
                  {tx("Check a sick plant with a photo")}{" "}
                  <ArrowRight size={16} />
                </a>
              </>
            )}
          </section>
          <section
            className={`product-card report-choice ${report.better_crop ? "has-better" : ""}`}
            aria-labelledby="choice-heading"
          >
            <h2 id="choice-heading">
              <Sparkles size={24} aria-hidden="true" />{" "}
              {report.better_crop
                ? tx("A better crop for this field?")
                : tx("{{v0}} is a good choice", { v0: crop })}
            </h2>
            {report.better_crop ? (
              <p className="report-advice">
                {tx(
                  "{{v0}} could earn about {{v1}} more than {{v2}} on your soil this season, with similar risk. Talk to your Krishi Vigyan Kendra before you switch.",
                  {
                    v0: cropLabel(findCrop(report.better_crop.crop_id), tx),
                    v1: rupees(
                      report.better_crop.profit - report.harvest.profit,
                      language,
                    ),
                    v2: crop,
                  },
                )}
              </p>
            ) : (
              <p className="report-advice">
                {tx(
                  "No other {{v0}} crop is clearly more profitable on your soil.",
                  {
                    v0: report.season === "rabi" ? tx("rabi") : tx("kharif"),
                  },
                )}
              </p>
            )}
            {report.alternatives.length > 0 && (
              <table className="report-table">
                <caption className="sr-only">
                  {tx("Crops compared for this field")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{tx("Crop")}</th>
                    <th scope="col">{tx("Harvest")}</th>
                    <th scope="col">{tx("Profit")}</th>
                    <th scope="col">{tx("Risk")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="current">
                    <th scope="row">
                      {crop} ({tx("yours")})
                    </th>
                    <td>
                      {tx("{{v0}} qtl", { v0: report.harvest.total_quintals })}
                    </td>
                    <td>
                      {report.price
                        ? rupees(report.harvest.profit, language)
                        : "—"}
                    </td>
                    <td>{report.risk.overall}</td>
                  </tr>
                  {report.alternatives.map((row) => (
                    <tr key={row.crop_id}>
                      <th scope="row">
                        {cropLabel(findCrop(row.crop_id), tx)}
                      </th>
                      <td>{tx("{{v0}} qtl", { v0: row.total_quintals })}</td>
                      <td>{rupees(row.profit, language)}</td>
                      <td>{row.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {report.ai_plan.changes.length > 0 && (
              <div className="report-plan">
                <h3>{tx("Krishyak's plan for a better harvest")}</h3>
                <ul className="care-steps">
                  {report.ai_plan.changes.map((change) => (
                    <li key={change.kind}>{tx(PLAN_STEPS[change.kind])}</li>
                  ))}
                </ul>
                {report.ai_plan.extra_profit > 0 && (
                  <p>
                    {tx("Could add about {{v0}} to your profit.", {
                      v0: rupees(report.ai_plan.extra_profit, language),
                    })}
                  </p>
                )}
              </div>
            )}
          </section>
          <section
            className="product-card report-schemes"
            aria-labelledby="schemes-heading"
          >
            <h2 id="schemes-heading">
              <Landmark size={24} aria-hidden="true" />{" "}
              {tx("Government schemes for your field")}
            </h2>
            <ul className="scheme-list">
              {report.schemes.map((scheme) => {
                const [title, text, url] = SCHEMES[scheme.id] || [];
                if (!title) return null;
                return (
                  <li key={scheme.id}>
                    <strong>{tx(title)}</strong>
                    <p>
                      {tx(text, {
                        v0: crop,
                        v1: scheme.premium_percent,
                      })}
                    </p>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {tx("Official website")}{" "}
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="small muted">
              {tx(
                "Check the rules on the official website or at your Common Service Centre before applying. Krishyak does not apply for you.",
              )}
            </p>
          </section>
          <details className="evidence-details report-details">
            <summary>{tx("How this was worked out")}</summary>
            <p>
              {tx(
                "These are estimates from general crop and soil figures, the water your crop usually gets from rain, soil moisture and watering (about {{v0}} mm) and current prices. They are not a promise. Weather, seed, care and market change the result.",
                { v0: report.assumptions.water_mm },
              )}
            </p>
            <p>
              {report.soil.source === "soil_map"
                ? tx(
                    "Soil type comes from the SoilGrids soil map near your village.",
                  )
                : report.soil.source === "state_typical"
                  ? tx(
                      "Soil type is a rough guess for your area. Choose the right one in My fields if you know it.",
                    )
                  : tx("Soil type is what you told us.")}
            </p>
            <button
              type="button"
              className="button text"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={16} aria-hidden="true" />{" "}
              {tx("Work it out again")}
            </button>
          </details>
        </div>
      )}
    </>
  );
}

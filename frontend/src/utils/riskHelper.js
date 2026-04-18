/**
 * Centralized Risk Threshold Helper
 * Single source of truth for risk score → label/color mapping.
 * Used by Dashboard KPI card, RiskScoreGauge, ScenarioComparison, and any future component.
 * 
 * Thresholds:
 *   0–25  = Low Risk
 *  26–50  = Moderate Risk
 *  51–75  = High Risk
 *  76–100 = Severe Risk
 */

export const RISK_THRESHOLDS = [
  { max: 25,  label: 'Low Risk',      color: 'green',  emoji: '🟢', desc: 'Safe to Proceed' },
  { max: 50,  label: 'Moderate Risk',  color: 'yellow', emoji: '🟡', desc: 'Monitor Closely' },
  { max: 75,  label: 'High Risk',      color: 'orange', emoji: '🟠', desc: 'Take Precautions' },
  { max: 100, label: 'Severe Risk',    color: 'red',    emoji: '🔴', desc: 'Reconsider Plan' },
];

/**
 * Get risk info for a given score.
 * @param {number} score - Risk score 0–100
 * @returns {{ label, color, emoji, desc, bgClass, textClass, badgeBg, barColor }}
 */
export function getRiskInfo(score) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const tier = RISK_THRESHOLDS.find(t => s <= t.max) || RISK_THRESHOLDS[RISK_THRESHOLDS.length - 1];

  const colorMap = {
    green:  { bgClass: 'bg-green-100',  textClass: 'text-green-600',  barColor: 'bg-green-500',  badgeBg: 'bg-green-100 text-green-700' },
    yellow: { bgClass: 'bg-yellow-100', textClass: 'text-yellow-600', barColor: 'bg-yellow-500', badgeBg: 'bg-yellow-100 text-yellow-700' },
    orange: { bgClass: 'bg-orange-100', textClass: 'text-orange-600', barColor: 'bg-orange-500', badgeBg: 'bg-orange-100 text-orange-700' },
    red:    { bgClass: 'bg-red-100',    textClass: 'text-red-600',    barColor: 'bg-red-500',    badgeBg: 'bg-red-100 text-red-700' },
  };

  return {
    ...tier,
    ...colorMap[tier.color],
    score: s,
  };
}

/**
 * Get the hex color for a risk score (for SVG/canvas rendering).
 */
export function getRiskHexColor(score) {
  const s = Math.round(score);
  if (s <= 25) return '#22c55e'; // green-500
  if (s <= 50) return '#eab308'; // yellow-500
  if (s <= 75) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

import React from 'react';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, TrendingUp, ArrowRight, Lightbulb, Zap } from 'lucide-react';
import { useTranslation } from '../i18n';
import { getRiskInfo } from '../utils/riskHelper';

/**
 * WhatToChangeCard — Fix G
 * Shows actionable deltas between current inputs and AI optimal inputs.
 */
const WhatToChangeCard = ({ currentParams, optimalParams, currentPlan, optimalPlan }) => {
  if (!currentParams || !optimalParams) return null;

  const changes = [];

  // Seed quality
  if (optimalParams.seed_quality > currentParams.seed_quality) {
    const qualityLabel = (q) => q >= 0.9 ? 'Premium' : q >= 0.7 ? 'Good' : q >= 0.5 ? 'Average' : 'Low';
    changes.push({
      label: 'Seed Quality',
      from: qualityLabel(currentParams.seed_quality),
      to: qualityLabel(optimalParams.seed_quality),
      impact: `+${((optimalParams.seed_quality - currentParams.seed_quality) * 100).toFixed(0)}% quality`,
      icon: '🌱',
      costNote: 'Approx. +₹800–1,500/hectare',
    });
  }

  // Irrigation frequency
  if (optimalParams.irrigation_frequency !== currentParams.irrigation_frequency) {
    changes.push({
      label: 'Irrigation',
      from: `${currentParams.irrigation_frequency}x/month`,
      to: `${optimalParams.irrigation_frequency}x/month`,
      impact: `${optimalParams.irrigation_frequency > currentParams.irrigation_frequency ? 'Better' : 'Reduced'} water supply`,
      icon: '💧',
      costNote: optimalParams.irrigation_frequency > currentParams.irrigation_frequency ? 'Minor pump cost increase' : 'Saves water cost',
    });
  }

  // Pest control
  if (optimalParams.pest_control_intensity > (currentParams.pest_control_intensity || 0.5)) {
    const pctFrom = ((currentParams.pest_control_intensity || 0.5) * 100).toFixed(0);
    const pctTo = (optimalParams.pest_control_intensity * 100).toFixed(0);
    changes.push({
      label: 'Pest Protection',
      from: `${pctFrom}% coverage`,
      to: `${pctTo}% coverage`,
      impact: `Reduces crop loss risk by ~${pctTo - pctFrom}%`,
      icon: '🛡️',
      costNote: 'Approx. +₹500–1,000/hectare for sprays',
    });
  }

  // Fertilizer mix
  if (optimalParams.fertilizer_mix) {
    const fertChanges = [];
    for (const [key, optValue] of Object.entries(optimalParams.fertilizer_mix)) {
      const currValue = currentParams.fertilizer_mix?.[key] || 0;
      if (Math.abs(optValue - currValue) > 5) {
        fertChanges.push(`${key}: ${currValue}→${optValue} kg/ha`);
      }
    }
    if (fertChanges.length > 0) {
      changes.push({
        label: 'Fertilizer Balance',
        from: 'Current mix',
        to: 'Optimized NPK',
        impact: fertChanges.join(', '),
        icon: '⚗️',
        costNote: 'Cost varies by quantity change',
      });
    }
  }

  // Sale timing
  if (optimalParams.sale_month !== currentParams.sale_month) {
    changes.push({
      label: 'Sale Timing',
      from: `Month ${currentParams.sale_month || 'immediate'}`,
      to: `Month ${optimalParams.sale_month}`,
      impact: 'Better price window',
      icon: '📅',
      costNote: 'Storage cost may apply',
    });
  }

  if (changes.length === 0) return null;

  // Calculate overall impact
  const profitDelta = (optimalPlan?.profit || 0) - (currentPlan?.profit || 0);
  const yieldDelta = (optimalPlan?.yield?.total_production_quintals || 0) - (currentPlan?.yield?.total_production_quintals || 0);

  return (
    <div className="card-farm card-glow p-4 sm:p-6 animate-fade-in border-l-4 border-blue-500">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-xl bg-blue-100">
          <Lightbulb className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Parameters to Adjust</h3>
          <p className="text-sm text-gray-500">Suggested steps to reach the Optimized Plan</p>
        </div>
      </div>

      {/* Changes list */}
      <div className="space-y-3 mb-4">
        {changes.map((change, idx) => (
          <div key={idx} className="bg-gray-50 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                <span className="text-lg">{change.icon}</span>
                {change.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm mb-1">
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-xs sm:text-sm">{change.from}</span>
              <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md font-medium text-xs sm:text-sm">{change.to}</span>
            </div>
            <p className="text-xs text-gray-600">{change.impact}</p>
            <p className="text-xs text-gray-400 mt-1">{change.costNote}</p>
          </div>
        ))}
      </div>

      {/* Expected impact summary */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">Expected Impact</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">{profitDelta >= 0 && currentPlan?.profit < 0 ? 'Loss Reduction' : 'Profit Impact'}</p>
            <p className={`text-lg font-bold ${profitDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitDelta >= 0 ? '+' : ''}₹{Math.round(Math.abs(profitDelta)).toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Extra Yield</p>
            <p className={`text-lg font-bold ${yieldDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {yieldDelta >= 0 ? '+' : ''}{yieldDelta.toFixed(1)} quintals
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Estimates based on simulation model. Actual results depend on weather and market conditions.
        </p>
      </div>
    </div>
  );
};

const ScenarioComparison = ({ comparisonData }) => {
  const { t } = useTranslation();

  if (!comparisonData) return null;

  const { current_plan, ai_optimal_plan, worst_case_plan } = comparisonData;

  const ScenarioCard = ({ title, data, icon: Icon, color, borderColor, delay }) => {
    const riskInfo = getRiskInfo(data.risk.overall_risk_score);
    
    return (
      <div
        className={`card-farm p-4 sm:p-6 border-l-4 ${borderColor} animate-fade-in`}
        style={{ animationDelay: `${delay}s` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`p-3 rounded-xl ${color} mr-3`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-800">{title}</h3>
          </div>
        </div>

        <div className="space-y-4">
          {/* Yield */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">{t('scenarios.expectedYield') || 'Expected Yield'}</p>
            <p className="text-xl font-bold text-gray-900">
              {data.yield.total_production_quintals.toFixed(1)} {t('units.quintals') || 'quintals'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {data.yield.yield_per_hectare.toFixed(0)} {t('units.kgPerHectare') || 'kg/hectare'}
            </p>
          </div>

          {/* Profit */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">{t('scenarios.profitLoss') || 'Profit/Loss'}</p>
            <div className="flex items-center">
              <p className={`text-xl font-bold ${data.profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                ₹{Math.round(Math.abs(data.profit)).toLocaleString('en-IN')}
              </p>
              {data.profit >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600 ml-2" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600 ml-2" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ROI: {data.roi_percentage.toFixed(1)}%
            </p>
          </div>

          {/* Risk — using centralized thresholds */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">{t('scenarios.riskScore') || 'Risk Score'}</p>
            <p className={`text-xl font-bold ${riskInfo.textClass}`}>
              {data.risk.overall_risk_score.toFixed(0)}/100
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {riskInfo.label}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full ${riskInfo.barColor}`}
                style={{ width: `${data.risk.overall_risk_score}%` }}
              ></div>
            </div>
          </div>

          {/* Cost */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">{t('scenarios.totalCost') || 'Total Cost'}</p>
            <p className="text-lg font-bold text-gray-900">
              ₹{Math.round(data.costs.total_cost).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-farm card-glow p-4 sm:p-6">
        <div className="flex items-center mb-3 sm:mb-4">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-farm-green-600 mr-2" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('scenarios.title') || 'Scenario Comparison (Estimate)'}</h2>
        </div>
        <p className="text-sm sm:text-base text-gray-600">
          {t('scenarios.description') || 'Compare your current inputs with a heuristically optimized strategy and a simulated worst-case'}
        </p>

        {/* Transparency Note for Farmers */}
        <div className="bg-blue-50/50 rounded-xl p-4 mt-4 border border-blue-100/50">
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2 flex items-center">
            <Lightbulb className="w-3 h-3 mr-1" /> Parameter Assumptions
          </h4>
          <ul className="text-xs text-gray-600 space-y-1.5 leading-relaxed">
            <li><strong>Current:</strong> Uses your exact specified inputs relying on typical weather conditions.</li>
            <li><strong>Optimized:</strong> Fixes poor NPK ratios, isolates peak selling windows, and assumes intense preventative pest control.</li>
            <li><strong>Worst Case:</strong> Assumes your input costs remain high, but yield crashes due to a simulated drought shock (50% less rain), 95% pest breach, and a distressing 20% drop in commodity prices.</li>
          </ul>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <ScenarioCard
          title={t('scenarios.currentPlan') || 'Your Current Plan'}
          data={current_plan}
          icon={AlertTriangle}
          color="bg-gray-600"
          borderColor="border-gray-400"
          delay={0}
        />
        <ScenarioCard
          title={t('scenarios.aiOptimal') || 'Optimized Plan'}
          data={ai_optimal_plan}
          icon={CheckCircle}
          color="bg-farm-green-600"
          borderColor="border-farm-green-500"
          delay={0.1}
        />
        <ScenarioCard
          title={t('scenarios.worstCase') || 'Worst Case'}
          data={worst_case_plan}
          icon={AlertTriangle}
          color="bg-red-600"
          borderColor="border-red-500"
          delay={0.2}
        />
      </div>

      {/* Fix G: What to Change — actionable bridge */}
      <WhatToChangeCard
        currentParams={current_plan.parameters_used}
        optimalParams={ai_optimal_plan.parameters_used}
        currentPlan={current_plan}
        optimalPlan={ai_optimal_plan}
      />

      {/* Comparison Summary */}
      <div className="card-farm card-glow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('scenarios.keyInsights') || 'Key Insights'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-green-50 rounded-xl p-3 sm:p-4 border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2 text-balance">
              {current_plan.profit < 0 && ai_optimal_plan.profit < 0 
                ? 'Projected Loss Mitigated' 
                : current_plan.profit < 0 && ai_optimal_plan.profit >= 0 
                ? 'Loss Turned to Profit' 
                : 'Profit Improvement'}
            </p>
            <p className="text-xl sm:text-2xl font-bold text-green-700">
              +₹{Math.round(ai_optimal_plan.profit - current_plan.profit).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {current_plan.profit < 0 && ai_optimal_plan.profit < 0
                 ? "Reduced losses"
                 : `${(((ai_optimal_plan.profit - current_plan.profit) / Math.max(Math.abs(current_plan.profit), 1)) * 100).toFixed(1)}% ${t('common.increase') || 'increase'}`
              }
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">{t('scenarios.yieldBoost') || 'Yield Boost'}</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-700">
              +{(ai_optimal_plan.yield.total_production_quintals - current_plan.yield.total_production_quintals).toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 mt-1">{t('scenarios.quintalsMore') || 'quintals more production'}</p>
          </div>

          <div className="bg-yellow-50 rounded-xl p-3 sm:p-4 border-l-4 border-yellow-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">{t('scenarios.riskReduction') || 'Risk Reduction'}</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-700">
              -{(current_plan.risk.overall_risk_score - ai_optimal_plan.risk.overall_risk_score).toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 mt-1">{t('scenarios.pointsLower') || 'points lower risk'}</p>
          </div>
        </div>
        
        {/* Added assumptions & data sources note */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
          {current_plan.price_forecast?.source_metadata && (
            <div className="text-[10px] text-gray-500 font-mono uppercase bg-gray-100 p-2 rounded block">
              <span className="font-bold">PRICE SOURCING:</span> {current_plan.price_forecast.source_metadata.source_label}
              
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                current_plan.price_forecast.source_metadata.freshness_status === 'live' ? 'bg-green-200 text-green-800' : 
                current_plan.price_forecast.source_metadata.freshness_status === 'stale' ? 'bg-yellow-200 text-yellow-800' : 
                'bg-gray-300 text-gray-800'
              }`}>
                {current_plan.price_forecast.source_metadata.freshness_status}
              </span>
              
              {current_plan.price_forecast.source_metadata.record_date && (
                <span className="ml-2 text-gray-400 font-normal">
                  (Rev: {current_plan.price_forecast.source_metadata.record_date})
                </span>
              )}
              
              {/* Redesigned Honesty Badge */}
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 font-sans normal-case">
                  {current_plan.price_forecast.source_metadata.freshness_status === 'stale'
                     ? "Prices based on historical mandi records. Live market feed not configured for this deployment."
                     : current_plan.price_forecast.source_metadata.transparency_note || "Market estimates derived from live agricultural datasets."
                  }
                </p>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 italic">
            * Note: These are simulated heuristics and not guarantees. The "Worst Case" assumes multi-factor degradation (weather + pests + low prices). Real world conditions may vary significantly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScenarioComparison;

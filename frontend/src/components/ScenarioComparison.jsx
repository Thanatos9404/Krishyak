import React from 'react';
import ScenarioPriceSource from './ScenarioPriceSource';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, TrendingUp, ArrowRight, CalendarDays, Droplets, FlaskConical, Lightbulb, ShieldCheck, Sprout, Zap } from 'lucide-react';
import { useTranslation } from '../i18n';
import { getRiskInfo } from '../utils/riskHelper';

/**
 * WhatToChangeCard - Fix G
 * Shows actionable deltas between current inputs and AI optimal inputs.
 */
const WhatToChangeCard = ({ currentParams, optimalParams, currentPlan, optimalPlan }) => {
  const { t, languageInfo } = useTranslation();
  if (!currentParams || !optimalParams) return null;

  const changes = [];

  // Seed quality
  if (optimalParams.seed_quality > currentParams.seed_quality) {
    const qualityLabel = (q) => q >= 0.9 ? t('sidebar.premium') : q >= 0.7 ? t('sidebar.good') : q >= 0.5 ? t('sidebar.fair') : t('sidebar.low');
    changes.push({
      label: t('sidebar.seedQuality'),
      from: qualityLabel(currentParams.seed_quality),
      to: qualityLabel(optimalParams.seed_quality),
      impact: `+${((optimalParams.seed_quality - currentParams.seed_quality) * 100).toFixed(0)}%`,
      icon: Sprout,
      costNote: t('scenarioDetails.seedCost'),
    });
  }

  // Irrigation frequency
  if (optimalParams.irrigation_frequency !== currentParams.irrigation_frequency) {
    changes.push({
      label: t('dashboard.irrigation'),
      from: `${currentParams.irrigation_frequency} ${t('sidebar.timesPerMonth')}`,
      to: `${optimalParams.irrigation_frequency} ${t('sidebar.timesPerMonth')}`,
      impact: optimalParams.irrigation_frequency > currentParams.irrigation_frequency ? t('scenarioDetails.moreWater') : t('scenarioDetails.lessWater'),
      icon: Droplets,
      costNote: optimalParams.irrigation_frequency > currentParams.irrigation_frequency ? t('scenarioDetails.pumpCost') : t('scenarioDetails.saveWater'),
    });
  }

  // Pest control
  if (optimalParams.pest_control_intensity > (currentParams.pest_control_intensity || 0.5)) {
    const pctFrom = ((currentParams.pest_control_intensity || 0.5) * 100).toFixed(0);
    const pctTo = (optimalParams.pest_control_intensity * 100).toFixed(0);
    changes.push({
      label: t('dashboard.pestControl'),
      from: `${pctFrom}%`,
      to: `${pctTo}%`,
      impact: t('scenarioDetails.pestReduction', { value: pctTo - pctFrom }),
      icon: ShieldCheck,
      costNote: t('scenarioDetails.sprayCost'),
    });
  }

  // Fertilizer mix
  if (optimalParams.fertilizer_mix) {
    const fertChanges = [];
    for (const [key, optValue] of Object.entries(optimalParams.fertilizer_mix)) {
      const currValue = currentParams.fertilizer_mix?.[key] || 0;
      if (Math.abs(optValue - currValue) > 5) {
        fertChanges.push(`${t(`fertilizer.products.${key.toLowerCase()}`) || key}: ${currValue}→${optValue} ${t('units.kgPerHectare')}`);
      }
    }
    if (fertChanges.length > 0) {
      changes.push({
        label: t('scenarioDetails.fertilizerBalance'),
        from: t('scenarioDetails.currentMix'),
        to: t('scenarioDetails.betterNpk'),
        impact: fertChanges.join(', '),
        icon: FlaskConical,
        costNote: t('scenarioDetails.costVaries'),
      });
    }
  }

  // Sale timing
  if (optimalParams.sale_month !== currentParams.sale_month) {
    changes.push({
      label: t('sidebar.saleMonth'),
      from: currentParams.sale_month ? `${t('sidebar.month')} ${currentParams.sale_month}` : t('sidebar.immediate'),
      to: `${t('sidebar.month')} ${optimalParams.sale_month}`,
      impact: t('priceForecast.optimalWindow'),
      icon: CalendarDays,
      costNote: t('scenarioDetails.storageCost'),
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
          <h3 className="text-lg font-bold text-gray-800">{t('scenarioDetails.changeTitle')}</h3>
          <p className="text-sm text-gray-500">{t('scenarioDetails.changeSubtitle')}</p>
        </div>
      </div>

      {/* Changes list */}
      <div className="space-y-3 mb-4">
        {changes.map((change, idx) => {
          const ChangeIcon = change.icon;
          return (
          <div key={idx} className="bg-gray-50 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                <ChangeIcon className="w-5 h-5 text-farm-green-700" aria-hidden="true" />
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
          );
        })}
      </div>

      {/* Expected impact summary */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">{t('scenarioDetails.expectedImpact')}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">{profitDelta >= 0 && currentPlan?.profit < 0 ? t('scenarioDetails.lossReduction') : t('recommendations.profitImprovement')}</p>
            <p className={`text-lg font-bold ${profitDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitDelta >= 0 ? '+' : ''}₹{Math.round(Math.abs(profitDelta)).toLocaleString(languageInfo.speechCode)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('scenarioDetails.extraYield')}</p>
            <p className={`text-lg font-bold ${yieldDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {yieldDelta >= 0 ? '+' : ''}{yieldDelta.toFixed(1)} {t('units.quintals')}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {t('scenarioDetails.estimateNotice')}
        </p>
      </div>
    </div>
  );
};

const ScenarioComparison = ({ comparisonData }) => {
  const { t, languageInfo } = useTranslation();

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
                ₹{Math.round(Math.abs(data.profit)).toLocaleString(languageInfo.speechCode)}
              </p>
              {data.profit >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600 ml-2" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600 ml-2" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('dashboard.roi')}: {data.roi_percentage.toFixed(1)}%
            </p>
          </div>

          {/* Risk - using centralized thresholds */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">{t('scenarios.riskScore') || 'Risk Score'}</p>
            <p className={`text-xl font-bold ${riskInfo.textClass}`}>
              {data.risk.overall_risk_score.toFixed(0)}/100
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {riskInfo.id === 'unknown' ? t('common.notAvailable') : t(`risk.levels.${riskInfo.id}`)}
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
              ₹{Math.round(data.costs.total_cost).toLocaleString(languageInfo.speechCode)}
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
            <Lightbulb className="w-3 h-3 mr-1" /> {t('scenarioDetails.assumptions')}
          </h4>
          <ul className="text-xs text-gray-600 space-y-1.5 leading-relaxed">
            <li>{t('scenarioDetails.currentAssumption')}</li>
            <li>{t('scenarioDetails.optimizedAssumption')}</li>
            <li>{t('scenarioDetails.worstAssumption')}</li>
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

      {/* Fix G: What to Change - actionable bridge */}
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
                ? t('scenarioDetails.lossReduction')
                : current_plan.profit < 0 && ai_optimal_plan.profit >= 0 
                ? t('scenarioDetails.lossToProfit')
                : t('recommendations.profitImprovement')}
            </p>
            <p className="text-xl sm:text-2xl font-bold text-green-700">
              +₹{Math.round(ai_optimal_plan.profit - current_plan.profit).toLocaleString(languageInfo.speechCode)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {current_plan.profit < 0 && ai_optimal_plan.profit < 0
                 ? t('scenarioDetails.lossReduction')
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
          <ScenarioPriceSource forecast={current_plan.price_forecast} />
          <p className="text-xs text-gray-400 italic">
            {t('scenarioDetails.disclaimer')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScenarioComparison;

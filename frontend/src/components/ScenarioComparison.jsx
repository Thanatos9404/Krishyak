import React from 'react';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { useTranslation } from '../i18n';

const ScenarioComparison = ({ comparisonData }) => {
  const { t } = useTranslation();

  if (!comparisonData) return null;

  const { current_plan, ai_optimal_plan, worst_case_plan } = comparisonData;

  const ScenarioCard = ({ title, data, icon: Icon, color, borderColor, delay }) => (
    <div
      className={`card-farm p-6 border-l-4 ${borderColor} animate-fade-in`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className={`p-3 rounded-xl ${color} mr-3`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
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
              ₹{(Math.abs(data.profit) / 1000).toFixed(1)}k
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

        {/* Risk */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1">{t('scenarios.riskScore') || 'Risk Score'}</p>
          <p className={`text-xl font-bold ${data.risk.overall_risk_score < 40 ? 'text-green-600' :
              data.risk.overall_risk_score < 70 ? 'text-yellow-600' : 'text-red-600'
            }`}>
            {data.risk.overall_risk_score.toFixed(0)}/100
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.risk.risk_category}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${data.risk.overall_risk_score < 40 ? 'bg-green-500' :
                  data.risk.overall_risk_score < 70 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              style={{ width: `${data.risk.overall_risk_score}%` }}
            ></div>
          </div>
        </div>

        {/* Cost */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1">{t('scenarios.totalCost') || 'Total Cost'}</p>
          <p className="text-lg font-bold text-gray-900">
            ₹{(data.costs.total_cost / 1000).toFixed(1)}k
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-farm card-glow p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="w-6 h-6 text-farm-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-800">{t('scenarios.title') || 'Scenario Comparison'}</h2>
        </div>
        <p className="text-gray-600">
          {t('scenarios.description') || 'Compare your current plan with AI-optimized strategy and worst-case scenario'}
        </p>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ScenarioCard
          title={t('scenarios.currentPlan') || 'Your Current Plan'}
          data={current_plan}
          icon={AlertTriangle}
          color="bg-gray-600"
          borderColor="border-gray-400"
          delay={0}
        />
        <ScenarioCard
          title={t('scenarios.aiOptimal') || 'AI Optimal Plan'}
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

      {/* Comparison Summary */}
      <div className="card-farm card-glow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('scenarios.keyInsights') || 'Key Insights'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-2">{t('scenarios.profitImprovement') || 'Profit Improvement'}</p>
            <p className="text-2xl font-bold text-green-700">
              +₹{((ai_optimal_plan.profit - current_plan.profit) / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {(((ai_optimal_plan.profit - current_plan.profit) / Math.abs(current_plan.profit)) * 100).toFixed(1)}% {t('common.increase') || 'increase'}
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-2">{t('scenarios.yieldBoost') || 'Yield Boost'}</p>
            <p className="text-2xl font-bold text-blue-700">
              +{(ai_optimal_plan.yield.total_production_quintals - current_plan.yield.total_production_quintals).toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 mt-1">{t('scenarios.quintalsMore') || 'quintals more production'}</p>
          </div>

          <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-2">{t('scenarios.riskReduction') || 'Risk Reduction'}</p>
            <p className="text-2xl font-bold text-yellow-700">
              -{(current_plan.risk.overall_risk_score - ai_optimal_plan.risk.overall_risk_score).toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 mt-1">{t('scenarios.pointsLower') || 'points lower risk'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenarioComparison;

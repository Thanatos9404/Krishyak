import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Target, Award, Shield } from 'lucide-react';
import YieldChart from './YieldChart';
import RiskGauge from './RiskGauge';
import RiskScoreGauge from './RiskScoreGauge';
import WeatherAlertCard from './WeatherAlertCard';
import PestAlertCard from './PestAlertCard';
import FertilizerRecommendationCard from './FertilizerRecommendationCard';
import JAMTrinityVerification from './JAMTrinityVerification';
import { getRiskInfo } from '../utils/riskHelper';
import { useTranslation } from '../i18n';
import { riskInsightKey } from '../utils/localization';

const Dashboard = ({ simulationData, formData, farmer, crops = [] }) => {
  const { t, languageInfo } = useTranslation();
  if (!simulationData) {
    return (
      <div className="farm-empty-state">
        <div className="farm-empty-state__photo" role="img" aria-label={t('landing.photoAlt')} />
        <div className="farm-empty-state__copy">
          <div className="mb-6 animate-pulse-soft">
            <Target className="w-10 h-10 text-farm-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-700 mb-3">
            {t('dashboard.noData') || 'Welcome to Krishyak'}
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {t('dashboard.runPrompt')}
          </p>
          <div className="empty-metric-preview">{['dashboard.yieldEstimate', 'dashboard.totalCost', 'dashboard.netProfit', 'dashboard.riskScore'].map(key => <span key={key}><span aria-hidden="true">↗</span>{t(key)}</span>)}</div>
        </div>
      </div>
    );
  }

  const { yield: yieldData, costs, revenue, profit, roi_percentage, risk } = simulationData;

  return (
    <div className="dashboard-results flex-1 space-y-4 sm:space-y-6">
      {simulationData.assumptions?.price_basis_warning && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {simulationData.assumptions.price_basis_warning}
        </p>
      )}
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Yield Card */}
        <div className="card-farm card-glow p-4 sm:p-6 animate-fade-in">
          <div className="flex items-start mb-3">
            <div className="bg-farm-green-100 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-farm-green-600" />
            </div>
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">{t('dashboard.yieldEstimate')}</h3>
          <p className="text-xl sm:text-3xl font-bold text-gray-900">
            {yieldData.total_production_quintals.toFixed(1)}
            <span className="text-xs sm:text-base font-normal text-gray-500 ml-1">{t('units.quintals')}</span>
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-600">
              {yieldData.yield_per_hectare.toFixed(0)} {t('units.kgPerHectare')}
            </p>
            <span className="text-xs font-semibold text-farm-green-600 bg-farm-green-50 px-2 py-1 rounded">
              {t('dashboard.yieldEstimate')}
            </span>
          </div>
        </div>

        {/* Cost Card */}
        <div className="card-farm card-glow p-4 sm:p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="bg-earth-brown-100 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-earth-brown-600" />
            </div>
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">{t('dashboard.totalCost')}</h3>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 break-words">
            ₹{Math.round(costs.total_cost).toLocaleString(languageInfo.speechCode)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{t('dashboard.cultivationCost') || 'cultivation cost'}</p>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              ₹{costs.cost_per_quintal.toFixed(0)} {t('units.per')} {t('units.quintal')}
            </p>
          </div>
        </div>

        {/* Profit Card */}
        <div className="card-farm card-glow p-4 sm:p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-start mb-3">
            <div className={`p-3 rounded-xl ${profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {profit >= 0 ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">{t('dashboard.netProfit')}</h3>
          <p className={`text-lg sm:text-2xl font-bold break-words ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{Math.round(Math.abs(profit)).toLocaleString(languageInfo.speechCode)}
            <span className="text-xs sm:text-sm font-normal text-gray-500 ml-1">{profit >= 0 ? t('scenarios.profit') : t('common.loss') || 'loss'}</span>
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-600">
              {t('dashboard.estimatedRevenue')}: ₹{Math.round(revenue).toLocaleString(languageInfo.speechCode)}
            </p>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {roi_percentage.toFixed(1)}% {t('dashboard.roi')}
            </span>
          </div>
        </div>

        {/* Risk Card */}
        {(() => {
          const riskInfo = getRiskInfo(risk.overall_risk_score);
          return (
            <div className="card-farm card-glow p-4 sm:p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-start justify-between mb-3">
                <div className={`p-3 rounded-xl ${riskInfo.bgClass}`}>
                  <AlertCircle className={`w-6 h-6 ${riskInfo.textClass}`} />
                </div>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-600 mb-1">{t('dashboard.riskScore')}</h3>
              <p className={`text-xl sm:text-3xl font-bold ${riskInfo.textClass}`}>
                {risk.overall_risk_score.toFixed(0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">{riskInfo.id === 'unknown' ? t('common.notAvailable') : t(`risk.levels.${riskInfo.id}`)}</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${riskInfo.barColor}`}
                    style={{ width: `${risk.overall_risk_score}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Weather Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeatherAlertCard crop={formData?.crop || simulationData?.crop || 'default'} />

        {/* Enhanced Risk Score Section */}
        <div className="card-farm card-glow p-4 sm:p-8 animate-fade-in">
          <div className="flex items-center mb-6">
            <Shield className="w-6 h-6 text-farm-green-600 mr-2" />
            <h3 className="text-xl font-bold text-gray-800">{t('dashboard.riskAssessment')}</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 items-center">
            <RiskScoreGauge score={risk.overall_risk_score} />
          </div>
        </div>
      </div>

      {/* Pest Intelligence Section */}
      <div id="dashboard-pest" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PestAlertCard
          crop={formData?.crop || simulationData?.crop || ''}
          crops={crops}
          location={null}
          state={farmer?.state || null}
          district={farmer?.district || ''}
          weather={{}}
        />

        {/* Risk Distribution */}
        <div className="card-farm card-glow p-4 sm:p-8 animate-fade-in">
          <RiskGauge riskData={risk} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <YieldChart yieldData={yieldData} />
        <FertilizerRecommendationCard
          crop={formData?.crop || simulationData?.crop || ''}
          areaHectares={formData?.area_hectares || simulationData?.area || 1}
          soilData={null}
          growthStage="basal"
        />
      </div>

      {/* Risk Insights */}
      <div className="card-farm card-glow p-6 animate-fade-in">
        <div className="flex items-center mb-4">
          <Award className="w-6 h-6 text-farm-green-600 mr-2" />
          <h3 className="text-xl font-bold text-gray-800">{t('dashboard.riskInsights')}</h3>
        </div>
        <div className="space-y-2">
          {risk.insights.map((insight, idx) => (
            <div
              key={idx}
              className="flex items-start p-3 bg-farm-green-50 rounded-lg border-l-4 border-farm-green-500"
            >
              <p className="text-sm text-gray-700">{t(`risk.insights.${riskInsightKey(insight)}`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="card-farm card-glow p-6 animate-fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('dashboard.costBreakdown')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {Object.entries(costs.breakdown).map(([key, value]) => (
            <div key={key} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1 capitalize">
                {t(`costs.${key}`)}
              </p>
              <p className="text-base font-bold text-gray-900 break-words">
                ₹{Math.round(value).toLocaleString(languageInfo.speechCode)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* JAM Trinity Farmer Verification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative">
          <JAMTrinityVerification
            onVerificationComplete={(profile) => {
              console.log('Farmer profile verified:', profile);
            }}
          />
          <p className="text-xs text-gray-500 mt-3 text-center px-4">
            {t('jam.demoNotice')}
          </p>
        </div>

        {/* Verification Benefits Info */}
        <div className="card-farm card-glow p-6 animate-fade-in">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <Shield className="w-6 h-6 text-blue-600 mr-2" />
            {t('jam.title') || 'Farmer Verification Benefits'}
          </h3>
          <div className="space-y-4">
            <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
              <h4 className="font-semibold text-green-800 mb-1 flex items-center gap-2"><Target className="w-4 h-4" /> {t('jam.pmKisanEligibility')}</h4>
              <p className="text-sm text-green-700">{t('jam.pmKisanBenefit')}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
              <h4 className="font-semibold text-blue-800 mb-1 flex items-center gap-2"><DollarSign className="w-4 h-4" /> {t('jam.dbtReady')}</h4>
              <p className="text-sm text-blue-700">{t('jam.dbtBenefit')}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-500">
              <h4 className="font-semibold text-purple-800 mb-1 flex items-center gap-2"><Award className="w-4 h-4" /> {t('jam.schemeMatching')}</h4>
              <p className="text-sm text-purple-700">{t('jam.schemeBenefit')}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500">
              <h4 className="font-semibold text-yellow-800 mb-1 flex items-center gap-2"><Shield className="w-4 h-4" /> {t('jam.privacyProtected')}</h4>
              <p className="text-sm text-yellow-700">{t('jam.privacyBenefit')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

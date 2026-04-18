import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Target, Award, Shield } from 'lucide-react';
import YieldChart from './YieldChart';
import RiskGauge from './RiskGauge';
import RiskScoreGauge from './RiskScoreGauge';
import WeatherAlertCard from './WeatherAlertCard';
import PestAlertCard from './PestAlertCard';
import FertilizerRecommendationCard from './FertilizerRecommendationCard';
import JAMTrinityVerification from './JAMTrinityVerification';
import MSPRateCard from './MSPRateCard';
import { getRiskInfo } from '../utils/riskHelper';
import { useTranslation } from '../i18n';

const Dashboard = ({ simulationData, formData }) => {
  const { t } = useTranslation();
  if (!simulationData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-6 animate-pulse-soft">
            <Target className="w-24 h-24 mx-auto text-farm-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-700 mb-3">
            {t('dashboard.noData') || 'Welcome to Krishyak'}
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {t('dashboard.runPrompt')}
          </p>
        </div>
      </div>
    );
  }

  const { yield: yieldData, costs, revenue, profit, roi_percentage, risk } = simulationData;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Yield Card */}
        <div className="card-farm card-glow p-6 animate-fade-in">
          <div className="flex items-start mb-3">
            <div className="bg-farm-green-100 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-farm-green-600" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-600 mb-1">{t('dashboard.yieldEstimate')}</h3>
          <p className="text-3xl font-bold text-gray-900">
            {yieldData.total_production_quintals.toFixed(1)}
            <span className="text-base font-normal text-gray-500 ml-1">{t('units.quintals')}</span>
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-600">
              {yieldData.yield_per_hectare.toFixed(0)} kg/ha
            </p>
            <span className="text-xs font-semibold text-farm-green-600 bg-farm-green-50 px-2 py-1 rounded">
              {(yieldData.confidence * 100).toFixed(0)}% conf.
            </span>
          </div>
        </div>

        {/* Cost Card */}
        <div className="card-farm card-glow p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="bg-earth-brown-100 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-earth-brown-600" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-600 mb-1">{t('dashboard.totalCost')}</h3>
          <p className="text-3xl font-bold text-gray-900">
            ₹{(costs.total_cost / 1000).toFixed(1)}k
          </p>
          <p className="text-sm text-gray-500 mt-1">{t('dashboard.cultivationCost') || 'cultivation cost'}</p>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              ₹{costs.cost_per_quintal.toFixed(0)} {t('units.per')} {t('units.quintal')}
            </p>
          </div>
        </div>

        {/* Profit Card */}
        <div className="card-farm card-glow p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-start mb-3">
            <div className={`p-3 rounded-xl ${profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {profit >= 0 ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-600 mb-1">{t('dashboard.netProfit')}</h3>
          <p className={`text-3xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{(Math.abs(profit) / 1000).toFixed(1)}k
            <span className="text-base font-normal text-gray-500 ml-1">{profit >= 0 ? t('scenarios.profit') : t('common.loss') || 'loss'}</span>
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-600">
              {t('dashboard.estimatedRevenue')}: ₹{(revenue / 1000).toFixed(1)}k
            </p>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {roi_percentage.toFixed(1)}% ROI
            </span>
          </div>
        </div>

        {/* Risk Card */}
        {(() => {
          const riskInfo = getRiskInfo(risk.overall_risk_score);
          return (
            <div className="card-farm card-glow p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-start justify-between mb-3">
                <div className={`p-3 rounded-xl ${riskInfo.bgClass}`}>
                  <AlertCircle className={`w-6 h-6 ${riskInfo.textClass}`} />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-600 mb-1">{t('dashboard.riskScore')}</h3>
              <p className={`text-3xl font-bold ${riskInfo.textClass}`}>
                {risk.overall_risk_score.toFixed(0)}
              </p>
              <p className="text-sm text-gray-500 mt-1">{riskInfo.label}</p>
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
        <WeatherAlertCard crop={simulationData?.crop || 'default'} />

        {/* Enhanced Risk Score Section */}
        <div className="card-farm card-glow p-8 animate-fade-in">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PestAlertCard
          crop={simulationData?.crop || ''}
          location={null}
          state="Maharashtra"
          district=""
          weather={{}}
        />

        {/* Risk Distribution */}
        <div className="card-farm card-glow p-8 animate-fade-in">
          <RiskGauge riskData={risk} />
        </div>
      </div>

      {/* MSP Rate Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MSPRateCard
          primaryCrop={formData?.crop || simulationData?.crop || 'Rice'}
          currentMarketPrice={formData?.current_market_price || 2500}
        />
        <YieldChart yieldData={yieldData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <p className="text-sm text-gray-700">{insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="card-farm card-glow p-6 animate-fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('dashboard.costBreakdown')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(costs.breakdown).map(([key, value]) => (
            <div key={key} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1 capitalize">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="text-lg font-bold text-gray-900">
                ₹{(value / 1000).toFixed(1)}k
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* JAM Trinity Farmer Verification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative">
          {/* Preview Feature Banner */}
          <div className="absolute top-3 right-3 z-10 bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full border border-amber-300 flex items-center">
            <span className="mr-1">🔬</span> Preview Feature
          </div>
          <JAMTrinityVerification
            onVerificationComplete={(profile) => {
              console.log('Farmer profile verified:', profile);
            }}
          />
          <p className="text-xs text-gray-400 mt-2 text-center">
            ⚠️ Demo only — no real government data is accessed
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
              <h4 className="font-semibold text-green-800 mb-1">🎯 PM-KISAN Eligibility</h4>
              <p className="text-sm text-green-700">Verify your land records to check PM-KISAN eligibility instantly</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
              <h4 className="font-semibold text-blue-800 mb-1">🏦 DBT Ready</h4>
              <p className="text-sm text-blue-700">Link your bank account for Direct Benefit Transfer</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-500">
              <h4 className="font-semibold text-purple-800 mb-1">📋 Scheme Matching</h4>
              <p className="text-sm text-purple-700">Get personalized scheme recommendations based on verified data</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-500">
              <h4 className="font-semibold text-yellow-800 mb-1">🔐 Privacy Protected</h4>
              <p className="text-sm text-yellow-700">Your Aadhaar is never stored - only tokenized references used</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

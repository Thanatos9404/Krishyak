/**
 * FertilizerRecommendationCard Component
 * Display fertilizer recommendations with NPK dosages, schedule, and organic alternatives
 * 
 * Features:
 * - NPK recommendation bars
 * - Dosage table with costs
 * - Growth stage schedule
 * - Organic/chemical toggle
 * - Safety notes
 */

import React, { useState } from 'react';
import { Droplets, Leaf, Calendar, AlertTriangle, ChevronDown, ChevronUp, Sprout, RefreshCw } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useFertilizerAnalysis } from '../hooks/useFertilizerAnalysis';

const NPK_COLORS = {
  N: { bg: 'bg-blue-100', bar: 'bg-blue-500', text: 'text-blue-700' },
  P: { bg: 'bg-orange-100', bar: 'bg-orange-500', text: 'text-orange-700' },
  K: { bg: 'bg-purple-100', bar: 'bg-purple-500', text: 'text-purple-700' }
};

/**
 * NPK Bar Component
 */
const NPKBar = ({ nutrient, value, max = 150, label }) => {
  const colors = NPK_COLORS[nutrient] || NPK_COLORS.N;
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1">
        <span className={`font-medium ${colors.text}`}>{label}</span>
        <span className="text-gray-600">{value.toFixed(1)} kg/ha</span>
      </div>
      <div className={`w-full h-3 rounded-full ${colors.bg}`}>
        <div
          className={`h-3 rounded-full ${colors.bar} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Fertilizer Dose Item
 */
const DoseItem = ({ dose, t }) => (
  <div className="bg-gray-50 rounded-lg p-3 mb-2">
    <div className="flex justify-between items-start mb-2">
      <div>
        <span className="font-medium text-gray-800">{dose.name}</span>
        <div className="text-sm text-gray-500">{dose.method}</div>
      </div>
      <div className="text-right">
        <div className="font-bold text-farm-green-600">{dose.quantity_kg_ha} kg/ha</div>
        <div className="text-xs text-gray-500">₹{dose.cost_inr?.toFixed(0) || 0}</div>
      </div>
    </div>
    <div className="flex space-x-2 text-xs">
      {dose.npk_contribution?.N > 0 && (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">N: {dose.npk_contribution.N?.toFixed(1)}</span>
      )}
      {dose.npk_contribution?.P > 0 && (
        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">P: {dose.npk_contribution.P?.toFixed(1)}</span>
      )}
      {dose.npk_contribution?.K > 0 && (
        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">K: {dose.npk_contribution.K?.toFixed(1)}</span>
      )}
    </div>
  </div>
);

/**
 * Schedule Timeline
 */
const ScheduleTimeline = ({ schedule }) => {
  if (!schedule?.schedule?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {schedule.schedule.map((stage, idx) => (
        <div key={idx} className="flex items-start space-x-3 text-sm">
          <div className="flex-shrink-0 w-6 h-6 bg-farm-green-100 rounded-full flex items-center justify-center">
            <span className="text-farm-green-600 font-bold text-xs">{idx + 1}</span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-800">{stage.stage}</div>
            <div className="text-xs text-gray-500">{stage.timing}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Main Component
 */
const FertilizerRecommendationCard = ({ crop, areaHectares = 1, soilData = null, growthStage = 'basal' }) => {
  const { t } = useTranslation();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSafety, setShowSafety] = useState(false);

  const {
    recommendation,
    schedule,
    preferOrganic,
    loading,
    error,
    costPerHectare,
    hasRecommendation,
    toggleOrganic,
    refresh
  } = useFertilizerAnalysis(crop, areaHectares, soilData, growthStage);

  return (
    <div className="card-farm card-glow p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-farm-green-100 rounded-xl mr-3">
            <Droplets className="w-5 h-5 text-farm-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">
              {t('fertilizer.title') || 'Fertilizer Recommendation'}
            </h3>
            <div className="text-xs text-gray-500">
              {crop && `For ${crop}`} • {areaHectares} ha
            </div>
          </div>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Organic Toggle */}
      <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <Leaf className={`w-4 h-4 mr-2 ${preferOrganic ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="text-sm text-gray-700">
            {t('fertilizer.organicMode') || 'Organic Mode'}
          </span>
        </div>
        <button
          onClick={toggleOrganic}
          className={`w-12 h-6 rounded-full transition-colors ${preferOrganic ? 'bg-green-500' : 'bg-gray-300'
            }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${preferOrganic ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
        </button>
      </div>

      {/* Content */}
      {loading && !recommendation ? (
        <div className="text-center py-8 text-gray-500">
          <Droplets className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          <p>{t('common.loading') || 'Loading...'}</p>
        </div>
      ) : error && !recommendation ? (
        <div className="text-center py-6 text-gray-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
          <p className="text-sm">Could not load recommendations</p>
          <button
            onClick={refresh}
            className="mt-2 text-sm text-farm-green-600 hover:underline"
          >
            {t('common.retry') || 'Retry'}
          </button>
        </div>
      ) : !crop ? (
        <div className="text-center py-6 text-gray-500">
          <Sprout className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">{t('fertilizer.selectCrop') || 'Select a crop to see recommendations'}</p>
        </div>
      ) : hasRecommendation ? (
        <>
          {/* NPK Applied */}
          {recommendation?.total_npk_applied && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {t('fertilizer.npkApplied') || 'NPK Applied'}
              </h4>
              <NPKBar
                nutrient="N"
                value={recommendation.total_npk_applied.N}
                label={t('soilSensor.nitrogen') || 'Nitrogen (N)'}
              />
              <NPKBar
                nutrient="P"
                value={recommendation.total_npk_applied.P}
                label={t('soilSensor.phosphorus') || 'Phosphorus (P)'}
              />
              <NPKBar
                nutrient="K"
                value={recommendation.total_npk_applied.K}
                label={t('soilSensor.potassium') || 'Potassium (K)'}
              />
            </div>
          )}

          {/* Doses */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              {preferOrganic
                ? (t('fertilizer.organicDoses') || 'Organic Fertilizers')
                : (t('fertilizer.chemicalDoses') || 'Fertilizer Doses')
              }
            </h4>
            {recommendation?.recommendations?.map((dose, idx) => (
              <DoseItem key={idx} dose={dose} t={t} />
            ))}
          </div>

          {/* Cost Summary */}
          <div className="flex justify-between items-center p-3 bg-farm-green-50 rounded-lg mb-3">
            <span className="text-sm text-gray-700">
              {t('fertilizer.totalCost') || 'Total Cost'}
            </span>
            <span className="font-bold text-farm-green-700">
              ₹{costPerHectare?.toLocaleString() || 0}/ha
            </span>
          </div>

          {/* Schedule Accordion */}
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full flex items-center justify-between p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              {t('fertilizer.schedule') || 'Application Schedule'}
            </div>
            {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showSchedule && <ScheduleTimeline schedule={schedule} />}

          {/* Safety Notes Accordion */}
          {recommendation?.safety_notes?.length > 0 && (
            <>
              <button
                onClick={() => setShowSafety(!showSafety)}
                className="w-full flex items-center justify-between p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg mt-2"
              >
                <div className="flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                  {t('fertilizer.safetyNotes') || 'Safety Notes'}
                </div>
                {showSafety ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showSafety && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600 pl-4">
                  {recommendation.safety_notes.slice(0, 4).map((note, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-yellow-500 mr-1">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <Sprout className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">{t('fertilizer.noRecommendation') || 'No recommendations available'}</p>
        </div>
      )}
    </div>
  );
};

export default FertilizerRecommendationCard;

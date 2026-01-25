/**
 * PestAlertCard Component
 * Display pest alerts, predictions, and risk status
 * 
 * Features:
 * - Active alerts with severity badges
 * - Outbreak predictions with probability
 * - Seasonal risk indicator
 * - Recommended actions
 */

import React, { useState } from 'react';
import { Bug, AlertTriangle, Shield, ChevronDown, ChevronUp, Clock, MapPin } from 'lucide-react';
import { useTranslation } from '../i18n';
import { usePestIntelligence } from '../hooks/usePestIntelligence';

const SEVERITY_COLORS = {
  low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' }
};

const SEVERITY_LABELS = {
  low: '🟢 Low',
  medium: '🟡 Medium',
  high: '🟠 High',
  critical: '🔴 Critical'
};

/**
 * Individual Alert Item
 */
const AlertItem = ({ alert, expanded, onToggle }) => {
  const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.low;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} mb-2 overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-3">
          <Bug className={`w-5 h-5 ${colors.text}`} />
          <div>
            <span className={`font-medium ${colors.text}`}>{alert.pest_name}</span>
            <span className="text-xs text-gray-500 ml-2">on {alert.crop}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`text-xs px-2 py-1 rounded-full ${colors.badge}`}>
            {SEVERITY_LABELS[alert.severity] || alert.severity}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          <p className="text-sm text-gray-600 mt-2 mb-3">{alert.description}</p>

          <div className="flex items-center text-xs text-gray-500 mb-2">
            <MapPin className="w-3 h-3 mr-1" />
            {alert.district}, {alert.region}
          </div>

          {alert.recommendations && alert.recommendations.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-700 mb-1">Recommended Actions:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {alert.recommendations.slice(0, 3).map((rec, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-farm-green-500 mr-1">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Prediction Card
 */
const PredictionItem = ({ prediction }) => {
  const probability = Math.round(prediction.probability * 100);
  const colors = SEVERITY_COLORS[prediction.risk_level] || SEVERITY_COLORS.low;

  return (
    <div className={`p-3 rounded-lg border ${colors.border} ${colors.bg} mb-2`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-medium ${colors.text}`}>{prediction.pest_name}</span>
        <span className={`text-sm font-bold ${colors.text}`}>{probability}% risk</span>
      </div>

      {/* Probability bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${probability >= 70 ? 'bg-red-500' :
              probability >= 50 ? 'bg-orange-500' :
                probability >= 30 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
          style={{ width: `${probability}%` }}
        />
      </div>

      {prediction.factors && prediction.factors.length > 0 && (
        <ul className="text-xs text-gray-600 space-y-1">
          {prediction.factors.slice(0, 2).map((factor, idx) => (
            <li key={idx} className="flex items-start">
              <AlertTriangle className="w-3 h-3 text-yellow-500 mr-1 mt-0.5 flex-shrink-0" />
              {factor}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Main PestAlertCard Component
 */
const PestAlertCard = ({ crop, location, state, district, weather }) => {
  const { t } = useTranslation();
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [view, setView] = useState('alerts'); // 'alerts' or 'predictions'

  const {
    alerts,
    predictions,
    seasonalRisk,
    hasHighRisk,
    activeAlertCount,
    loading,
    error,
    lastUpdated,
    refresh
  } = usePestIntelligence(crop, location, state, district, weather);

  const toggleAlert = (alertId) => {
    setExpandedAlert(expandedAlert === alertId ? null : alertId);
  };

  // Determine overall status
  const getOverallStatus = () => {
    if (hasHighRisk) return { label: 'High Risk', color: 'text-red-600', bg: 'bg-red-100' };
    if (activeAlertCount > 0) return { label: 'Active Alerts', color: 'text-orange-600', bg: 'bg-orange-100' };
    if (seasonalRisk?.risk_level === 'medium') return { label: 'Moderate Risk', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Low Risk', color: 'text-green-600', bg: 'bg-green-100' };
  };

  const status = getOverallStatus();

  return (
    <div className="card-farm card-glow p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-farm-green-100 rounded-xl mr-3">
            <Bug className="w-5 h-5 text-farm-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">
              {t('pest.title') || 'Pest Intelligence'}
            </h3>
            <div className="flex items-center text-xs text-gray-500">
              <span className={`px-2 py-0.5 rounded-full ${status.bg} ${status.color} font-medium`}>
                {status.label}
              </span>
              {activeAlertCount > 0 && (
                <span className="ml-2">{activeAlertCount} active alerts</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <Clock className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2 mb-3">
        <button
          onClick={() => setView('alerts')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'alerts'
              ? 'bg-farm-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setView('predictions')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'predictions'
              ? 'bg-farm-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Predictions ({predictions.length})
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {loading && alerts.length === 0 && predictions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bug className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            <p>Loading pest data...</p>
          </div>
        ) : error && alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-sm">Could not load pest data</p>
            <button
              onClick={refresh}
              className="mt-2 text-sm text-farm-green-600 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : view === 'alerts' ? (
          <>
            {alerts.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Shield className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No active pest alerts</p>
                <p className="text-xs text-gray-400 mt-1">Your crop appears safe</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  expanded={expandedAlert === alert.id}
                  onToggle={() => toggleAlert(alert.id)}
                />
              ))
            )}
          </>
        ) : (
          <>
            {predictions.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Shield className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">No pest risk predictions</p>
                <p className="text-xs text-gray-400 mt-1">
                  {crop ? `Looking good for ${crop}` : 'Select a crop for predictions'}
                </p>
              </div>
            ) : (
              predictions.map((pred, idx) => (
                <PredictionItem key={idx} prediction={pred} />
              ))
            )}
          </>
        )}
      </div>

      {/* Seasonal Context */}
      {seasonalRisk && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Seasonal Risk:
              <span className={`ml-1 font-medium ${seasonalRisk.risk_level === 'high' ? 'text-red-600' :
                  seasonalRisk.risk_level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                {seasonalRisk.risk_level?.toUpperCase()}
              </span>
            </span>
            {lastUpdated && (
              <span className="text-gray-400">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PestAlertCard;

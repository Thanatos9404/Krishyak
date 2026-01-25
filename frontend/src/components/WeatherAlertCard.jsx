/**
 * WeatherAlertCard - Display Weather Alerts & Advisories
 * 
 * Shows:
 * - Current weather conditions
 * - Active alerts by severity
 * - Rain forecast summary
 * - Farming recommendations
 */

import React, { useState } from 'react';
import {
  Cloud, CloudRain, Sun, Wind, Droplets,
  AlertTriangle, AlertCircle, Info, Bell, RefreshCw,
  ChevronDown, ChevronUp, Umbrella
} from 'lucide-react';
import { useTranslation } from '../i18n';
import useWeatherAlerts from '../hooks/useWeatherAlerts';

// Severity to style mapping
const severityStyles = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-800',
    icon: AlertTriangle,
    iconColor: 'text-red-500'
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-800',
    icon: AlertCircle,
    iconColor: 'text-orange-500'
  },
  advisory: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-800',
    icon: Info,
    iconColor: 'text-yellow-600'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-800',
    icon: Info,
    iconColor: 'text-blue-500'
  }
};

// Weather icon component
const WeatherIcon = ({ condition, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const iconClass = sizeClasses[size] || sizeClasses.md;

  switch (condition?.toLowerCase()) {
    case 'rain':
    case 'drizzle':
      return <CloudRain className={`${iconClass} text-blue-500`} />;
    case 'clear':
      return <Sun className={`${iconClass} text-yellow-500`} />;
    case 'clouds':
    case 'cloudy':
      return <Cloud className={`${iconClass} text-gray-500`} />;
    default:
      return <Cloud className={`${iconClass} text-gray-400`} />;
  }
};

// Single alert card
const AlertItem = ({ alert, expanded, onClick }) => {
  const style = severityStyles[alert.severity] || severityStyles.info;
  const Icon = style.icon;

  return (
    <div
      className={`${style.bg} ${style.border} border-l-4 rounded-lg p-3 mb-2 cursor-pointer transition-all hover:shadow-md`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-5 h-5 ${style.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${style.text} text-sm`}>{alert.title}</h4>
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-gray-600">{alert.message}</p>
              {alert.recommendation && (
                <div className="bg-white/50 rounded p-2">
                  <p className="text-xs font-medium text-gray-500">Recommendation:</p>
                  <p className="text-sm text-gray-700">{alert.recommendation}</p>
                </div>
              )}
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>
    </div>
  );
};

const WeatherAlertCard = ({ crop = 'default' }) => {
  const { t } = useTranslation();
  const [expandedAlert, setExpandedAlert] = useState(null);

  const {
    currentWeather,
    alerts,
    rainForecast,
    loading,
    error,
    lastUpdated,
    hasAlerts,
    refresh
  } = useWeatherAlerts({ crop, autoFetch: true });

  // Format temperature
  const formatTemp = (temp) => `${Math.round(temp)}°C`;

  // Format time
  const formatTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header with current weather */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <h3 className="font-semibold">
              {t('weather.alerts') || 'Weather Alerts'}
            </h3>
            {hasAlerts && (
              <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 hover:bg-white/20 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {currentWeather && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WeatherIcon condition={currentWeather.condition} size="lg" />
              <div>
                <div className="text-3xl font-bold">
                  {formatTemp(currentWeather.temperature)}
                </div>
                <div className="text-sm text-white/80 capitalize">
                  {currentWeather.description || currentWeather.condition}
                </div>
              </div>
            </div>

            <div className="text-right text-sm space-y-1">
              <div className="flex items-center gap-1 justify-end">
                <Droplets className="w-4 h-4" />
                <span>{currentWeather.humidity}%</span>
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Wind className="w-4 h-4" />
                <span>{Math.round(currentWeather.wind_speed)} km/h</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="text-center py-4 text-red-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && !currentWeather && (
          <div className="text-center py-6">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          </div>
        )}

        {/* Rain Forecast Summary */}
        {rainForecast && (
          <div className="mb-4 bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Umbrella className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">
                {t('weather.rainForecast') || '7-Day Rain Forecast'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {rainForecast.total_rain_mm}mm
                </div>
                <div className="text-xs text-blue-600">{t('weather.totalRain') || 'Total Rain'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {rainForecast.rain_days}
                </div>
                <div className="text-xs text-blue-600">{t('weather.rainyDays') || 'Rainy Days'}</div>
              </div>
            </div>
            <p className="text-sm text-blue-700">{rainForecast.summary}</p>
          </div>
        )}

        {/* Alerts List */}
        {hasAlerts ? (
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t('weather.activeAlerts') || 'Active Alerts'}
            </h4>
            {alerts.map((alert, idx) => (
              <AlertItem
                key={alert.id || idx}
                alert={alert}
                expanded={expandedAlert === idx}
                onClick={() => setExpandedAlert(expandedAlert === idx ? null : idx)}
              />
            ))}
          </div>
        ) : (
          !loading && (
            <div className="text-center py-4">
              <Sun className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {t('weather.noAlerts') || 'No weather alerts at this time'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {t('weather.goodConditions') || 'Conditions are favorable for farming'}
              </p>
            </div>
          )
        )}

        {/* Last updated */}
        {lastUpdated && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center">
            {t('common.lastUpdated') || 'Last updated'}: {formatTime(lastUpdated)}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherAlertCard;

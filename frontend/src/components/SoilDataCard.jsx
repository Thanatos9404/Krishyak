/**
 * SoilDataCard - Display Real-Time Soil Sensor Data
 * 
 * Shows:
 * - NPK levels with visual indicators
 * - pH value with color coding
 * - Moisture and temperature
 * - Connection status
 * - Last updated timestamp
 */

import React, { useState } from 'react';
import {
  Leaf, Droplets, Thermometer, Gauge,
  Wifi, WifiOff, RefreshCw, AlertCircle,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useTranslation } from '../i18n';
import useSoilSensor from '../hooks/useSoilSensor';
import ManualSoilInput from './ManualSoilInput';

// pH color scale
const getPhColor = (ph) => {
  if (ph < 4.5) return 'text-red-600 bg-red-100';
  if (ph < 5.5) return 'text-orange-600 bg-orange-100';
  if (ph < 6.0) return 'text-yellow-600 bg-yellow-100';
  if (ph < 7.0) return 'text-green-600 bg-green-100';
  if (ph < 7.5) return 'text-emerald-600 bg-emerald-100';
  if (ph < 8.5) return 'text-blue-600 bg-blue-100';
  return 'text-purple-600 bg-purple-100';
};

// NPK level indicator
const NutrientBar = ({ label, value, max, unit, color }) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">{value.toFixed(1)} {unit}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const SoilDataCard = ({ deviceId = 'default', onDataUpdate }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [showManualInput, setShowManualInput] = useState(false);

  const {
    data,
    loading,
    error,
    source,
    isStale,
    lastUpdated,
    connectionStatus,
    hasData,
    refresh,
    submitManualData,
  } = useSoilSensor(deviceId);

  // Handle manual input submission
  const handleManualSubmit = async (manualData) => {
    const result = await submitManualData(manualData);
    if (result.success) {
      setShowManualInput(false);
      if (onDataUpdate) {
        onDataUpdate(result.data);
      }
    }
    return result;
  };

  // Format last updated time
  const formatLastUpdated = (date) => {
    if (!date) return 'N/A';
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  // Connection status indicator - show honest source labels
  const StatusIndicator = () => {
    // If source is cached or unknown and there's no real sensor, show honest label
    const isRealSensor = connectionStatus === 'connected' && source === 'sensor';
    const statusConfig = {
      connected: isRealSensor
        ? { icon: Wifi, color: 'text-green-500', label: 'Live Sensor' }
        : { icon: Leaf, color: 'text-blue-500', label: 'Sample Data' },
      disconnected: { icon: WifiOff, color: 'text-gray-400', label: 'No Sensor' },
      offline: { icon: WifiOff, color: 'text-yellow-500', label: 'Cached Data' },
      error: { icon: AlertCircle, color: 'text-gray-400', label: 'No Sensor' },
      unknown: { icon: Leaf, color: 'text-gray-400', label: 'Manual Entry' },
    };
    // Override if source is manual
    if (source === 'manual') {
      const config = { icon: Leaf, color: 'text-blue-500', label: 'Manual Entry' };
      const Icon = config.icon;
      return (
        <div className={`flex items-center gap-1 ${config.color}`}>
          <Icon className="w-4 h-4" />
          <span className="text-xs">{config.label}</span>
        </div>
      );
    }

    const config = statusConfig[connectionStatus] || statusConfig.unknown;
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-1 ${config.color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-xs">{config.label}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="bg-gradient-to-r from-farm-green-50 to-emerald-50 px-4 py-3 flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-farm-green-600" />
          <h3 className="font-semibold text-gray-800">
            {t('soilSensor.title') || 'Soil Sensor Data'}
          </h3>
          {isStale && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              {t('common.stale') || 'Stale'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator />
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4">
          {loading && !hasData && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-farm-green-500 animate-spin" />
              <span className="ml-2 text-gray-600">{t('common.loading')}</span>
            </div>
          )}

          {error && !hasData && (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => setShowManualInput(true)}
                className="bg-farm-green-500 text-white px-4 py-2 rounded-lg hover:bg-farm-green-600 transition"
              >
                {t('soilSensor.enterManually') || 'Enter Manually'}
              </button>
            </div>
          )}

          {hasData && (
            <>
              {/* NPK Display */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <span>NPK {t('soilSensor.levels') || 'Levels'}</span>
                  <span className="text-xs font-normal text-gray-400">(kg/ha)</span>
                </h4>

                <NutrientBar
                  label={t('soilSensor.nitrogen') || 'Nitrogen (N)'}
                  value={data.nitrogen || 0}
                  max={300}
                  unit="kg/ha"
                  color="bg-blue-500"
                />
                <NutrientBar
                  label={t('soilSensor.phosphorus') || 'Phosphorus (P)'}
                  value={data.phosphorus || 0}
                  max={100}
                  unit="kg/ha"
                  color="bg-orange-500"
                />
                <NutrientBar
                  label={t('soilSensor.potassium') || 'Potassium (K)'}
                  value={data.potassium || 0}
                  max={300}
                  unit="kg/ha"
                  color="bg-purple-500"
                />
              </div>

              {/* pH, Moisture, Temperature Row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {/* pH */}
                <div className={`rounded-lg p-3 text-center ${getPhColor(data.ph || 7)}`}>
                  <Gauge className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-lg font-bold">{(data.ph || 7).toFixed(1)}</div>
                  <div className="text-xs opacity-75">pH</div>
                </div>

                {/* Moisture */}
                <div className="rounded-lg p-3 text-center bg-sky-100 text-sky-700">
                  <Droplets className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-lg font-bold">{(data.moisture || 0).toFixed(0)}%</div>
                  <div className="text-xs opacity-75">{t('soilSensor.moisture') || 'Moisture'}</div>
                </div>

                {/* Temperature */}
                <div className="rounded-lg p-3 text-center bg-amber-100 text-amber-700">
                  <Thermometer className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-lg font-bold">{(data.temperature || 25).toFixed(1)}°C</div>
                  <div className="text-xs opacity-75">{t('soilSensor.temp') || 'Temp'}</div>
                </div>
              </div>

              {/* Footer - Source and Actions */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  <span className="capitalize">{source}</span>
                  {lastUpdated && (
                    <span className="ml-2">• {formatLastUpdated(lastUpdated)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={refresh}
                    disabled={loading}
                    className="p-2 text-gray-500 hover:text-farm-green-600 hover:bg-farm-green-50 rounded-lg transition"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="text-xs text-farm-green-600 hover:underline"
                  >
                    {t('soilSensor.editManually') || 'Edit'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Input Modal */}
      {showManualInput && (
        <ManualSoilInput
          deviceId={deviceId}
          initialData={data}
          onSubmit={handleManualSubmit}
          onClose={() => setShowManualInput(false)}
        />
      )}
    </div>
  );
};

export default SoilDataCard;

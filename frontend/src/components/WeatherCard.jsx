import React, { useState } from 'react';
import { MapPin, CloudRain, Thermometer, Droplets, RefreshCw, Loader2, Leaf } from 'lucide-react';
import { getLocationBasedData } from '../api/weatherApi';
import { useTranslation } from '../i18n';

const WeatherCard = ({ onWeatherUpdate }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const detectLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get all location-based data (weather, soil, rainfall)
      const data = await getLocationBasedData();
      setLocationData(data);

      // Build success feedback message
      const cityName = data.location?.city || data.location?.district || 'your location';
      const stateName = data.location?.state || '';
      setSuccessToast(
        `📍 Detected: ${cityName}${stateName ? `, ${stateName}` : ''} — Soil set to ${data.soil_type || 'Auto'}, Rainfall set to ${data.expected_rainfall || '—'} mm`
      );

      // Auto-hide toast after 8 seconds
      setTimeout(() => setSuccessToast(null), 8000);

      // Update parent form with all detected data
      if (onWeatherUpdate) {
        onWeatherUpdate({
          expected_rainfall: data.expected_rainfall,
          rainfall_delay: data.rainfall_delay,
          soil_type: data.soil_type
        });
      }

    } catch (err) {
      console.error('Location error:', err);
      setSuccessToast(null);
      if (err.code === 1) {
        setError(t('weatherCard.errors.denied') || 'Location permission denied. Please enable it in browser settings, or enter your location manually below.');
      } else if (err.message === 'Geolocation not supported') {
        setError(t('weatherCard.errors.notSupported') || 'Geolocation is not supported by your browser. Please enter your location manually.');
      } else if (err.message?.includes('timed out')) {
        setError('Location detection timed out. Please enter your district and state manually below.');
      } else {
        setError(t('weatherCard.errors.failed') || 'Could not detect location. Please enter your details manually.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Detect Location Button */}
      <button
        onClick={detectLocation}
        disabled={loading}
        className="w-full flex items-center justify-center bg-gradient-to-r from-sky-blue-500 to-sky-blue-600 text-white py-3 px-4 rounded-xl hover:from-sky-blue-600 hover:to-sky-blue-700 transition-all duration-300 disabled:opacity-70 shadow-md hover:shadow-lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {t('weatherCard.detecting')}
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5 mr-2" />
            {t('weatherCard.autoDetect')}
          </>
        )}
      </button>

      {/* Success Toast */}
      {successToast && (
        <div className="bg-green-50 text-green-700 rounded-xl p-3 text-sm border border-green-200 flex items-start gap-2 animate-fade-in">
          <span className="text-green-500 font-bold">✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* Location Data Display */}
      {locationData && (
        <div className="bg-gradient-to-br from-sky-blue-50 to-green-50 rounded-xl p-4 space-y-3 animate-fade-in">
          {/* Location Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <MapPin className="w-4 h-4 text-sky-blue-600 mr-2" />
              <span className="font-semibold text-gray-800">
                {locationData.location?.city || locationData.location?.district || 'Detected'}, {locationData.location?.state || 'India'}
              </span>
            </div>
            <button
              onClick={detectLocation}
              disabled={loading}
              className="p-1 hover:bg-white/50 rounded-full transition-colors"
              title={t('common.refresh') || "Refresh"}
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Zone Info */}
          {locationData.zone && locationData.zone !== 'Unknown' && (
            <p className="text-xs text-gray-500 -mt-2">
              {locationData.zone} {t('weatherCard.region')}
            </p>
          )}

          {/* Current Weather */}
          {locationData.weather && (
            <div className="flex items-center justify-between bg-white/50 rounded-lg p-3">
              <div className="flex items-center">
                <Thermometer className="w-5 h-5 text-orange-500 mr-2" />
                <span className="text-2xl font-bold text-gray-800">{locationData.weather.current?.temp || '--'}°C</span>
              </div>
              <div className="flex items-center">
                <Droplets className="w-4 h-4 text-sky-blue-500 mr-1" />
                <span className="text-sm text-gray-600">{locationData.weather.current?.humidity || '--'}%</span>
              </div>
            </div>
          )}

          {/* Auto-detected Data Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Soil Type */}
            <div className="bg-white/60 rounded-lg p-3">
              <div className="flex items-center mb-1">
                <Leaf className="w-4 h-4 text-farm-green-600 mr-1" />
                <span className="text-xs font-semibold text-gray-600">{t('weatherCard.soilType')}</span>
              </div>
              <p className="text-lg font-bold text-farm-green-700">
                {locationData.soil_type}
              </p>
              <p className="text-xs text-green-600">{t('weatherCard.autoFilled')}</p>
            </div>

            {/* Rainfall */}
            <div className="bg-white/60 rounded-lg p-3">
              <div className="flex items-center mb-1">
                <CloudRain className="w-4 h-4 text-sky-blue-600 mr-1" />
                <span className="text-xs font-semibold text-gray-600">{t('weatherCard.avgRainfall')}</span>
              </div>
              <p className="text-lg font-bold text-sky-blue-700">
                {locationData.expected_rainfall} mm
              </p>
              <p className="text-xs text-green-600">{t('weatherCard.autoFilled')}</p>
            </div>
          </div>

          {/* Monsoon Delay Warning */}
          {locationData.rainfall_delay > 0 && (
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <p className="text-sm text-yellow-800">
                {t('weatherCard.monsoonWarning', { days: locationData.rainfall_delay })}
              </p>
            </div>
          )}

          {/* Mock Data Notice */}
          {locationData.weather?.isMock && (
            <p className="text-xs text-gray-400 text-center">
              {t('weatherCard.demoData')}
            </p>
          )}
        </div>
      )}

      {/* Helper Text */}
      {!locationData && !error && (
        <p className="text-xs text-gray-500 text-center">
          {t('weatherCard.clickToDetect')}
        </p>
      )}
    </div>
  );
};

export default WeatherCard;

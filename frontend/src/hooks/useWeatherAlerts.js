/**
 * useWeatherAlerts - React Hook for Weather Alerts & Forecasts
 * 
 * Fetches weather alerts, forecasts, and rain predictions
 * with automatic location detection and refresh
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Default coordinates (India center)
const DEFAULT_LOCATION = { lat: 20.5937, lon: 78.9629 };

/**
 * Weather Alerts Hook
 * @param {object} options - Configuration options
 */
const useWeatherAlerts = (options = {}) => {
  const {
    autoFetch = true,
    refreshInterval = 600000, // 10 minutes
    crop = 'default',
    location: initialLocation = null,
  } = options;

  // State
  const [location, setLocation] = useState(initialLocation);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [rainForecast, setRainForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  /**
   * Get user's current location via browser geolocation
   */
  const detectLocation = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        setLocation(DEFAULT_LOCATION);
        resolve(DEFAULT_LOCATION);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          setLocation(loc);
          resolve(loc);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setLocation(DEFAULT_LOCATION);
          resolve(DEFAULT_LOCATION);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  /**
   * Fetch current weather
   */
  const fetchCurrentWeather = useCallback(async (loc) => {
    try {
      const response = await fetch(`${API_BASE}/weather/current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: loc.lat, lon: loc.lon })
      });

      if (!response.ok) throw new Error('Weather fetch failed');

      const data = await response.json();

      if (data.success) {
        setCurrentWeather(data.data);
        return data.data;
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
    }
    return null;
  }, []);

  /**
   * Fetch weather alerts
   */
  const fetchAlerts = useCallback(async (loc, cropType = crop) => {
    try {
      const response = await fetch(`${API_BASE}/weather/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: loc.lat, lon: loc.lon, crop: cropType })
      });

      if (!response.ok) throw new Error('Alerts fetch failed');

      const data = await response.json();

      if (data.success) {
        setAlerts(data.alerts || []);
        return data.alerts;
      }
    } catch (err) {
      console.error('Alerts fetch error:', err);
    }
    return [];
  }, [crop]);

  /**
   * Fetch weather forecast
   */
  const fetchForecast = useCallback(async (loc) => {
    try {
      const response = await fetch(`${API_BASE}/weather/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: loc.lat, lon: loc.lon })
      });

      if (!response.ok) throw new Error('Forecast fetch failed');

      const data = await response.json();

      if (data.success) {
        setForecast(data.forecast || []);
        return data.forecast;
      }
    } catch (err) {
      console.error('Forecast fetch error:', err);
    }
    return [];
  }, []);

  /**
   * Fetch rain forecast summary
   */
  const fetchRainForecast = useCallback(async (loc) => {
    try {
      const response = await fetch(`${API_BASE}/weather/rain-forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: loc.lat, lon: loc.lon })
      });

      if (!response.ok) throw new Error('Rain forecast failed');

      const data = await response.json();

      if (data.success) {
        setRainForecast(data);
        return data;
      }
    } catch (err) {
      console.error('Rain forecast error:', err);
    }
    return null;
  }, []);

  /**
   * Fetch all weather data
   */
  const fetchAll = useCallback(async (cropType) => {
    setLoading(true);
    setError(null);

    try {
      let loc = location;

      // Detect location if not set
      if (!loc) {
        loc = await detectLocation();
      }

      if (!loc) {
        throw new Error('Unable to determine location');
      }

      // Fetch all data in parallel
      await Promise.all([
        fetchCurrentWeather(loc),
        fetchAlerts(loc, cropType || crop),
        fetchForecast(loc),
        fetchRainForecast(loc)
      ]);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Weather data fetch error:', err);
      setError(err.message || 'Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  }, [location, crop, detectLocation, fetchCurrentWeather, fetchAlerts, fetchForecast, fetchRainForecast]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Update location and refetch
   */
  const updateLocation = useCallback((newLocation) => {
    setLocation(newLocation);
    fetchAll();
  }, [fetchAll]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    if (autoFetch) {
      fetchAll();
    }

    if (autoFetch && refreshInterval > 0) {
      const interval = setInterval(fetchAll, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoFetch, refreshInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed values
  const hasAlerts = alerts.length > 0;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning');
  const hasCriticalAlerts = criticalAlerts.length > 0;

  const rainExpected = rainForecast?.total_rain_mm > 10;
  const rainDays = rainForecast?.rain_days || 0;

  return {
    // Data
    location,
    currentWeather,
    alerts,
    forecast,
    rainForecast,

    // Status
    loading,
    error,
    lastUpdated,

    // Computed
    hasAlerts,
    hasCriticalAlerts,
    criticalAlerts,
    rainExpected,
    rainDays,

    // Actions
    refresh,
    detectLocation,
    updateLocation,
    fetchAlerts,
  };
};

export default useWeatherAlerts;

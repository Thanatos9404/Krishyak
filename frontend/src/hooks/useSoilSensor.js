/**
 * useSoilSensor - React Hook for Soil Sensor Data Management
 * Handles automatic fetching, caching, manual input fallback
 * 
 * Features:
 * - Auto-refresh with configurable interval
 * - Local storage fallback for offline support
 * - Connection status monitoring
 * - Manual input mode when sensors unavailable
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL as API_BASE } from '../config/api';

// Local storage key for offline cache
const SOIL_CACHE_KEY = 'krishyak_soil_data';

const isSoilReading = (data, deviceId) => {
  if (!data || typeof data !== 'object' || data.device_id !== deviceId ||
      typeof data.timestamp !== 'string' || !Number.isFinite(Date.parse(data.timestamp))) return false;
  const bounds = {nitrogen: [0, 500], phosphorus: [0, 200], potassium: [0, 500],
    ph: [0, 14], moisture: [0, 100], temperature: [-10, 60]};
  if (!Object.entries(bounds).every(([key, [min, max]]) =>
    Number.isFinite(data[key]) && data[key] >= min && data[key] <= max)) return false;
  return [['organic_carbon', 100], ['electrical_conductivity', Infinity]].every(([key, max]) =>
    data[key] == null || (Number.isFinite(data[key]) && data[key] >= 0 && data[key] <= max));
};

const readCache = () => {
  const parsed = JSON.parse(localStorage.getItem(SOIL_CACHE_KEY) || '{}');
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};

/**
 * Get cached soil data from localStorage
 */
const getCachedData = (deviceId) => {
  try {
    const cache = readCache();
    return Object.prototype.hasOwnProperty.call(cache, deviceId) && isSoilReading(cache[deviceId], deviceId)
      ? cache[deviceId] : null;
  } catch {
    return null;
  }
};

/**
 * Save soil data to localStorage cache
 */
const setCachedData = (deviceId, data) => {
  try {
    const cache = {...readCache(), [deviceId]: {
      ...data,
      cachedAt: new Date().toISOString()
    }};
    localStorage.setItem(SOIL_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to cache soil data:', e);
  }
};

/**
 * Soil Sensor Hook
 * @param {string} deviceId - Sensor device ID (or plot identifier for manual input)
 * @param {object} options - Configuration options
 */
const useSoilSensor = (deviceId = 'default', options = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    useFallbackCache = true,
  } = options;

  const requestSequence = useRef(0);
  const saving = useRef(false);
  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('unknown'); // 'sensor', 'manual', 'cached'
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('unknown');

  /**
   * Fetch soil data from backend API
   */
  const fetchData = useCallback(async () => {
    if (!deviceId || saving.current === deviceId) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/sensors/${encodeURIComponent(deviceId)}/data?use_cache=${useFallbackCache}`);
      if (!response.ok) throw new Error('common.error');
      const result = await response.json();
      if (sequence !== requestSequence.current) return;
      if (!result.success || !isSoilReading(result.data, deviceId)) throw new Error('common.noResults');
      setData(result.data);
      setSource(result.source || 'unknown');
      setIsStale(Boolean(result.is_stale));
      setLastUpdated(new Date(result.data.timestamp));
      setConnectionStatus(result.is_stale ? 'stale' : result.source === 'cached' ? 'offline' : 'connected');
      if (useFallbackCache) setCachedData(deviceId, result.data);
    } catch (err) {
      if (sequence !== requestSequence.current) return;
      const cached = useFallbackCache ? getCachedData(deviceId) : null;
      setData(cached);
      setSource(cached ? 'cached' : 'unknown');
      setIsStale(Boolean(cached));
      setLastUpdated(cached?.timestamp ? new Date(cached.timestamp) : null);
      setConnectionStatus(cached ? 'offline' : 'disconnected');
      setError(err.message === 'common.noResults' ? 'common.noResults' : 'common.error');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [deviceId, useFallbackCache]);

  /**
   * Submit manual soil data input
   */
  const submitManualData = useCallback(async (manualData) => {
    const sequence = ++requestSequence.current;
    saving.current = deviceId;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/sensors/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manualData,
          device_id: deviceId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save soil data');
      }

      const responseData = await response.json();

      if (!responseData.success || !isSoilReading(responseData.data, deviceId)) throw new Error('Failed to save data');
      if (sequence !== requestSequence.current) return { success: true, data: responseData.data };
      if (responseData.success) {
        const soilData = responseData.data;
        setData(soilData);
        setSource('manual');
        setIsStale(false);
        setLastUpdated(new Date(soilData.timestamp));
        setConnectionStatus('connected');

        // Cache locally
        if (useFallbackCache) {
          setCachedData(deviceId, soilData);
        }

        return { success: true, data: soilData };
      } else {
        throw new Error(responseData.error || 'Failed to save data');
      }
    } catch (err) {
      if (sequence === requestSequence.current) setError('validation.saveFailed');
      return { success: false, error: 'validation.saveFailed' };
    } finally {
      if (saving.current === deviceId) saving.current = false;
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [deviceId, useFallbackCache]);

  /**
   * Get historical soil data
   */
  const fetchHistory = useCallback(async (days = 7) => {
    try {
      const response = await fetch(`${API_BASE}/sensors/${encodeURIComponent(deviceId)}/history?days=${days}`);

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const responseData = await response.json();

      if (responseData.success) {
        return Array.isArray(responseData.readings) ? responseData.readings.filter(reading => isSoilReading(reading, deviceId)) : [];
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return [];
    }
  }, [deviceId]);

  /**
   * Force refresh data
   */
  const refresh = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  /**
   * Clear local cache
   */
  const clearCache = useCallback(() => {
    requestSequence.current += 1;
    setData(null);
    setSource('unknown');
    setLastUpdated(null);
    setIsStale(false);
    setLoading(false);
    setConnectionStatus('unknown');
    try {
      const cache = readCache();
      delete cache[deviceId];
      localStorage.setItem(SOIL_CACHE_KEY, JSON.stringify(cache));
      setData(null);
      setSource('unknown');
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  }, [deviceId]);

  // Invalidate old-plot requests even when no refresh timer is enabled.
  useEffect(() => {
    setData(null);
    setSource('unknown');
    setLastUpdated(null);
    setIsStale(false);
    setLoading(false);
    setConnectionStatus('unknown');
    if (deviceId) fetchData();
    const interval = autoRefresh && deviceId ? setInterval(fetchData, refreshInterval) : null;
    return () => {
      if (interval) clearInterval(interval);
      requestSequence.current += 1;
    };
  }, [deviceId, autoRefresh, refreshInterval, fetchData]);

  // Computed values
  const hasData = data !== null;
  const isOnline = connectionStatus === 'connected';
  const needsManualInput = !hasData || (isStale && connectionStatus !== 'connected');

  return {
    // Data
    data,
    loading,
    error,
    source,
    isStale,
    lastUpdated,
    connectionStatus,

    // Computed
    hasData,
    isOnline,
    needsManualInput,

    // Actions
    refresh,
    submitManualData,
    fetchHistory,
    clearCache,
  };
};

export default useSoilSensor;

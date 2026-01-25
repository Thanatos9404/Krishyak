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

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Local storage key for offline cache
const SOIL_CACHE_KEY = 'krishyak_soil_data';

/**
 * Get cached soil data from localStorage
 */
const getCachedData = (deviceId) => {
  try {
    const cache = JSON.parse(localStorage.getItem(SOIL_CACHE_KEY) || '{}');
    return cache[deviceId] || null;
  } catch {
    return null;
  }
};

/**
 * Save soil data to localStorage cache
 */
const setCachedData = (deviceId, data) => {
  try {
    const cache = JSON.parse(localStorage.getItem(SOIL_CACHE_KEY) || '{}');
    cache[deviceId] = {
      ...data,
      cachedAt: new Date().toISOString()
    };
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
    if (!deviceId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/sensors/${deviceId}/data?use_cache=true`);

      if (!response.ok) {
        throw new Error('Failed to fetch soil data');
      }

      const responseData = await response.json();

      if (responseData.success && responseData.data) {
        const soilData = responseData.data;
        setData(soilData);
        setSource(responseData.source || 'sensor');
        setIsStale(responseData.is_stale || false);
        setLastUpdated(new Date(soilData.timestamp));
        setConnectionStatus('connected');

        // Cache locally for offline access
        if (useFallbackCache) {
          setCachedData(deviceId, soilData);
        }
      } else {
        // No data from API, try local cache
        if (useFallbackCache) {
          const cached = getCachedData(deviceId);
          if (cached) {
            setData(cached);
            setSource('cached');
            setIsStale(true);
            setLastUpdated(new Date(cached.cachedAt || cached.timestamp));
            setConnectionStatus('offline');
          } else {
            setError('No soil data available');
            setConnectionStatus('disconnected');
          }
        }
      }
    } catch (err) {
      console.error('Soil sensor fetch error:', err);
      setConnectionStatus('error');

      // Fallback to local cache on error
      if (useFallbackCache) {
        const cached = getCachedData(deviceId);
        if (cached) {
          setData(cached);
          setSource('cached');
          setIsStale(true);
          setLastUpdated(new Date(cached.cachedAt || cached.timestamp));
        } else {
          setError(err.message || 'Failed to fetch soil data');
        }
      } else {
        setError(err.message || 'Failed to fetch soil data');
      }
    } finally {
      setLoading(false);
    }
  }, [deviceId, useFallbackCache]);

  /**
   * Submit manual soil data input
   */
  const submitManualData = useCallback(async (manualData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/sensors/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          ...manualData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save soil data');
      }

      const responseData = await response.json();

      if (responseData.success) {
        const soilData = responseData.data;
        setData(soilData);
        setSource('manual');
        setIsStale(false);
        setLastUpdated(new Date());
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
      const errorMsg = err.message || 'Failed to save soil data';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [deviceId, useFallbackCache]);

  /**
   * Get historical soil data
   */
  const fetchHistory = useCallback(async (days = 7) => {
    try {
      const response = await fetch(`${API_BASE}/sensors/${deviceId}/history?days=${days}`);

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const responseData = await response.json();

      if (responseData.success) {
        return responseData.readings;
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
    fetchData();
  }, [fetchData]);

  /**
   * Clear local cache
   */
  const clearCache = useCallback(() => {
    try {
      const cache = JSON.parse(localStorage.getItem(SOIL_CACHE_KEY) || '{}');
      delete cache[deviceId];
      localStorage.setItem(SOIL_CACHE_KEY, JSON.stringify(cache));
      setData(null);
      setSource('unknown');
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  }, [deviceId]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    if (deviceId) {
      fetchData();
    }

    if (autoRefresh && deviceId) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
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

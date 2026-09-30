/**
 * usePestIntelligence Hook
 * Manage pest alerts, predictions, and farmer report submissions
 * 
 * Features:
 * - Fetch active pest alerts for region
 * - Get outbreak predictions based on weather/location
 * - Submit farmer pest reports
 * - Auto-refresh with configurable interval
 * - Local caching for offline access
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL as API_BASE } from '../config/api';

/**
 * Custom hook for pest intelligence data
 * @param {string} crop - Current crop type
 * @param {object} location - { lat, lon } coordinates
 * @param {string} state - State name
 * @param {string} district - District name (optional)
 * @param {object} weather - { temperature, humidity, rainfall }
 */
export function usePestIntelligence(crop, location, state, district = null, weather = {}) {
  // State
  const [alerts, setAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [seasonalRisk, setSeasonalRisk] = useState(null);
  const [farmerReports, setFarmerReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [governmentFeedStatus, setGovernmentFeedStatus] = useState('unavailable');

  // Refs for interval management
  const refreshIntervalRef = useRef(null);

  // ============================================================================
  // FETCH ALERTS
  // ============================================================================

  const fetchAlerts = useCallback(async () => {
    if (!state) return;

    try {
      const response = await fetch(`${API_BASE}/pest/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          district,
          crop: crop || null
        })
      });

      if (!response.ok) throw new Error('Failed to fetch pest alerts');

      const data = await response.json();

      if (data.success) {
        setGovernmentFeedStatus(data.government_feed_status || 'unavailable');
        setAlerts(data.alerts || []);
        setFarmerReports(data.farmer_reports || []);
        if (data.seasonal_risk) {
          setSeasonalRisk(data.seasonal_risk);
        }

        // Cache to localStorage
        localStorage.setItem('pestAlerts', JSON.stringify({
          schemaVersion: 3,
          region: { state, district, crop },
          alerts: data.alerts,
          farmerReports: data.farmer_reports,
          seasonalRisk: data.seasonal_risk,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error('Error fetching pest alerts:', err);
      setError(err.message);
      setAlerts([]);
      setGovernmentFeedStatus('unavailable');

      // Try to load from cache
      const cached = localStorage.getItem('pestAlerts');
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (cachedData.schemaVersion !== 3 || JSON.stringify(cachedData.region) !== JSON.stringify({ state, district, crop })) return;
          setAlerts(cachedData.alerts || []);
          setFarmerReports(cachedData.farmerReports || []);
          setSeasonalRisk(cachedData.seasonalRisk);
          setGovernmentFeedStatus('cached');
          console.log('Loaded pest alerts from cache');
        } catch (e) {
          // Ignore cache errors
        }
      }

      setError(err.message);
    }
  }, [state, district, crop]);

  // ============================================================================
  // FETCH PREDICTIONS
  // ============================================================================

  const fetchPredictions = useCallback(async () => {
    if (!crop || !Number.isFinite(location?.lat) || !Number.isFinite(location?.lon) ||
        !Number.isFinite(weather.temperature) || !Number.isFinite(weather.humidity) || !Number.isFinite(weather.rainfall)) {
      setPredictions([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/pest/prediction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop,
          lat: location.lat,
          lon: location.lon,
          temperature: weather.temperature,
          humidity: weather.humidity,
          rainfall: weather.rainfall
        })
      });

      if (!response.ok) throw new Error('Failed to fetch pest predictions');

      const data = await response.json();

      if (data.success) {
        setPredictions(data.predictions || []);
        if (data.seasonal_context) {
          setSeasonalRisk(data.seasonal_context);
        }

        // Cache predictions
        localStorage.setItem('pestPredictions', JSON.stringify({
          schemaVersion: 3,
          context: { crop, location, weather },
          predictions: data.predictions,
          seasonalContext: data.seasonal_context,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error('Error fetching pest predictions:', err);
      setPredictions([]);

      // Try to load from cache
      const cached = localStorage.getItem('pestPredictions');
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (cachedData.schemaVersion !== 3 || JSON.stringify(cachedData.context) !== JSON.stringify({ crop, location, weather })) return;
          setPredictions(cachedData.predictions || []);
        } catch (e) {
          // Ignore cache errors
        }
      }
    }
  // Coordinate and weather values determine requests, not parent object identity.
  }, [crop, location?.lat, location?.lon, weather.temperature, weather.humidity, weather.rainfall]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // REFRESH ALL DATA
  // ============================================================================

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchAlerts(),
        fetchPredictions()
      ]);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchAlerts, fetchPredictions]);

  // ============================================================================
  // SUBMIT PEST REPORT
  // ============================================================================

  const submitReport = useCallback(async (reportData) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/pest/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pest_type: reportData.pestType,
          pest_name: reportData.pestName,
          crop: reportData.crop,
          severity: reportData.severity,
          description: reportData.description || '',
          lat: reportData.lat || location?.lat || 0,
          lon: reportData.lon || location?.lon || 0,
          district: reportData.district || district || 'Unknown',
          state: reportData.state || state || 'Unknown',
          photo_url: reportData.photoUrl || null
        })
      });

      if (!response.ok) throw new Error('Failed to submit pest report');

      const data = await response.json();

      if (data.success) {
        // Refresh alerts to include the new report
        await fetchAlerts();
        return { success: true, reportId: data.report_id };
      }

      return { success: false, error: 'Submission failed' };

    } catch (err) {
      console.error('Error submitting pest report:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [location, state, district, fetchAlerts]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial fetch
  useEffect(() => {
    refresh();

    // Set up auto-refresh every 15 minutes
    refreshIntervalRef.current = setInterval(refresh, 15 * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refresh]);

  // Refetch when crop or location changes
  useEffect(() => {
    if (crop && location) {
      fetchPredictions();
    }
  }, [crop, location?.lat, location?.lon, fetchPredictions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const highRiskPests = predictions.filter(p => p.probability >= 0.6);
  const activeAlertCount = alerts.length;
  const hasHighRisk = highRiskPests.length > 0 || alerts.some(a => a.severity === 'high' || a.severity === 'critical');

  return {
    // Data
    alerts,
    predictions,
    seasonalRisk,
    farmerReports,
    highRiskPests,

    // Computed
    activeAlertCount,
    hasHighRisk,

    // State
    loading,
    error,
    lastUpdated,
    governmentFeedStatus,

    // Actions
    refresh,
    submitReport
  };
}

/**
 * Hook for pest history data
 */
export function usePestHistory(crop, state, years = 3) {
  const [history, setHistory] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!crop || !state) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/pest/history?crop=${encodeURIComponent(crop)}&state=${encodeURIComponent(state)}&years=${years}`
      );

      if (!response.ok) throw new Error('Failed to fetch pest history');

      const data = await response.json();

      if (data.success) {
        setHistory(data.outbreaks || []);
        setStatistics(data.report_statistics);
      }
    } catch (err) {
      console.error('Error fetching pest history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [crop, state, years]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    statistics,
    loading,
    error,
    refresh: fetchHistory
  };
}

export default usePestIntelligence;

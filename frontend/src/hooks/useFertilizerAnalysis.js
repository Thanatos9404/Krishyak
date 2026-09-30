/**
 * useFertilizerAnalysis Hook
 * Manage fertilizer recommendations and schedules
 * 
 * Features:
 * - Fetch recommendations based on crop and soil data
 * - Get application schedules by growth stage
 * - Toggle organic alternatives
 * - Local caching for offline access
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL as API_BASE } from '../config/api';

/**
 * Custom hook for fertilizer analysis
 * @param {string} crop - Current crop type
 * @param {number} areaHectares - Farm area
 * @param {object} soilData - { N, P, K, pH } from soil sensor
 * @param {string} growthStage - Current growth stage
 */
export function useFertilizerAnalysis(crop, areaHectares = 1, soilData = null, growthStage = 'basal') {
  const requestSequence = useRef(0);
  const scheduleSequence = useRef(0);
  const alternativesSequence = useRef(0);
  const soilN = soilData?.N ?? soilData?.nitrogen ?? null;
  const soilP = soilData?.P ?? soilData?.phosphorus ?? null;
  const soilK = soilData?.K ?? soilData?.potassium ?? null;
  const soilPH = soilData?.pH ?? soilData?.ph ?? null;
  // State
  const [recommendation, setRecommendation] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [organicAlternatives, setOrganicAlternatives] = useState(null);
  const [preferOrganic, setPreferOrganic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ============================================================================
  // FETCH RECOMMENDATION
  // ============================================================================

  const fetchRecommendation = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setRecommendation(null);
    setLastUpdated(null);
    if (!crop) return;
    const context = JSON.stringify({ crop, areaHectares, growthStage, preferOrganic, soilN, soilP, soilK, soilPH });

    setLoading(true);
    setError(null);

    try {
      const body = {
        crop,
        area_hectares: areaHectares,
        growth_stage: growthStage,
        prefer_organic: preferOrganic
      };

      body.soil_n = soilN;
      body.soil_p = soilP;
      body.soil_k = soilK;
      body.soil_ph = soilPH;

      const response = await fetch(`${API_BASE}/fertilizer/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Failed to fetch fertilizer recommendation');

      const data = await response.json();

      if (sequence !== requestSequence.current) return;
      if (!data.success) throw new Error('Fertilizer recommendation unavailable');
      if (data.success) {
        setRecommendation(data);
        setLastUpdated(new Date());

        try {
          localStorage.setItem('fertilizerRecommendation', JSON.stringify({
            schemaVersion: 3, context, data, timestamp: Date.now()
          }));
        } catch { /* A cache write failure does not invalidate a live response. */ }
      }
    } catch (err) {
      if (sequence !== requestSequence.current) return;
      try {
        const cached = JSON.parse(localStorage.getItem('fertilizerRecommendation'));
        const age = Date.now() - cached?.timestamp;
        if (cached?.schemaVersion === 3 && cached.context === context && age >= 0 && age < 86400000) {
          setRecommendation(cached.data);
        }
      } catch { /* Unavailable or corrupt browser storage is optional. */ }

      setError(err.message);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [crop, areaHectares, soilN, soilP, soilK, soilPH, growthStage, preferOrganic]);

  // ============================================================================
  // FETCH SCHEDULE
  // ============================================================================

  const fetchSchedule = useCallback(async () => {
    const sequence = ++scheduleSequence.current;
    setSchedule(null);
    if (!crop) return;

    try {
      const response = await fetch(
        `${API_BASE}/fertilizer/schedule?crop=${encodeURIComponent(crop)}&area_hectares=${areaHectares}`
      );

      if (!response.ok) throw new Error('Failed to fetch schedule');

      const data = await response.json();

      if (sequence === scheduleSequence.current && data.success) {
        setSchedule(data);
      }
    } catch (err) {
      console.error('Error fetching fertilizer schedule:', err);
    }
  }, [crop, areaHectares]);

  // ============================================================================
  // FETCH ORGANIC ALTERNATIVES
  // ============================================================================

  const fetchOrganicAlternatives = useCallback(async () => {
    const sequence = ++alternativesSequence.current;
    setOrganicAlternatives(null);
    if (!crop) return;

    try {
      const response = await fetch(
        `${API_BASE}/fertilizer/alternatives?crop=${encodeURIComponent(crop)}`
      );

      if (!response.ok) throw new Error('Failed to fetch organic alternatives');

      const data = await response.json();

      if (sequence === alternativesSequence.current && data.success) {
        setOrganicAlternatives(data);
      }
    } catch (err) {
      console.error('Error fetching organic alternatives:', err);
    }
  }, [crop]);

  // ============================================================================
  // TOGGLE ORGANIC MODE
  // ============================================================================

  const toggleOrganic = useCallback(() => {
    setPreferOrganic(prev => !prev);
  }, []);

  // ============================================================================
  // REFRESH ALL
  // ============================================================================

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchRecommendation(),
      fetchSchedule(),
      fetchOrganicAlternatives()
    ]);
  }, [fetchRecommendation, fetchSchedule, fetchOrganicAlternatives]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch when crop changes
  useEffect(() => {
    if (crop) {
      fetchRecommendation();
      fetchSchedule();
      fetchOrganicAlternatives();
    } else {
      requestSequence.current += 1;
      scheduleSequence.current += 1;
      alternativesSequence.current += 1;
      setRecommendation(null);
      setSchedule(null);
      setOrganicAlternatives(null);
      setLoading(false);
    }
  }, [crop, fetchRecommendation, fetchSchedule, fetchOrganicAlternatives]);

  useEffect(() => () => {
    requestSequence.current += 1;
    scheduleSequence.current += 1;
    alternativesSequence.current += 1;
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const totalCost = recommendation?.total_cost_inr || 0;
  const costPerHectare = recommendation?.cost_per_hectare || 0;
  const hasRecommendation = recommendation?.success === true;

  return {
    // Data
    recommendation,
    schedule,
    organicAlternatives,

    // State
    preferOrganic,
    loading,
    error,
    lastUpdated,

    // Computed
    totalCost,
    costPerHectare,
    hasRecommendation,

    // Actions
    toggleOrganic,
    refresh
  };
}

export default useFertilizerAnalysis;

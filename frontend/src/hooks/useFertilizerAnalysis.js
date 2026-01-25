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

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Custom hook for fertilizer analysis
 * @param {string} crop - Current crop type
 * @param {number} areaHectares - Farm area
 * @param {object} soilData - { N, P, K, pH } from soil sensor
 * @param {string} growthStage - Current growth stage
 */
export function useFertilizerAnalysis(crop, areaHectares = 1, soilData = null, growthStage = 'basal') {
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
    if (!crop) return;

    setLoading(true);
    setError(null);

    try {
      const body = {
        crop,
        area_hectares: areaHectares,
        growth_stage: growthStage,
        prefer_organic: preferOrganic
      };

      // Add soil data if available
      if (soilData) {
        body.soil_n = soilData.N || soilData.nitrogen || null;
        body.soil_p = soilData.P || soilData.phosphorus || null;
        body.soil_k = soilData.K || soilData.potassium || null;
        body.soil_ph = soilData.pH || null;
      }

      const response = await fetch(`${API_BASE}/fertilizer/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Failed to fetch fertilizer recommendation');

      const data = await response.json();

      if (data.success) {
        setRecommendation(data);
        setLastUpdated(new Date());

        // Cache to localStorage
        localStorage.setItem('fertilizerRecommendation', JSON.stringify({
          ...data,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error('Error fetching fertilizer recommendation:', err);

      // Try to load from cache
      const cached = localStorage.getItem('fertilizerRecommendation');
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (cachedData.crop === crop) {
            setRecommendation(cachedData);
            console.log('Loaded fertilizer recommendation from cache');
          }
        } catch (e) {
          // Ignore cache errors
        }
      }

      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [crop, areaHectares, soilData, growthStage, preferOrganic]);

  // ============================================================================
  // FETCH SCHEDULE
  // ============================================================================

  const fetchSchedule = useCallback(async () => {
    if (!crop) return;

    try {
      const response = await fetch(
        `${API_BASE}/fertilizer/schedule?crop=${encodeURIComponent(crop)}&area_hectares=${areaHectares}`
      );

      if (!response.ok) throw new Error('Failed to fetch schedule');

      const data = await response.json();

      if (data.success) {
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
    if (!crop) return;

    try {
      const response = await fetch(
        `${API_BASE}/fertilizer/alternatives?crop=${encodeURIComponent(crop)}`
      );

      if (!response.ok) throw new Error('Failed to fetch organic alternatives');

      const data = await response.json();

      if (data.success) {
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
    }
  }, [crop, fetchRecommendation, fetchSchedule, fetchOrganicAlternatives]);

  // Refetch when organic preference changes - dependencies intentionally limited
  useEffect(() => {
    if (crop && recommendation) {
      fetchRecommendation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferOrganic]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const totalCost = recommendation?.total_cost_inr || 0;
  const costPerHectare = recommendation?.cost_per_hectare || 0;
  const hasRecommendation = recommendation?.recommendations?.length > 0;

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

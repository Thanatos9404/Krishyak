import { useEffect, useRef, useState } from "react";
import farmingApi from "../../api/farmingApi";
import {
  readSimulationCache,
  sameFarmInputs,
  SIMULATION_CACHE_VERSION,
} from "../../utils/simulationCache";

export const DEFAULT_SIMULATION = {
  crop: "Rice",
  soil_type: "Alluvial",
  area_hectares: 2,
  seed_quality: 0.75,
  expected_rainfall: 800,
  rainfall_delay: 0,
  irrigation_frequency: 4,
  fertilizer_mix: { Urea: 100, DAP: 50, MOP: 40, NPK: 0, Organic: 20 },
  pest_probability: 0.2,
  labour_days: 30,
  pest_control_intensity: 0.6,
  sale_month: 2,
  current_market_price: 2500,
  seed_quantity_kg: 100,
};
export function useSimulation() {
  const [formData, setFormData] = useState(DEFAULT_SIMULATION),
    [loading, setLoading] = useState(false),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const sequence = useRef(0),
    current = useRef(formData),
    inputsForResult = useRef(null);
  current.current = formData;
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  useEffect(() => {
    if (
      inputsForResult.current &&
      !sameFarmInputs(inputsForResult.current, formData)
    ) {
      setData(null);
      setSaved(false);
      inputsForResult.current = null;
    }
  }, [formData]);
  useEffect(() => {
    try {
      const cache = readSimulationCache(
        localStorage.getItem("krishyak_sim_cache"),
      );
      if (cache) {
        inputsForResult.current = cache.formData;
        setFormData(cache.formData);
        setSaved(true);
        setData({
          simulation: cache.simulationData,
          comparison: cache.comparisonData,
          recommendations: cache.recommendationData,
        });
      }
    } catch {
      /* Invalid historical cache is intentionally ignored. */
    }
  }, []);
  const run = async () => {
    const request = ++sequence.current,
      inputs = JSON.parse(JSON.stringify(formData));
    const valid = () =>
      request === sequence.current && sameFarmInputs(inputs, current.current);
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const [simulation, comparison, recommendations] = await Promise.all([
        farmingApi.simulate(inputs, 500),
        farmingApi.compareScenarios(inputs, 500),
        farmingApi.getRecommendations(inputs),
      ]);
      if (!valid()) return;
      if (
        ![simulation, comparison, recommendations].every(
          (result) => result?.success === true && result.data,
        )
      )
        throw new Error(
          "The simulation response was incomplete. Please retry.",
        );
      inputsForResult.current = inputs;
      setData({
        simulation: simulation.data,
        comparison: comparison.data,
        recommendations: recommendations.data,
      });
      try {
        localStorage.setItem(
          "krishyak_sim_cache",
          JSON.stringify({
            schemaVersion: SIMULATION_CACHE_VERSION,
            simulationData: simulation.data,
            comparisonData: comparison.data,
            recommendationData: recommendations.data,
            formData: inputs,
            cached_at: new Date().toISOString(),
            source: "cached",
          }),
        );
      } catch {
        /* Optional cache; results remain usable. */
      }
    } catch (problem) {
      if (!valid()) return;
      let cache = null;
      try {
        cache = readSimulationCache(
          localStorage.getItem("krishyak_sim_cache"),
          inputs,
        );
      } catch {
        /* Storage denied. */
      }
      if (cache) {
        inputsForResult.current = inputs;
        setSaved(true);
        setData({
          simulation: cache.simulationData,
          comparison: cache.comparisonData,
          recommendations: cache.recommendationData,
        });
      } else
        setError(
          problem.message ||
            "The simulation could not be completed. Reconnect and retry.",
        );
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  };
  return { formData, setFormData, loading, data, error, saved, run };
}

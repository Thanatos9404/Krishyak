import { useEffect, useRef, useState } from "react";
import farmingApi from "../../api/farmingApi";
import { farmApi } from "../farms/api";
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
export function useSimulation({ contextSelection = null } = {}) {
  const [formData, setFormData] = useState(DEFAULT_SIMULATION),
    [loading, setLoading] = useState(false),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const sequence = useRef(0),
    privateRequest = useRef(null),
    current = useRef(formData),
    inputsForResult = useRef(null);
  current.current = formData;
  useEffect(() => {
    sequence.current++;
    privateRequest.current?.abort();
    setLoading(false);
    setError("");
    setData(null);
    setSaved(false);
  }, [contextSelection]);
  useEffect(
    () => () => {
      sequence.current++;
      privateRequest.current?.abort();
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
      if (contextSelection) {
        if (
          contextSelection.crop_name !== inputs.crop ||
          (contextSelection.price !== null &&
            contextSelection.price !== inputs.current_market_price)
        )
          throw new Error(
            "Review the context again after changing crop or price assumptions.",
          );
        const controller = new AbortController();
        privateRequest.current = controller;
        const result = await farmApi("/farm-context/planning", {
          method: "POST",
          retry: false,
          timeoutMs: 70000,
          signal: controller.signal,
          body: {
            context: contextSelection.context,
            farming_input: inputs,
            market_quote_index: contextSelection.market_quote_index,
            expected_quote_id: contextSelection.expected_quote_id,
            num_simulations: 300,
          },
        });
        if (!valid()) return;
        if (!result?.success || !result.data)
          throw new Error(
            "The simulation response was incomplete. Please retry.",
          );
        inputsForResult.current = inputs;
        setData(result.data);
        return;
      }
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
      if (contextSelection) {
        setError(
          problem.message ||
            "The context scenario could not be completed. Check permissions and retry.",
        );
        return;
      }
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

export const SIMULATION_CACHE_KEY = 'krishyak_sim_cache';
export const SIMULATION_CACHE_VERSION = 3;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const plan = value => record(value) && record(value.yield) && record(value.costs) && record(value.risk)
  && ['profit', 'revenue', 'roi_percentage'].every(key => finite(value[key]))
  && finite(value.yield.total_production_quintals) && finite(value.yield.yield_per_hectare)
  && finite(value.costs.total_cost) && finite(value.risk.overall_risk_score);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export const sameFarmInputs = (first, second) => record(first) && record(second)
  && JSON.stringify(canonical(first)) === JSON.stringify(canonical(second));

export function readSimulationCache(raw, inputs, now = Date.now()) {
  try {
    const cached = JSON.parse(raw || 'null');
    const age = now - Date.parse(cached?.cached_at);
    if (cached?.schemaVersion !== SIMULATION_CACHE_VERSION || !Number.isFinite(age)
      || age < 0 || age > MAX_AGE_MS || !record(cached.formData)
      || typeof cached.formData.crop !== 'string' || typeof cached.formData.soil_type !== 'string'
      || !record(cached.formData.fertilizer_mix) || !(cached.formData.area_hectares > 0)
      || !plan(cached.simulationData) || !plan(cached.comparisonData?.current_plan)
      || !plan(cached.comparisonData?.ai_optimal_plan) || !plan(cached.comparisonData?.worst_case_plan)
      || !record(cached.recommendationData) || (inputs && !sameFarmInputs(cached.formData, inputs))) return null;
    return cached;
  } catch {
    return null;
  }
}

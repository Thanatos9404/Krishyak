import { readSimulationCache, sameFarmInputs } from './simulationCache';

const inputs = {crop:'Rice', soil_type:'Alluvial', area_hectares:2, fertilizer_mix:{Urea:100,DAP:50}};
const plan = {profit:10,revenue:20,roi_percentage:100,yield:{total_production_quintals:1,yield_per_hectare:50},
  costs:{total_cost:10},risk:{overall_risk_score:30}};
const now = Date.parse('2026-09-08T00:00:00Z');
const cache = {schemaVersion:3,cached_at:new Date(now).toISOString(),formData:inputs,simulationData:plan,
  comparisonData:{current_plan:plan,ai_optimal_plan:plan,worst_case_plan:plan},recommendationData:{}};

test('cache matches complete inputs independent of property order', () => {
  const reordered = {...inputs,fertilizer_mix:{DAP:50,Urea:100}};
  expect(sameFarmInputs(inputs,reordered)).toBe(true);
  expect(readSimulationCache(JSON.stringify(cache),reordered,now)).toEqual(cache);
  for (const changed of [{...inputs,crop:'Wheat'},{...inputs,area_hectares:3},
    {...inputs,fertilizer_mix:{Urea:101,DAP:50}}]) {
    expect(readSimulationCache(JSON.stringify(cache),changed,now)).toBeNull();
  }
});

test.each([null,'broken',JSON.stringify({...cache,schemaVersion:2}),
  JSON.stringify({...cache,cached_at:'invalid'}),JSON.stringify({...cache,simulationData:{yield:{}}})])(
  'rejects invalid or obsolete cache %s', raw => expect(readSimulationCache(raw,inputs,now)).toBeNull());

test('saved results expire and cannot be future-dated', () => {
  expect(readSimulationCache(JSON.stringify(cache),inputs,now+86400001)).toBeNull();
  expect(readSimulationCache(JSON.stringify(cache),inputs,now-1)).toBeNull();
});

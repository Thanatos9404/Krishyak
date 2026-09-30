import suggestions from './location_suggestions.json';

// Partial suggestions only; registration accepts typed district/tehsil names.
export const indianStates = suggestions.states;

export const getDistrictsByState = (stateName) => {
  const state = indianStates.find(s => s.name === stateName);
  return state ? state.districts : [];
};

export const getTehsilsByDistrict = (stateName, districtName) => {
  const state = indianStates.find(s => s.name === stateName);
  if (!state) return [];
  const district = state.districts.find(d => d.name === districtName);
  return district ? district.tehsils : [];
};

export default indianStates;

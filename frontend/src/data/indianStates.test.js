import { indianStates, getDistrictsByState, getTehsilsByDistrict } from './indianStates';

test('registration includes all states and union territories without duplicates', () => {
  expect(new Set(indianStates.map(state => state.name)).size).toBe(36);
  expect(indianStates).toHaveLength(36);
  for (const name of ['Mizoram', 'Sikkim', 'Ladakh', 'Puducherry', 'Dadra and Nagar Haveli and Daman and Diu']) {
    expect(indianStates.some(state => state.name === name)).toBe(true);
  }
});

test('district and block suggestions do not invent unknown records', () => {
  expect(getDistrictsByState('Punjab').length).toBeGreaterThan(0);
  expect(getDistrictsByState('not a state')).toEqual([]);
  expect(getTehsilsByDistrict('Punjab', 'not a district')).toEqual([]);
  expect(getTehsilsByDistrict('not a state', 'unknown')).toEqual([]);
});

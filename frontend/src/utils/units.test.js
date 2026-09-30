import { areaInHectares } from './units';

test('registered acres are converted before hectare-based calculations', () => {
  expect(areaInHectares('2', 'acres')).toBeCloseTo(0.80937128448, 10);
  expect(areaInHectares('2', 'hectares')).toBe(2);
});

test.each([['', 'hectares'], ['NaN', 'hectares'], ['Infinity', 'acres'], [-1, 'acres'], [1, 'unknown']])('rejects invalid area %s %s', (value, unit) => {
  expect(areaInHectares(value, unit)).toBeNull();
});

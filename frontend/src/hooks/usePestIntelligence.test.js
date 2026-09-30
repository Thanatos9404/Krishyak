import { renderHook, waitFor } from '@testing-library/react';
import usePestIntelligence from './usePestIntelligence';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('missing weather does not generate a default pest forecast', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, alerts: [], farmer_reports: [] }) }));
  const { result } = renderHook(() => usePestIntelligence('Rice', { lat: 20, lon: 78 }, 'Punjab'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(global.fetch.mock.calls.every(([url]) => !url.endsWith('/pest/prediction'))).toBe(true);
  expect(result.current.predictions).toEqual([]);
});

test('older cached predictions cannot restore the removed regional calculation', async () => {
  const location = { lat: 20, lon: 78 };
  const weather = { temperature: 25, humidity: 70, rainfall: 0 };
  localStorage.setItem('pestPredictions', JSON.stringify({ schemaVersion: 2, context: { crop: 'Rice', location, weather }, predictions: [{ probability: .99 }] }));
  global.fetch = jest.fn(async () => { throw new Error('offline'); });
  const { result } = renderHook(() => usePestIntelligence('Rice', location, 'Punjab', null, weather));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.predictions).toEqual([]);
});

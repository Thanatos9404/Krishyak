import { renderHook, act } from '@testing-library/react';
import useWeatherAlerts from './useWeatherAlerts';

afterEach(() => jest.restoreAllMocks());

test('unavailable weather does not become a zero-rain success', async () => {
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () =>
    url.endsWith('/current') ? { success: false } :
    url.endsWith('/rain-forecast') ? { success: true, available: false, total_rain_mm: null } :
    { success: true, alerts: [], forecast: [] }
  }));
  const { result } = renderHook(() => useWeatherAlerts({ autoFetch: false, location: { lat: 20, lon: 78 } }));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.currentWeather).toBeNull();
  expect(result.current.rainForecast).toBeNull();
  expect(result.current.lastUpdated).toBeNull();
  expect(result.current.error).toBe('Weather data is unavailable');
});

test('changing location fetches the new coordinates', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { temperature: 0 }, total_rain_mm: 0 }) }));
  const { result } = renderHook(() => useWeatherAlerts({ autoFetch: false, location: { lat: 20, lon: 78 } }));
  await act(async () => { await result.current.updateLocation({ lat: 0, lon: 0 }); });
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ lat: 0, lon: 0 });
});

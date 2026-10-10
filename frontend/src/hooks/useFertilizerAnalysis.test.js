import { renderHook, waitFor, act } from '@testing-library/react';
import useFertilizerAnalysis from './useFertilizerAnalysis';

beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('unscheduled stage with zero doses is a valid result', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({success: true, recommendations: [], total_cost_inr: 0}) }));
  const { result } = renderHook(() => useFertilizerAnalysis('Rice', 1, null, 'maturity'));
  await waitFor(() => expect(result.current.hasRecommendation).toBe(true));
  expect(result.current.totalCost).toBe(0);
});

test('legacy crop-only cache cannot restore wrong field or stage doses', async () => {
  localStorage.setItem('fertilizerRecommendation', JSON.stringify({crop: 'Rice', total_cost_inr: 999, recommendations: [{}]}));
  global.fetch = jest.fn(async () => { throw new Error('offline'); });
  const { result } = renderHook(() => useFertilizerAnalysis('Rice', .25, null, 'maturity'));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.recommendation).toBeNull();
});

test('cache quota failure preserves successful recommendation', async () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({success: true, recommendations: [], total_cost_inr: 0}) }));
  const { result } = renderHook(() => useFertilizerAnalysis('Rice'));
  await waitFor(() => expect(result.current.hasRecommendation).toBe(true));
  expect(result.current.error).toBeNull();
});

test('clearing the crop clears prior recommendation and schedule', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({success: true, recommendations: []}) }));
  const { result, rerender } = renderHook(({crop}) => useFertilizerAnalysis(crop), {initialProps:{crop:'Rice'}});
  await waitFor(() => expect(result.current.hasRecommendation).toBe(true));
  rerender({crop: null});
  expect(result.current.recommendation).toBeNull();
  expect(result.current.schedule).toBeNull();
  expect(result.current.loading).toBe(false);
});

test('a delayed previous crop cannot overwrite any current crop result', async () => {
  const pending = [];
  global.fetch = jest.fn((url, options) => new Promise(resolve => {
    const crop = options?.body ? JSON.parse(options.body).crop : new URL(url, 'http://localhost').searchParams.get('crop');
    pending.push({crop, resolve});
  }));
  const { result, rerender } = renderHook(({crop}) => useFertilizerAnalysis(crop), {initialProps:{crop:'Rice'}});
  await waitFor(() => expect(pending.length).toBe(3));
  rerender({crop:'Wheat'});
  await waitFor(() => expect(pending.length).toBe(6));
  const resolveCrop = crop => pending.filter(item => item.crop === crop).forEach(item => item.resolve({ok:true,json:async()=>({success:true,crop,recommendations:[]})}));
  await act(async () => { resolveCrop('Wheat'); });
  await waitFor(() => expect(result.current.organicAlternatives?.crop).toBe('Wheat'));
  await act(async () => { resolveCrop('Rice'); });
  await waitFor(() => {
    expect(result.current.recommendation?.crop).toBe('Wheat');
    expect(result.current.schedule?.crop).toBe('Wheat');
    expect(result.current.organicAlternatives?.crop).toBe('Wheat');
  });
});

test('equivalent soil objects do not repeatedly refetch', async () => {
  global.fetch = jest.fn(async () => ({ok:true,json:async()=>({success:true,recommendations:[]})}));
  const { result, rerender } = renderHook(({soil}) => useFertilizerAnalysis('Rice', 1, soil), {initialProps:{soil:{N:0,P:0,K:0,pH:7}}});
  await waitFor(() => expect(result.current.hasRecommendation).toBe(true));
  const calls = global.fetch.mock.calls.length;
  rerender({soil:{N:0,P:0,K:0,pH:7}});
  expect(global.fetch.mock.calls.length).toBe(calls);
});

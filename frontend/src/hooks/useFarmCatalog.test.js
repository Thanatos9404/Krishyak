import {renderHook, act, waitFor} from '@testing-library/react';
import useFarmCatalog from './useFarmCatalog';
import farmingApi from '../api/farmingApi';
import {API_BASE_URL} from '../config/api';

jest.mock('../api/farmingApi',()=>({__esModule:true,default:{getCrops:jest.fn(),getSoilTypes:jest.fn()}}));
beforeEach(()=>{localStorage.clear();jest.resetAllMocks();});
afterEach(()=>jest.restoreAllMocks());

test('a failed soil request preserves crops and retry recovers', async()=>{
  farmingApi.getCrops.mockResolvedValue({crops:['Rice']});
  farmingApi.getSoilTypes.mockRejectedValue(new Error('offline'));
  const {result}=renderHook(()=>useFarmCatalog());
  await waitFor(()=>expect(result.current.status.soilTypes).toBe('unavailable'));
  expect(result.current.crops).toEqual(['Rice']);
  farmingApi.getSoilTypes.mockResolvedValue({soil_types:['Alluvial']});
  await act(async()=>result.current.reload());
  expect(result.current.status).toEqual({crops:'live',soilTypes:'live'});
});

test('successful catalogs survive storage quota errors', async()=>{
  jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  farmingApi.getCrops.mockResolvedValue({crops:['Rice']});
  farmingApi.getSoilTypes.mockResolvedValue({soil_types:['Alluvial']});
  const {result}=renderHook(()=>useFarmCatalog());
  await waitFor(()=>expect(result.current.status).toEqual({crops:'live',soilTypes:'live'}));
  expect(result.current.crops).toEqual(['Rice']);
});

test.each([[],['Rice','Rice'],[{}],['']].map(items=>[items]))('invalid catalog is unavailable: %j', async items=>{
  farmingApi.getCrops.mockResolvedValue({crops:items});
  farmingApi.getSoilTypes.mockResolvedValue({soil_types:['Alluvial']});
  const {result}=renderHook(()=>useFarmCatalog());
  await waitFor(()=>expect(result.current.status.crops).toBe('unavailable'));
  expect(result.current.crops).toEqual([]);
});

test('only recent entries from this API are reused',async()=>{
  localStorage.setItem('krishyak_catalog_cache_v2',JSON.stringify({api:API_BASE_URL,
    crops:{items:['Rice'],cachedAt:new Date().toISOString()},
    soilTypes:{items:['Alluvial'],cachedAt:'2020-01-01'},
  }));
  farmingApi.getCrops.mockRejectedValue(new Error('offline'));
  farmingApi.getSoilTypes.mockRejectedValue(new Error('offline'));
  const {result}=renderHook(()=>useFarmCatalog());
  await waitFor(()=>expect(result.current.status).toEqual({crops:'cached',soilTypes:'unavailable'}));
  expect(result.current.crops).toEqual(['Rice']);
  expect(result.current.soilTypes).toEqual([]);
});

test('older requests cannot overwrite a newer retry',async()=>{
  let finish;
  farmingApi.getCrops.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}))
    .mockResolvedValue({crops:['Wheat']});
  farmingApi.getSoilTypes.mockResolvedValue({soil_types:['Alluvial']});
  const {result}=renderHook(()=>useFarmCatalog());
  await act(async()=>result.current.reload());
  await act(async()=>finish({crops:['Rice']}));
  expect(result.current.crops).toEqual(['Wheat']);
});

test.each([
  {api:'https://different.example',cachedAt:new Date().toISOString()},
  {api:API_BASE_URL,cachedAt:'invalid'},
  {api:API_BASE_URL,cachedAt:new Date(Date.now()+86400000).toISOString()},
])('rejects foreign or invalid-dated saved data: %j',async({api,cachedAt})=>{
  localStorage.setItem('krishyak_catalog_cache_v2',JSON.stringify({api,crops:{items:['Rice'],cachedAt}}));
  farmingApi.getCrops.mockRejectedValue(new Error('offline'));
  farmingApi.getSoilTypes.mockRejectedValue(new Error('offline'));
  const {result}=renderHook(()=>useFarmCatalog());
  await waitFor(()=>expect(result.current.status.crops).toBe('unavailable'));
  expect(result.current.crops).toEqual([]);
});

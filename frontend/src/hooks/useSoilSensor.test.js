import {renderHook, waitFor, act} from '@testing-library/react';
import useSoilSensor from './useSoilSensor';
const options={autoRefresh:false,useFallbackCache:false};
const sample={device_id:'plot',timestamp:'2026-09-01T12:00:00',nitrogen:0,phosphorus:20,potassium:100,ph:6.5,moisture:40,temperature:25};
beforeEach(()=>localStorage.clear());
afterEach(()=>jest.restoreAllMocks());

test('unavailable refresh clears old data even with cache disabled',async()=>{
  global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({success:true,data:sample,source:'manual',is_stale:true})})
    .mockResolvedValue({ok:true,json:async()=>({success:false})});
  const {result}=renderHook(()=>useSoilSensor('plot',options));
  await waitFor(()=>expect(result.current.hasData).toBe(true));
  expect(result.current.isStale).toBe(true);
  expect(result.current.isOnline).toBe(false);
  await act(async()=>{await result.current.refresh();});
  expect(result.current.data).toBeNull();
  expect(result.current.lastUpdated).toBeNull();
  expect(global.fetch.mock.calls[0][0]).toContain('use_cache=false');
});

test('offline cache uses measurement time rather than recent cache-write time',async()=>{
  localStorage.setItem('krishyak_soil_data',JSON.stringify({plot:{...sample,cachedAt:'2026-09-06T12:00:00'}}));
  global.fetch=jest.fn(async()=>{throw new Error('offline');});
  const {result}=renderHook(()=>useSoilSensor('plot',{autoRefresh:false}));
  await waitFor(()=>expect(result.current.hasData).toBe(true));
  expect(result.current.lastUpdated.getTime()).toBe(new Date(sample.timestamp).getTime());
  expect(result.current.isStale).toBe(true);
});

test('late response from previous plot cannot overwrite selected plot',async()=>{
  const pending=[];
  global.fetch=jest.fn(url=>new Promise(resolve=>pending.push({url,resolve})));
  const {result,rerender}=renderHook(({id})=>useSoilSensor(id,options),{initialProps:{id:'first'}});
  rerender({id:'second'});
  await act(async()=>{pending[1].resolve({ok:true,json:async()=>({success:true,data:{...sample,device_id:'second'}})});});
  await act(async()=>{pending[0].resolve({ok:true,json:async()=>({success:true,data:{...sample,device_id:'first'}})});});
  expect(result.current.data.device_id).toBe('second');
});

test('manual payload cannot override selected plot identifier',async()=>{
  global.fetch=jest.fn(async(url,request)=>({ok:true,json:async()=>request?{success:true,data:{...sample,device_id:'plot'}}:{success:false}}));
  const {result}=renderHook(()=>useSoilSensor('plot',options));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{await result.current.submitManualData({...sample,device_id:'other'});});
  const request=global.fetch.mock.calls.find(([,request])=>request?.method==='POST')[1];
  expect(JSON.parse(request.body).device_id).toBe('plot');
});

test.each([
  {...sample, device_id:'other'}, {...sample, timestamp:'broken'},
  {...sample, nitrogen:null}, {...sample, ph:true}, {...sample, moisture:101},
])('invalid offline readings are not used for recommendations: %j', async cached=>{
  localStorage.setItem('krishyak_soil_data', JSON.stringify({plot:cached}));
  global.fetch=jest.fn(async()=>{throw new Error('offline');});
  const {result}=renderHook(()=>useSoilSensor('plot',{autoRefresh:false}));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.hasData).toBe(false);
  expect(result.current.needsManualInput).toBe(true);
});

test('inherited object keys cannot masquerade as cached readings',async()=>{
  global.fetch=jest.fn(async()=>{throw new Error('offline');});
  const {result}=renderHook(()=>useSoilSensor('constructor',{autoRefresh:false}));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.data).toBeNull();
});

test('wrong-device API response is rejected',async()=>{
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({success:true,data:{...sample,device_id:'other'}})}));
  const {result}=renderHook(()=>useSoilSensor('plot',options));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.hasData).toBe(false);
});

test('manual save with invalid returned measurements is not reported as successful',async()=>{
  global.fetch=jest.fn(async(url,request)=>({ok:true,json:async()=>request
    ? {success:true,data:{...sample,ph:99}} : {success:false}}));
  const {result}=renderHook(()=>useSoilSensor('plot',options));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  let saved;
  await act(async()=>{saved=await result.current.submitManualData(sample);});
  expect(saved.success).toBe(false);
  expect(result.current.hasData).toBe(false);
  expect(result.current.error).toBe('validation.saveFailed');
});

test('history excludes malformed and wrong-plot records',async()=>{
  global.fetch=jest.fn(async url=>({ok:true,json:async()=>url.includes('/history')
    ? {success:true,readings:[sample,{...sample,device_id:'other'},{...sample,temperature:999}]}
    : {success:false}}));
  const {result}=renderHook(()=>useSoilSensor('plot',options));
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(await result.current.fetchHistory()).toEqual([sample]);
});

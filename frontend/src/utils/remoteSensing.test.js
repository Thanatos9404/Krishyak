import { polygonFromVertices, verticesFromPolygon, nearbyVertices, safeRead, safeWrite, readSummary, SUMMARY_KEY, fieldBounds } from './remoteSensing';
import demo from '../data/remoteSensingDemo.json';

beforeEach(() => localStorage.clear());
test('device neighbourhood is a bounded approximately 200 m context square, not an inferred field',()=>{
  const points=nearbyVertices({lat:26.8,lon:73});
  const [west,south,east,north]=fieldBounds(polygonFromVertices(points));
  expect((north-south)*111320).toBeCloseTo(200,5);
  expect((east-west)*111320*Math.cos(26.8*Math.PI/180)).toBeCloseTo(200,5);
  expect(nearbyVertices({lat:26.8,lon:NaN})).toEqual([]);
  expect(nearbyVertices({lat:85,lon:73})).toEqual([]);
  expect(nearbyVertices({lat:26.8,lon:180})).toEqual([]);
});
test('boundary round trip closes once and preserves lon/lat order', () => {
  const points=verticesFromPolygon(demo), polygon=polygonFromVertices(points);
  expect(points.length).toBe(4); expect(polygon).toEqual(demo);
  expect(fieldBounds(polygon)).toEqual([73,26.8,73.002,26.802]);
});
test('malformed, multipart, oversized and nonfinite boundaries are rejected', () => {
  expect(verticesFromPolygon({type:'MultiPolygon',coordinates:[]})).toEqual([]);
  expect(polygonFromVertices([[73,26],[NaN,26],[74,26]])).toBeNull();
  expect(polygonFromVertices([[73,86],[73,26],[74,26]])).toBeNull();
  expect(polygonFromVertices(Array(201).fill([73,26]))).toBeNull();
  expect(polygonFromVertices([[73,26],[74,26]])).toBeNull();
});
test('storage denial and invalid JSON are controlled', () => {
  localStorage.setItem('x','invalid'); expect(safeRead('x')).toBeNull();
  jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  expect(safeWrite('x',{})).toBe(false); jest.restoreAllMocks();
});
test('cached evidence rejects expired, future and malformed summaries', () => {
  const entry={version:1,saved_at:new Date().toISOString(),data:{index:'ndvi',observations:[],provenance:{evidence_type:'remote_sensing_observation',computed_at:new Date().toISOString()}}};
  safeWrite(SUMMARY_KEY,entry); expect(readSummary()).toEqual(entry);
  for (const bad of [{...entry,saved_at:new Date(Date.now()-31*86400000).toISOString()}, {...entry,saved_at:new Date(Date.now()+60000).toISOString()}, {...entry,data:{...entry.data,index:'invalid'}}, {...entry,data:{...entry.data,observations:[{}]}}]) {
    safeWrite(SUMMARY_KEY,bad); expect(readSummary()).toBeNull();
  }
});

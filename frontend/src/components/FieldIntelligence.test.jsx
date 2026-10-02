import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FieldIntelligence from './FieldIntelligence';
import api from '../api/remoteSensingApi';
import english from '../i18n/locales/en.json';
import feature from '../i18n/locales/remote-sensing/en.json';
import demo from '../data/remoteSensingDemo.json';
import { FIELD_KEY, SUMMARY_KEY, safeWrite } from '../utils/remoteSensing';
import { getCurrentLocation } from '../api/weatherApi';
import { getLocationContext } from '../api/locationContextApi';

jest.mock('../api/remoteSensingApi',()=>({__esModule:true,default:{status:jest.fn(),geometry:jest.fn(),acquisitions:jest.fn(),timeseries:jest.fn(),preview:jest.fn(),climate:jest.fn()}}));
jest.mock('../api/weatherApi',()=>({getCurrentLocation:jest.fn()}));
jest.mock('../api/locationContextApi',()=>({getLocationContext:jest.fn()}));
jest.mock('../i18n',()=>{
  const messages={...require('../i18n/locales/en.json'),...require('../i18n/locales/remote-sensing/en.json')};
  return {useTranslation:()=>({languageInfo:{speechCode:'en-IN'},t:key=>key.split('.').reduce((v,k)=>v?.[k],messages)||key})};
});
jest.mock('./FieldMap',()=>({__esModule:true,default:({onVertices,drawing})=><div data-testid="map"><button onClick={()=>onVertices(require('../data/remoteSensingDemo.json').coordinates[0].slice(0,-1))}>Map field</button><span>{String(drawing)}</span></div>}));
jest.mock('./FieldTrendChart',()=>({__esModule:true,default:({index,observations})=><div data-testid="chart">{index}:{observations.length}</div>}));
const text=feature.remoteSensing;
const area={hectares:4.4067,acres:10.8892,square_metres:44067.09};
const data=()=>({index:'ndvi',area,observations:[{start:'2026-01-01T00:00:00Z',end:'2026-01-11T00:00:00Z',mean:.6,valid_fraction:.9,quality_status:'clear'}],status:'clear',trend:{status:'stable'},provenance:{evidence_type:'remote_sensing_observation',computed_at:new Date().toISOString(),spatial_resolution_m:10,formula:'(B08-B04)/(B08+B04)',requested_geometry_hash:'fixture-digest',source_url:'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html'}});
const props={formData:{crop:'Rice',area_hectares:2},farmer:{district:'Jodhpur'},onNavigate:jest.fn()};
beforeEach(()=>{
  jest.clearAllMocks(); localStorage.clear();
  Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:undefined});
  getCurrentLocation.mockResolvedValue({lat:26.8,lon:73,accuracy:12});
  getLocationContext.mockResolvedValue({location:{city:'Jodhpur',state:'Rajasthan'},weather:{isMock:false,current:{temp:30,humidity:60,observed_at:'2026-09-30T10:00:00Z'}},climate:{mean_temperature_c:26,mean_annual_precipitation_mm:300,computed_at:'2026-09-30T10:00:00Z'},pests:{reports:[]}});
  api.status.mockResolvedValue({status:'ready'}); api.geometry.mockResolvedValue({area});
  api.acquisitions.mockResolvedValue({acquisitions:[{acquired_at:'2026-01-02T10:00:00Z'}],truncated:false});
  api.timeseries.mockResolvedValue(data()); api.preview.mockResolvedValue(new Blob(['PNG'],{type:'image/png'}));
  URL.createObjectURL=jest.fn(()=> 'blob:test'); URL.revokeObjectURL=jest.fn();
});
const show=async()=>{render(<FieldIntelligence {...props}/>); await waitFor(()=>expect(screen.getByText(text.analyze).disabled).toBe(false));};
const chooseDemo=()=>fireEvent.click(screen.getByText(text.demo));
const analyze=async()=>{chooseDemo(); fireEvent.click(screen.getByText(text.analyze)); await screen.findByTestId('chart');};

test('disabled or unconfigured provider leaves mapping and other workflows accessible',async()=>{
  api.status.mockResolvedValue({status:'not_configured'}); render(<FieldIntelligence {...props}/>);
  expect(await screen.findByText(text.setup)).toBeTruthy(); expect(screen.getByText(text.analyze).disabled).toBe(true);
  expect(screen.getByText(text.calculateArea)).toBeTruthy(); expect(api.timeseries).not.toHaveBeenCalled();
});
test('drawing is opt-in and map activity never requests satellite processing',async()=>{
  await show(); expect(screen.queryByTestId('map')).toBeNull();
  fireEvent.click(screen.getByText(text.draw)); await screen.findByTestId('map');
  fireEvent.click(screen.getByText('Map field')); expect(api.timeseries).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(text.calculateArea)); await screen.findByText(text.areaMismatch);
  expect(api.geometry).toHaveBeenCalledWith(demo,expect.anything());
});
test('manual GeoJSON allows keyboard mapping without WebGL and saves only explicitly',async()=>{
  await show(); fireEvent.change(screen.getByLabelText(text.geojson),{target:{value:JSON.stringify(demo)}});
  fireEvent.click(screen.getByText(text.importBoundary)); expect(localStorage.getItem(FIELD_KEY)).toBeNull();
  fireEvent.click(screen.getByText(text.calculateArea)); await screen.findByText(text.areaMismatch);
  fireEvent.click(screen.getByText(text.saveBoundary)); expect(JSON.parse(localStorage.getItem(FIELD_KEY))).toEqual(demo);
});
test('invalid boundary is controlled before processing',async()=>{
  await show(); fireEvent.click(screen.getByText(text.analyze)); expect(screen.getByRole('alert').textContent).toBe(text.invalidField);
  expect(api.timeseries).not.toHaveBeenCalled();
});
test('analysis shows trend, chart, quality and source without automatic image requests',async()=>{
  await show(); await analyze(); expect(screen.getByText(text.stable)).toBeTruthy();
  expect(screen.getByText('90%')).toBeTruthy(); expect(screen.getByText(text.officialSource)).toBeTruthy();
  expect(api.preview).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem(SUMMARY_KEY)).data.index).toBe('ndvi');
  expect(localStorage.getItem(FIELD_KEY)).toBeNull();
});
test('layer switching requires explicit image action and revokes old image',async()=>{
  await show(); await analyze(); fireEvent.change(screen.getByLabelText(text.layer),{target:{value:'ndmi'}});
  expect(api.preview).not.toHaveBeenCalled(); fireEvent.click(screen.getByText(text.loadImage));
  await screen.findByAltText(text.imageAlt);
  expect(api.preview).toHaveBeenCalledWith(expect.objectContaining({layer:'ndmi',start_date:'2026-01-02',end_date:'2026-01-02',width:512}),expect.anything());
  fireEvent.change(screen.getByLabelText(text.layer),{target:{value:'ndre'}});
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test'); expect(screen.queryByAltText(text.imageAlt)).toBeNull();
});
test('loading and delayed old responses cannot replace a changed field',async()=>{
  let resolve; api.timeseries.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  await show(); chooseDemo(); fireEvent.click(screen.getByText(text.analyze));
  expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText(text.undo)); await act(async()=>resolve(data()));
  expect(screen.queryByTestId('chart')).toBeNull(); expect(localStorage.getItem(SUMMARY_KEY)).toBeNull();
});
test('provider quota and missing credentials errors are controlled',async()=>{
  api.timeseries.mockRejectedValue({response:{data:{code:'quota_exceeded'}}});
  await show(); chooseDemo(); fireEvent.click(screen.getByText(text.analyze));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent',text.quota);
});
test('insufficient data never shows a crop disease diagnosis',async()=>{
  api.timeseries.mockResolvedValue({...data(),status:'insufficient_data',trend:{status:'insufficient_data'},observations:[]});
  await show(); await analyze(); expect(screen.getByText(text.insufficient)).toBeTruthy();
  expect(screen.getByText(text.insufficient_data)).toBeTruthy();
});
test('cached summary is labelled as a previous field when offline',async()=>{
  safeWrite(SUMMARY_KEY,{version:1,saved_at:new Date().toISOString(),data:data()});
  Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
  await show(); await screen.findByText(text.previousField,{exact:false});
  chooseDemo(); fireEvent.click(screen.getByText(text.analyze)); expect(screen.getByRole('alert').textContent).toBe(text.offline);
  expect(api.timeseries).not.toHaveBeenCalled();
});
test('ground-verification actions target existing workflows',async()=>{
  await show(); for(const [label,action] of [[english.nav.cropHealth,'health'],[english.weather.title,'weather'],[english.soilSensor.title,'soil'],[english.pest.title,'pest'],[english.sidebar.runSimulation,'simulation']]) {
    fireEvent.click(screen.getByRole('button',{name:label})); expect(props.onNavigate).toHaveBeenLastCalledWith(action);
  }
});
test('successful statistics survive catalog failure',async()=>{
  api.acquisitions.mockRejectedValue(new Error('outage')); await show(); await analyze();
  expect(screen.getByText(text.stable)).toBeTruthy(); expect(screen.getByRole('alert').textContent).toBe(text.serviceUnavailable);
});
test('storage failure does not discard successful observations',async()=>{
  jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  await show(); await analyze(); expect(screen.getByText(text.storageUnavailable)).toBeTruthy(); expect(screen.getByText(text.stable)).toBeTruthy();
  jest.restoreAllMocks();
});

test('device location automatically loads nearby evidence without coordinate entry or saving a boundary',async()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{}});
  await show(); await screen.findByTestId('chart'); await screen.findByAltText(text.imageAlt);
  expect(getCurrentLocation).toHaveBeenCalledWith({includeAccuracy:true});
  expect(api.timeseries).toHaveBeenCalledTimes(1);
  expect(api.preview).toHaveBeenCalledWith(expect.objectContaining({width:256,height:256}),expect.anything());
  expect(screen.getByText(text.nearbyExplanation)).toBeTruthy();
  expect(screen.getByText(text.soilUnavailable)).toBeTruthy(); expect(screen.getByText(text.climateBaseline,{exact:false})).toBeTruthy();
  expect(localStorage.getItem(FIELD_KEY)).toBeNull(); expect(screen.getByText(text.saveBoundary).disabled).toBe(true);
});

test('imprecise device location permits weather context but does not invent a field or request imagery',async()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{}});
  getCurrentLocation.mockResolvedValue({lat:26.8,lon:73,accuracy:800});
  await show(); await screen.findByText(text.locationAccuracy);
  expect(api.timeseries).not.toHaveBeenCalled(); expect(api.geometry).not.toHaveBeenCalled();
  expect(await screen.findByText(text.localWeather)).toBeTruthy();
});

test('denied location leaves a tap-to-map path with no automatic satellite requests',async()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{}});
  getCurrentLocation.mockRejectedValue({code:1}); await show();
  expect(await screen.findByText(text.locationFailed)).toBeTruthy();
  fireEvent.click(screen.getByText(text.draw)); await screen.findByTestId('map'); expect(api.timeseries).not.toHaveBeenCalled();
});

test('late device location cannot overwrite a field selected by the farmer',async()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{}});
  let resolve; getCurrentLocation.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  await show(); chooseDemo(); await act(async()=>resolve({lat:26.8,lon:73,accuracy:12}));
  expect(api.timeseries).not.toHaveBeenCalled(); expect(screen.queryByText(text.nearbyExplanation)).toBeNull();
});

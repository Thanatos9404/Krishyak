import axios from 'axios';
import { getLocationContext } from './locationContextApi';
import { getWeatherForecast } from './weatherApi';
import satellite from './remoteSensingApi';
jest.mock('axios');
jest.mock('./weatherApi',()=>({getWeatherForecast:jest.fn()}));
jest.mock('./remoteSensingApi',()=>({__esModule:true,default:{climate:jest.fn(),place:jest.fn()}}));
beforeEach(()=>{
  jest.clearAllMocks();satellite.place.mockResolvedValue({country:'India',state:'Rajasthan',district:'Jodhpur'});
  getWeatherForecast.mockResolvedValue({isMock:false,current:{temp:30}});satellite.climate.mockResolvedValue({evidence_type:'gridded_climate_reanalysis'});
  axios.post.mockResolvedValue({data:{success:true,government_feed_status:'not_integrated',farmer_reports:[{pest_name:'Aphid',crop:'Wheat',farmer_id:'private',location:{lat:26.8,lon:73},photo_url:'private',description:'private'}]}});
  axios.get.mockResolvedValue({data:{success:true,historical_feed_status:'not_integrated',outbreaks:[]}});
});
test('location loads context but strips reporting farmer identity and coordinates',async()=>{
  const result=await getLocationContext({lat:26.8,lon:73},'Wheat');
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/pest/alerts'),{state:'Rajasthan',district:'Jodhpur',crop:'Wheat'},expect.anything());
  expect(result.pests.reports).toEqual([{name:'Aphid',crop:'Wheat',severity:undefined,reported_at:undefined}]);
  expect(result.pests.history_count).toBeNull();expect(JSON.stringify(result)).not.toContain('private');
});
test('a missing soil or historical feed does not manufacture data and weather survives climate outage',async()=>{
  satellite.climate.mockRejectedValue(new Error('outage'));
  const result=await getLocationContext({lat:26.8,lon:73},'Wheat');
  expect(result.weather.current.temp).toBe(30);expect(result.climate).toBeNull();expect(result.soil_type).toBeUndefined();
});
test('unknown place prevents geographically unfiltered pest requests',async()=>{
  satellite.place.mockResolvedValue(null);
  const result=await getLocationContext({lat:26.8,lon:73},'Wheat');
  expect(axios.post).not.toHaveBeenCalled();expect(axios.get).not.toHaveBeenCalled();expect(result.pests).toBeNull();
});

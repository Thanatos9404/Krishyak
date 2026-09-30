import axios from 'axios';
import {getLocationBasedData,getSoilTypeForLocation,estimateSeasonalRainfall,estimateMonsoonDelay} from './weatherApi';
jest.mock('axios',()=>({get:jest.fn()}));

test('place names and absence of evidence do not manufacture soil, rainfall or delay',()=>{
  for (const place of [null,{city:'Pune',state:'Maharashtra'},{city:'Unmapped'}]) {
    expect(getSoilTypeForLocation(place)).toBeNull();
    expect(estimateSeasonalRainfall(place)).toBeNull();
    expect(estimateMonsoonDelay(18.5)).toBeNull();
  }
});

test('successful geolocation preserves unavailable agronomic fields',async()=>{
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:resolve=>resolve({coords:{latitude:18.5,longitude:73.8}}),
  }});
  axios.get.mockResolvedValueOnce({data:{address:{city:'Pune',state:'Maharashtra',country:'India'}}})
    .mockResolvedValueOnce({data:{current:{temperature_2m:25,relative_humidity_2m:50,weather_code:0},hourly:{}}});
  const result=await getLocationBasedData();
  expect(result.location.city).toBe('Pune');
  expect(result).toMatchObject({soil_type:null,soil_source:'unavailable',expected_rainfall:null,rainfall_delay:null});
});

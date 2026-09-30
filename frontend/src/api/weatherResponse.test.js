import axios from 'axios';
import {getWeatherForecast} from './weatherApi';
jest.mock('axios',()=>({get:jest.fn()}));
const now=Date.parse('2026-09-08T12:15:00Z');
const sample=()=>({utc_offset_seconds:0,current:{time:'2026-09-08T12:15',temperature_2m:0,relative_humidity_2m:0,weather_code:80},
  hourly:{time:Array.from({length:24},(_,i)=>new Date(now-15*60000+i*3600000).toISOString().slice(0,16)),
    temperature_2m:Array(24).fill(20),relative_humidity_2m:Array(24).fill(50),precipitation:Array(24).fill(0)}});
beforeEach(()=>{jest.spyOn(Date,'now').mockReturnValue(now);axios.get.mockReset();});
afterEach(()=>jest.restoreAllMocks());

test('valid zero readings and rain remain zero; forecast starts in the future',async()=>{
  axios.get.mockResolvedValue({data:sample()});
  const result=await getWeatherForecast(18,73);
  expect(result.current).toMatchObject({temp:0,humidity:0,description:'Rain showers'});
  expect(result.forecast).toHaveLength(8);
  expect(result.forecast[0]).toMatchObject({time:'2026-09-08T13:00:00.000Z',rain:0});
});

test.each([{temperature_2m:null},{relative_humidity_2m:101},{weather_code:4},{time:'2026-09-07T12:15'},
  {time:'2026-09-08T14:15'},{temperature_2m:'25'}])('invalid current values are unavailable: %j',async changes=>{
  const data=sample();Object.assign(data.current,changes);axios.get.mockResolvedValue({data});
  expect((await getWeatherForecast(18,73)).current.temp).toBeNull();
});

test('missing precipitation cannot become a dry forecast',async()=>{
  const data=sample();data.hourly.precipitation[3]=null;axios.get.mockResolvedValue({data});
  const result=await getWeatherForecast(18,73);
  expect(result.current.temp).toBe(0);
  expect(result.forecast_available).toBe(false);
  expect(result.forecast).toEqual([]);
});

test('invalid coordinates do not trigger a request',async()=>{
  expect((await getWeatherForecast('18',73)).isMock).toBe(true);
  expect(axios.get).not.toHaveBeenCalled();
});

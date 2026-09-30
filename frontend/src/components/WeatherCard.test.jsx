import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import WeatherCard from './WeatherCard';
import {getLocationBasedData} from '../api/weatherApi';
jest.mock('../api/weatherApi',()=>({getLocationBasedData:jest.fn()}));
jest.mock('../i18n',()=>({useTranslation:()=>({t:key=>key})}));
const detected={location:{city:'Pune',state:'Maharashtra'},soil_type:null,expected_rainfall:null,rainfall_delay:null};
beforeEach(()=>getLocationBasedData.mockReset());

test('a location response after unmount cannot overwrite parent inputs',async()=>{
  let resolve;
  getLocationBasedData.mockReturnValue(new Promise(done=>{resolve=done;}));
  const onWeatherUpdate=jest.fn();
  const {unmount}=render(<WeatherCard onWeatherUpdate={onWeatherUpdate}/>);
  fireEvent.click(screen.getByRole('button',{name:'weatherCard.detectLocation'}));
  unmount();
  await act(async()=>resolve(detected));
  expect(onWeatherUpdate).not.toHaveBeenCalled();
});

test('a failed refresh removes the previous location and weather',async()=>{
  getLocationBasedData.mockResolvedValueOnce(detected).mockRejectedValueOnce(new Error('offline'));
  const {unmount}=render(<WeatherCard/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'weatherCard.detectLocation'})));
  expect(screen.getByText('Pune, Maharashtra')).toBeTruthy();
  await act(async()=>fireEvent.click(screen.getByTitle('common.refresh')));
  expect(screen.queryByText('Pune, Maharashtra')).toBeNull();
  expect(screen.getByText('weatherCard.errors.failed')).toBeTruthy();
  unmount();
});

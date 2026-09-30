import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import Sidebar from './Sidebar';
jest.mock('../i18n',()=>({useTranslation:()=>({t:key=>key})}));
jest.mock('./AccordionSection',()=>({children})=><div>{children}</div>);
jest.mock('./WeatherCard',()=>({onWeatherUpdate})=><button onClick={()=>onWeatherUpdate({
  expected_rainfall:null,rainfall_delay:null,soil_type:null,soil_source:'unavailable',
})}>Detect test location</button>);
jest.mock('./SoilDataCard',()=>()=>null);
jest.mock('./VoiceInputModal',()=>()=>null);

test('location-only data never overwrites the farmer rainfall, delay or soil',()=>{
  const original={crop:'Rice',soil_type:'Black',expected_rainfall:1100,rainfall_delay:12,
    fertilizer_mix:{},area_hectares:2,seed_quality:0.8,irrigation_frequency:4,pest_probability:0.2,
    current_market_price:2500,sale_month:2};
  const setFormData=jest.fn();
  render(<Sidebar formData={original} setFormData={setFormData} crops={['Rice']} soilTypes={['Black']} />);
  fireEvent.click(screen.getByText('Detect test location'));
  expect(setFormData.mock.calls[0][0](original)).toEqual(original);
});

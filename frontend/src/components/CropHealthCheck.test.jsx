import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import CropHealthCheck from './CropHealthCheck';
jest.mock('../i18n',()=>({useTranslation:()=>({t:key=>key,language:'en'})}));
const capabilities={ok:true,json:async()=>({success:true,data:{model_available:true,supported_crops:['rice','wheat']}})};
const healthy={ok:true,json:async()=>({success:true,data:{status:'healthy',model_available:true,confidence:0.9,disease:null,crop_detected:'rice',suggestions:[]}})};
beforeEach(()=>{global.fetch=jest.fn();});
afterEach(()=>jest.restoreAllMocks());

test('missing capabilities never invent supported crops',async()=>{
  fetch.mockRejectedValue(new Error('offline'));
  render(<CropHealthCheck />);
  await waitFor(()=>expect(screen.getByRole('button',{name:'common.retry'}).disabled).toBe(false));
  expect(screen.getAllByRole('option')).toHaveLength(1);
  fetch.mockResolvedValue(capabilities);
  fireEvent.click(screen.getByRole('button',{name:'common.retry'}));
  await screen.findByRole('option',{name:'crops.rice'});
  expect(screen.queryByRole('option',{name:'crops.cotton'})).toBeNull();
});

test.each([false,true])('diagnosis response validation is connected to the rendered result (malformed=%s)',async malformed=>{
  const data={status:'disease_detected',model_available:true,crop_detected:'rice',
    disease:{id:'new_rice_condition',name:malformed ? {} : 'Rice condition',severity:'high',confidence:0.9},
    treatment:{prevention:['Monitor nearby plants']}};
  fetch.mockImplementation(url=>Promise.resolve(url.includes('capabilities') ? capabilities :
    {ok:true,json:async()=>({success:true,data})}));
  const {container}=render(<CropHealthCheck/>);
  await screen.findByRole('option',{name:'crops.rice'});
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'rice'}});
  fireEvent.change(container.querySelector('input[type="file"]'),{target:{files:[new File(['image'],'leaf.jpg',{type:'image/jpeg'})]}});
  await screen.findByAltText('cropHealth.selectedPlant');
  fireEvent.click(screen.getByRole('button',{name:'cropHealth.analyze'}));
  if (malformed) {
    await screen.findByText('common.error');
    expect(screen.queryByText('Monitor nearby plants')).toBeNull();
  } else {
    await screen.findByText('Monitor nearby plants');
    expect(screen.queryByText('common.error')).toBeNull();
    expect(screen.getByText('dashboard.confidence: 90.0%')).toBeTruthy();
    expect(screen.queryByText('cropHealth.confidenceLevels.high')).toBeNull();
    expect(screen.queryByText('cropHealth.confidenceLevels.highDesc')).toBeNull();
    const disclaimer=screen.getByText('cropHealth.agronomicDisclaimer');
    expect(disclaimer.compareDocumentPosition(screen.getByText('Monitor nearby plants')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

test('healthy-class result also exposes its model score and limitations',async()=>{
  fetch.mockImplementation(url=>Promise.resolve(url.includes('capabilities') ? capabilities : healthy));
  const {container}=render(<CropHealthCheck/>);
  await screen.findByRole('option',{name:'crops.rice'});
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'rice'}});
  fireEvent.change(container.querySelector('input[type="file"]'),{target:{files:[new File(['image'],'leaf.jpg',{type:'image/jpeg'})]}});
  await screen.findByAltText('cropHealth.selectedPlant');
  fireEvent.click(screen.getByRole('button',{name:'cropHealth.analyze'}));
  await screen.findByText('cropHealth.plantHealthy');
  expect(screen.getByText('dashboard.confidence: 90.0%')).toBeTruthy();
  expect(screen.getByText('cropHealth.agronomicDisclaimer')).toBeTruthy();
});

test('sample button loads an image without fabricating a diagnosis',async()=>{
  fetch.mockImplementation(url=>Promise.resolve(url.includes('capabilities') ? capabilities :
    {ok:true,blob:async()=>new Blob(['sample'],{type:'image/jpeg'})}));
  render(<CropHealthCheck />);
  await screen.findByRole('option',{name:'crops.rice'});
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'rice'}});
  fireEvent.click(screen.getByRole('button',{name:'cropHealth.trySampleDemo'}));
  await screen.findByAltText('cropHealth.selectedPlant');
  expect(screen.getByText('cropHealth.noAnalysisYet')).toBeTruthy();
  expect(screen.queryByText('cropHealth.plantHealthy')).toBeNull();
  expect(fetch.mock.calls.some(([url])=>url.includes('/detect_disease'))).toBe(false);
});

test('changing crop discards an in-flight diagnosis',async()=>{
  let finish;
  fetch.mockImplementation(url=>url.includes('capabilities') ? Promise.resolve(capabilities)
    : new Promise(resolve=>{finish=resolve;}));
  const {container}=render(<CropHealthCheck />);
  await screen.findByRole('option',{name:'crops.rice'});
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'rice'}});
  fireEvent.change(container.querySelector('input[type="file"]'),{target:{files:[new File(['image'],'leaf.jpg',{type:'image/jpeg'})]}});
  await screen.findByAltText('cropHealth.selectedPlant');
  fireEvent.click(screen.getByRole('button',{name:'cropHealth.analyze'}));
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'wheat'}});
  await act(async()=>finish(healthy));
  expect(screen.queryByText('cropHealth.plantHealthy')).toBeNull();
  expect(screen.queryByAltText('cropHealth.selectedPlant')).toBeNull();
});

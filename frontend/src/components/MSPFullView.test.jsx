import React from 'react';
import {act,fireEvent,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MSPFullView from './MSPFullView';
jest.mock('../i18n',()=>({useTranslation:()=>({language:'en',t:key=>({
  'crops.rice':'Zulu rice','crops.wheat':'Alpha wheat','crops.maize':'Beta maize',
}[key] || key)})}));
jest.mock('../data/msp_data.json',()=>({crops:{
  Rice:{msp:2000,season:'Kharif'},Wheat:{msp:2500,season:'Rabi'},Maize:{msp:2000,season:'Kharif'},
},season:'Test fixture',source:'Test fixture'}));
const rowNames=()=>within(screen.getByRole('table')).getAllByRole('row').slice(1)
  .map(row=>within(row).getAllByRole('cell')[0].textContent);

test('back and filter controls have usable names; search combines with season',()=>{
  const onBack=jest.fn();render(<MSPFullView onBack={onBack}/>);
  fireEvent.click(screen.getByRole('button',{name:'common.back'}));
  expect(onBack).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('textbox',{name:'common.search'}),{target:{value:'  RICE  '}});
  expect(rowNames()).toEqual(['Zulu riceRice']);
  fireEvent.change(screen.getByRole('combobox',{name:'msp.season'}),{target:{value:'Rabi'}});
  expect(rowNames()).toEqual([]);
  fireEvent.change(screen.getByRole('textbox',{name:'common.search'}),{target:{value:''}});
  expect(rowNames()).toEqual(['Alpha wheatWheat']);
});

test('keyboard sorting follows displayed names and reports direction',()=>{
  render(<MSPFullView/>);
  expect(rowNames()).toEqual(['Alpha wheatWheat','Beta maizeMaize','Zulu riceRice']);
  const cropSort=screen.getByRole('button',{name:'msp.cropName'});
  cropSort.focus();act(()=>userEvent.keyboard('{Enter}'));
  expect(cropSort.closest('th').getAttribute('aria-sort')).toBe('descending');
  expect(rowNames()).toEqual(['Zulu riceRice','Beta maizeMaize','Alpha wheatWheat']);
  const rateSort=screen.getByRole('button',{name:'msp.mspRate'});
  rateSort.focus();act(()=>userEvent.keyboard(' '));
  expect(rateSort.closest('th').getAttribute('aria-sort')).toBe('ascending');
  expect(cropSort.closest('th').getAttribute('aria-sort')).toBe('none');
  expect(rowNames()).toEqual(['Zulu riceRice','Beta maizeMaize','Alpha wheatWheat']);
  act(()=>userEvent.keyboard('{Enter}'));
  expect(rowNames()).toEqual(['Alpha wheatWheat','Zulu riceRice','Beta maizeMaize']);
});

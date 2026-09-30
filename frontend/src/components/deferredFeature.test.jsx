import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {deferredFeature} from './deferredFeature';
jest.mock('../i18n',()=>({useTranslation:()=>({t:key=>key})}));

test('does not request feature code until mounted and forwards current props',async()=>{
  let resolve;
  const loader=jest.fn(()=>new Promise(done=>{resolve=done;}));
  const Feature=deferredFeature(loader);
  expect(loader).not.toHaveBeenCalled();
  const {rerender}=render(<Feature crop="Rice"/>);
  expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
  rerender(<Feature crop="Wheat"/>);
  await act(async()=>resolve({default:({crop})=><p>{crop}</p>}));
  expect(screen.getByText('Wheat')).toBeTruthy();
  expect(loader).toHaveBeenCalledTimes(1);
});

test('failed download can retry without resetting the surrounding app',async()=>{
  const noise=jest.spyOn(console,'error').mockImplementation(()=>{});
  try {
    const loader=jest.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({default:()=> <p>Feature ready</p>});
    const Feature=deferredFeature(loader);
    render(<><input aria-label="Farm area" defaultValue="2"/><Feature/></>);
    fireEvent.change(screen.getByLabelText('Farm area'),{target:{value:'7'}});
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button',{name:'common.retry'}));
    await screen.findByText('Feature ready');
    expect(screen.getByLabelText('Farm area').value).toBe('7');
    expect(loader).toHaveBeenCalledTimes(2);
  } finally {noise.mockRestore();}
});

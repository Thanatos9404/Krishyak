import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import FarmerRegistrationForm from './FarmerRegistrationForm';
import farmingApi from '../api/farmingApi';

const mockLogin = jest.fn(data => data);
const mockClearDraft = jest.fn();
const mockValidate = jest.fn(() => true);
jest.mock('../i18n', () => ({useTranslation: () => ({t:key => key})}));
jest.mock('./LanguageSelector', () => () => null);
jest.mock('../api/farmingApi', () => ({__esModule:true, default:{registerFarmer:jest.fn()}}));
jest.mock('../hooks/useFarmerSession', () => ({useFarmerSession: () => ({
  login:mockLogin, clearDraft:mockClearDraft, loadDraft:()=>null, saveDraft:()=>{}
})}));
jest.mock('../hooks/useFormValidation', () => ({useFormValidation: () => ({
  errors:{}, validateStep:mockValidate, clearFieldError:()=>{}
})}));

beforeEach(() => {jest.clearAllMocks(); mockValidate.mockImplementation(() => true);});

function lastStep(onComplete=jest.fn()) {
  render(<FarmerRegistrationForm onComplete={onComplete} />);
  for (let i=0;i<3;i++) fireEvent.click(screen.getByRole('button',{name:/registration.next/}));
  return onComplete;
}

test('registration stays pending until the server confirms persistence', async () => {
  let resolve;
  farmingApi.registerFarmer.mockReturnValue(new Promise(done=>{resolve=done;}));
  const complete=lastStep();
  fireEvent.click(screen.getByRole('button',{name:/registration.submit/}));
  expect(mockLogin).not.toHaveBeenCalled();
  expect(mockClearDraft).not.toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
  await act(async()=>{resolve({success:true});});
  expect(mockLogin).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
});

test('failed registration preserves the form and supports retry', async () => {
  farmingApi.registerFarmer.mockResolvedValueOnce({success:false}).mockResolvedValueOnce({success:true});
  const complete=lastStep();
  fireEvent.click(screen.getByRole('button',{name:/registration.submit/}));
  await screen.findByRole('alert');
  expect(mockLogin).not.toHaveBeenCalled();
  expect(mockClearDraft).not.toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/registration.submit/}));
  await waitFor(()=>expect(complete).toHaveBeenCalledTimes(1));
});

test('final submission revalidates earlier steps before any backend write', () => {
  lastStep();
  mockValidate.mockImplementation(step=>step!==1);
  fireEvent.click(screen.getByRole('button',{name:/registration.submit/}));
  expect(farmingApi.registerFarmer).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:/registration.submit/})).toBeNull();
});

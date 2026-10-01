import { renderHook, act } from '@testing-library/react';
import useFarmerSession from './useFarmerSession';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => jest.restoreAllMocks());

test('corrupt sessions do not crash startup and valid guest fallback loads', () => {
  sessionStorage.setItem('krishyak_farmer_session', '{');
  localStorage.setItem('krishyak_guest_session', JSON.stringify({ isGuest: true }));
  const { result } = renderHook(() => useFarmerSession());
  expect(result.current.loading).toBe(false);
  expect(result.current.farmer.isGuest).toBe(true);
  expect(result.current.isRegistered).toBe(false);
});

test.each(['{', '[]', '42', 'null'])('invalid guest record %s is ignored', value => {
  localStorage.setItem('krishyak_guest_session', value);
  const { result } = renderHook(() => useFarmerSession());
  expect(result.current.farmer).toBeNull();
  expect(result.current.loading).toBe(false);
});

test('Aadhaar is scrubbed on restoration, login and profile update', () => {
  sessionStorage.setItem('krishyak_farmer_session', JSON.stringify({ fullName: 'Farmer', aadhaarNumber: 'secret' }));
  const { result } = renderHook(() => useFarmerSession());
  expect(result.current.farmer.aadhaarNumber).toBeUndefined();
  act(() => result.current.login({ fullName: 'Farmer', aadhaarNumber: 'secret' }));
  act(() => result.current.updateProfile({ primaryCrop: 'Wheat', aadhar: 'secret' }));
  expect(result.current.farmer.primaryCrop).toBe('Wheat');
  expect(JSON.stringify(result.current.farmer)).not.toContain('secret');
  expect(sessionStorage.getItem('krishyak_farmer_session')).not.toContain('secret');
});

test('storage denial still permits in-memory registration and logout', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
  const { result } = renderHook(() => useFarmerSession());
  act(() => result.current.login({ fullName: 'Farmer' }));
  expect(result.current.isRegistered).toBe(true);
  act(() => result.current.logout());
  expect(result.current.farmer).toBeNull();
});

test('new and legacy drafts exclude personal identifiers', () => {
  const { result } = renderHook(() => useFarmerSession());
  act(() => result.current.saveDraft({ state: 'Punjab', fullName: 'Private', aadhaarNumber: 'secret' }));
  expect(result.current.loadDraft()).toMatchObject({ state: 'Punjab' });
  expect(localStorage.getItem('krishyak_registration_draft')).not.toContain('secret');
  localStorage.setItem('krishyak_registration_draft', JSON.stringify({ primaryCrop: 'Rice', mobileNumber: 'secret' }));
  expect(result.current.loadDraft()).toEqual({ primaryCrop: 'Rice' });
  expect(localStorage.getItem('krishyak_registration_draft')).not.toContain('secret');
  act(() => result.current.clearDraft());
  expect(result.current.loadDraft()).toBeNull();
});

test('malformed saved field types are discarded and legacy numeric land areas become strings', () => {
  localStorage.setItem('krishyak_registration_draft', JSON.stringify({
    village:{bad:true}, district:123, tehsil:null, primaryCrop:['Rice'], landUnit:'invalid',
    totalLandArea:2, irrigatedLand:0, secondaryCrops:['Wheat',{},null], state:'Punjab'
  }));
  const {result} = renderHook(() => useFarmerSession());
  expect(result.current.loadDraft()).toEqual({state:'Punjab',totalLandArea:'2',irrigatedLand:'0',secondaryCrops:['Wheat']});
});

test('logout removes farm caches while preserving language preference', () => {
  const keys = ['krishyak_registration_draft', 'krishyak_sim_cache', 'pestAlerts', 'pestPredictions', 'krishyak_soil_data'];
  keys.forEach(key => localStorage.setItem(key, 'private'));
  localStorage.setItem('language', 'hi');
  const { result } = renderHook(() => useFarmerSession());
  act(() => result.current.guestLogin());
  expect(result.current.updateProfile({ fullName: 'Other' })).toBeNull();
  act(() => result.current.logout());
  keys.forEach(key => expect(localStorage.getItem(key)).toBeNull());
  expect(localStorage.getItem('krishyak_guest_session')).toBeNull();
  expect(localStorage.getItem('language')).toBe('hi');
});

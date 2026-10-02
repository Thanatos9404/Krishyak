import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import App from './App';
import farmingApi from './api/farmingApi';

const mockLogout = jest.fn();
const mockToast = jest.fn();
let mockSession;
jest.mock('./hooks/useFarmerSession', () => ({useFarmerSession: () => mockSession || ({
  farmer:{fullName:'Test Farmer'},isRegistered:true,loading:false,logout:mockLogout,
})}));
jest.mock('./features/farms/FarmWorkspace', () => () => <div><h1>Authenticated farm account workflow</h1></div>);
jest.mock('./i18n', () => ({useTranslation: () => ({t:key=>key})}));
jest.mock('./api/farmingApi', () => ({__esModule:true,default:{
  getCrops:jest.fn(),getSoilTypes:jest.fn(),simulate:jest.fn(),compareScenarios:jest.fn(),getRecommendations:jest.fn(),
}}));
jest.mock('./components/LanguageSelector', () => () => null);
jest.mock('./hooks/useTextToSpeech', () => ({ SpeakButton: () => null, visiblePageText: () => '' }));
jest.mock('./components/VoiceInputModal', () => ({isOpen,onClose,onApply}) => isOpen ? <div role="dialog" aria-label="Voice input"><button onClick={onClose}>Close voice</button><button onClick={() => {onApply({crop:'Wheat'});onClose();}}>Apply spoken crop</button></div> : null);
jest.mock('./components/BottomSheet', () => () => null);
jest.mock('./components/LoadingOverlay', () => () => null);
jest.mock('./components/Toast', () => ({ToastContainer:()=>null,useToast:()=>({toasts:[],addToast:mockToast,removeToast:()=>{}})}));
jest.mock('./components/Dashboard', () => ({simulationData}) => <div data-testid="result">{simulationData?.profit ?? 'empty'}</div>);
jest.mock('./components/Sidebar', () => ({formData,setFormData,onSimulate,loading}) => {
  const [note,setNote]=require('react').useState('');
  return <>
  <input aria-label="Sidebar local state" value={note} onChange={event=>setNote(event.target.value)}/>
  <button onClick={onSimulate} disabled={loading}>Run test</button>
  <button onClick={()=>setFormData({...formData,crop:'Wheat'})}>Change crop</button>
</>;
});

beforeEach(() => {
  mockSession = undefined;
  window.history.replaceState({}, '', '/');
  localStorage.clear(); jest.clearAllMocks(); window.scrollTo=jest.fn();
  farmingApi.getCrops.mockResolvedValue({crops:[]});farmingApi.getSoilTypes.mockResolvedValue({soil_types:[]});
  farmingApi.compareScenarios.mockResolvedValue({success:true,data:{}});
  farmingApi.getRecommendations.mockResolvedValue({success:true,data:{profit_improvement:0}});
});

test('planning registration opens the authenticated farm account workflow', async () => {
  const guestLogin = jest.fn();
  mockSession = {farmer:null,isRegistered:false,loading:false,guestLogin,login:jest.fn(),logout:mockLogout};
  render(<App />);
  expect(screen.getByRole('heading', {level:1}).textContent).toContain('landing.title');
  fireEvent.click(screen.getAllByRole('button', {name:'landing.start'})[0]);
  await screen.findByRole('heading', {name:'Authenticated farm account workflow'});
  expect(window.location.pathname).toBe('/register');
  expect(guestLogin).not.toHaveBeenCalled();
});

test('browser back from account registration restores the planning landing page', async () => {
  mockSession = {farmer:null,isRegistered:false,loading:false,guestLogin:jest.fn(),login:jest.fn(),logout:mockLogout};
  window.history.replaceState({}, '', '/register');
  render(<App />);
  await screen.findByRole('heading', {name:'Authenticated farm account workflow'});
  act(() => { window.history.replaceState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(screen.getByRole('button', {name:'landing.explore'})).toBeTruthy();
});

test('parent updates preserve mounted sidebar local state',async()=>{
  render(<App/>);
  fireEvent.change(screen.getByLabelText('Sidebar local state'),{target:{value:'keep input state'}});
  fireEvent.click(screen.getByText('Change crop'));
  expect(screen.getByLabelText('Sidebar local state').value).toBe('keep input state');
  await act(async()=>{});
  expect(screen.getByLabelText('Sidebar local state').value).toBe('keep input state');
});

test('unavailable catalogs do not show the global yellow retry notice', async () => {
  farmingApi.getCrops.mockRejectedValue(new Error('offline'));
  farmingApi.getSoilTypes.mockRejectedValue(new Error('offline'));
  render(<App />);
  await act(async () => {});
  expect(screen.queryByText('common.retry')).toBeNull();
  expect(document.querySelector('.bg-amber-50')).toBeNull();
});

test('workspace voice button opens directly, applies reviewed inputs, and closes', async () => {
  farmingApi.simulate.mockResolvedValue({success:true,data:{profit:123}});
  render(<App />);
  fireEvent.click(screen.getByRole('button',{name:'voice.title'}));
  expect(screen.getByRole('dialog',{name:'Voice input'})).toBeTruthy();
  fireEvent.click(screen.getByText('Apply spoken crop'));
  expect(screen.queryByRole('dialog',{name:'Voice input'})).toBeNull();
  fireEvent.click(screen.getByText('Run test'));
  await waitFor(() => expect(farmingApi.simulate).toHaveBeenCalledWith(expect.objectContaining({crop:'Wheat'}),500));
  fireEvent.click(screen.getByRole('button',{name:'voice.title'}));
  fireEvent.click(screen.getByText('Close voice'));
  expect(screen.queryByRole('dialog',{name:'Voice input'})).toBeNull();
});

test('a response for old inputs cannot populate results or storage', async () => {
  let resolve;
  farmingApi.simulate.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  render(<App />);
  fireEvent.click(screen.getByText('Run test'));
  fireEvent.click(screen.getByText('Change crop'));
  await act(async()=>resolve({success:true,data:{profit:123}}));
  expect(screen.getByTestId('result').textContent).toBe('empty');
  expect(localStorage.getItem('krishyak_sim_cache')).toBeNull();
  expect(screen.getByText('Run test').disabled).toBe(false);
});

test('changing inputs clears displayed results', async () => {
  farmingApi.simulate.mockResolvedValue({success:true,data:{profit:123}});
  render(<App />);fireEvent.click(screen.getByText('Run test'));
  await waitFor(()=>expect(screen.getByTestId('result').textContent).toBe('123'));
  fireEvent.click(screen.getByText('Change crop'));
  expect(screen.getByTestId('result').textContent).toBe('empty');
});

test('logout invalidates a pending response', async () => {
  let resolve;
  farmingApi.simulate.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  render(<App />);fireEvent.click(screen.getByText('Run test'));
  fireEvent.click(screen.getByRole('button',{name:'Test'}));
  fireEvent.click(screen.getByText('common.logout'));
  await act(async()=>resolve({success:true,data:{profit:123}}));
  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('result').textContent).toBe('empty');
  expect(localStorage.getItem('krishyak_sim_cache')).toBeNull();
});

test('catalog recovers on reconnect without a global retry notice',async()=>{
  farmingApi.getCrops.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({crops:['Rice']});
  farmingApi.getSoilTypes.mockResolvedValue({soil_types:['Alluvial']});
  render(<App />);
  await act(async()=>{});
  expect(screen.queryByRole('button',{name:'common.retry'})).toBeNull();
  await act(async()=>window.dispatchEvent(new Event('online')));
  expect(farmingApi.getCrops).toHaveBeenCalledTimes(2);
});

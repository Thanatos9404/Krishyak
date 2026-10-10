import { act, renderHook, waitFor } from '@testing-library/react';
import useSarvamRecognition from './useSarvamRecognition';

const transcribeAudio = jest.fn();
const transport = { capabilities: jest.fn(), transcribe: transcribeAudio };

let stopTrack;
beforeEach(() => {
  jest.clearAllMocks();
  stopTrack = jest.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
  } });
  global.MediaRecorder = class {
    static isTypeSupported() { return true; }
    constructor() { this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
      this.onstop?.();
    }
  };
  transport.capabilities.mockResolvedValue({ configured: true, stt_languages: ['en', 'hi'] });
});
afterEach(() => { delete global.MediaRecorder; });

test('without an authenticated transport recording is unsupported and no provider is contacted', async () => {
  const { result } = renderHook(() => useSarvamRecognition());
  expect(result.current.isSupported).toBe(false);
  await act(async () => { expect(await result.current.startListening()).toBe(false); });
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(transport.capabilities).not.toHaveBeenCalled();
});

test('a provider usage limit shows the localized limit message', async () => {
  transcribeAudio.mockRejectedValue(Object.assign(new Error('limited'), { status: 429 }));
  const { result } = renderHook(() => useSarvamRecognition({ transport, errorMessages: { limitReached: 'Limit reached' } }));
  await act(async () => { await result.current.startListening(); });
  await act(async () => { result.current.stopListening(); });
  await waitFor(() => expect(result.current.error).toBe('Limit reached'));
});

test('records and uploads to Sarvam with the selected language', async () => {
  transcribeAudio.mockResolvedValue({ transcript: 'Rice two hectares', language_code: 'en-IN' });
  const { result } = renderHook(() => useSarvamRecognition({ transport }));
  await act(async () => { await result.current.startListening(); });
  expect(result.current.isListening).toBe(true);
  await act(async () => { result.current.stopListening(); });
  await waitFor(() => expect(result.current.transcript).toBe('Rice two hectares'));
  expect(transcribeAudio.mock.calls[0][1]).toBe('en-IN');
  expect(stopTrack).toHaveBeenCalled();
  expect(result.current.confidence).toBeNull();
});

test('closing/resetting cancels an in-flight transcript without updating a new session', async () => {
  let resolve;
  transcribeAudio.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result } = renderHook(() => useSarvamRecognition({ transport }));
  await act(async () => { await result.current.startListening(); });
  act(() => { result.current.stopListening(); });
  act(() => { result.current.resetTranscript(); });
  await act(async () => { resolve({ transcript: 'stale answer' }); });
  expect(result.current.transcript).toBe('');
  expect(transcribeAudio.mock.calls[0][2].aborted).toBe(true);
});

test('unmount while permission is pending releases the eventual microphone', async () => {
  let resolve;
  navigator.mediaDevices.getUserMedia.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result, unmount } = renderHook(() => useSarvamRecognition({ transport }));
  let started;
  act(() => { started = result.current.startListening(); });
  unmount();
  await act(async () => { resolve({ getTracks: () => [{ stop: stopTrack }] }); await started; });
  expect(stopTrack).toHaveBeenCalled();
  expect(transcribeAudio).not.toHaveBeenCalled();
});

test('permission denial leaves a usable text fallback and no provider call', async () => {
  navigator.mediaDevices.getUserMedia.mockRejectedValue(Object.assign(new Error(), { name: 'NotAllowedError' }));
  const { result } = renderHook(() => useSarvamRecognition({ transport }));
  await act(async () => { await result.current.startListening(); });
  expect(result.current.status).toBe('error');
  act(() => { result.current.setManualTranscript('Rice'); });
  expect(result.current.transcript).toBe('Rice');
  expect(transcribeAudio).not.toHaveBeenCalled();
});

test('a late stop event from a cancelled recording cannot disable the new recording time limit', async () => {
  jest.useFakeTimers();
  const recorders = [];
  const Recorder = global.MediaRecorder;
  global.MediaRecorder = class extends Recorder {
    constructor() { super(); recorders.push(this); }
    stop() { this.state = 'inactive'; }
  };
  const { result, unmount } = renderHook(() => useSarvamRecognition({ transport }));
  try {
    await act(async () => { await result.current.startListening(); });
    act(() => { result.current.resetTranscript(); });
    await act(async () => { await result.current.startListening(); });
    await act(async () => { await recorders[0].onstop(); });
    act(() => { jest.advanceTimersByTime(29000); });
    expect(recorders[1].state).toBe('inactive');
    expect(result.current.status).toBe('processing');
    expect(transcribeAudio).not.toHaveBeenCalled();
  } finally {
    unmount();
    jest.useRealTimers();
  }
});

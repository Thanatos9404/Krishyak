import { act, renderHook, waitFor } from '@testing-library/react';
import useSarvamRecognition from './useSarvamRecognition';
import { getSpeechCapabilities, transcribeAudio } from '../api/speechApi';

jest.mock('../api/speechApi', () => ({
  getSpeechCapabilities: jest.fn(), transcribeAudio: jest.fn(),
  speechError: (_error, fallback) => fallback,
}));

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
  getSpeechCapabilities.mockResolvedValue({ configured: true, stt_languages: ['en', 'hi'] });
});
afterEach(() => { delete global.MediaRecorder; });

test('records and uploads to Sarvam with the selected language', async () => {
  transcribeAudio.mockResolvedValue({ transcript: 'Rice two hectares', language_code: 'en-IN' });
  const { result } = renderHook(() => useSarvamRecognition());
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
  const { result } = renderHook(() => useSarvamRecognition());
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
  const { result, unmount } = renderHook(() => useSarvamRecognition());
  let started;
  act(() => { started = result.current.startListening(); });
  unmount();
  await act(async () => { resolve({ getTracks: () => [{ stop: stopTrack }] }); await started; });
  expect(stopTrack).toHaveBeenCalled();
  expect(transcribeAudio).not.toHaveBeenCalled();
});

test('permission denial leaves a usable text fallback and no provider call', async () => {
  navigator.mediaDevices.getUserMedia.mockRejectedValue(Object.assign(new Error(), { name: 'NotAllowedError' }));
  const { result } = renderHook(() => useSarvamRecognition());
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
  const { result, unmount } = renderHook(() => useSarvamRecognition());
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

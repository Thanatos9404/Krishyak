import { act, renderHook } from '@testing-library/react';
import { splitSpeechText, useTextToSpeech } from './useTextToSpeech';
import { getSpeechCapabilities, synthesizeSpeech } from '../api/speechApi';

jest.mock('../i18n/I18nProvider', () => ({ useI18n: () => ({ language: 'en', t: key => key }) }));
jest.mock('../api/speechApi', () => ({
  getSpeechCapabilities: jest.fn(), synthesizeSpeech: jest.fn(), speechError: (_e, fallback) => fallback,
}));

beforeEach(() => jest.clearAllMocks());
afterEach(() => { delete window.AudioContext; jest.useRealTimers(); });

function contextFixture() {
  const source = {connect:jest.fn(), disconnect:jest.fn(), start:jest.fn(), stop:jest.fn()};
  const context = {resume:jest.fn().mockResolvedValue(), close:jest.fn().mockResolvedValue(),
    suspend:jest.fn().mockResolvedValue(), decodeAudioData:jest.fn().mockResolvedValue({}),
    createBufferSource:jest.fn(() => source), destination:{}};
  window.AudioContext = jest.fn(() => context);
  getSpeechCapabilities.mockResolvedValue({configured:true,tts_languages:['en']});
  synthesizeSpeech.mockResolvedValue({audios:['YWJj']});
  return {context, source};
}

test('unlocks audio synchronously on tap and plays returned audio through that context', async () => {
  const {context, source} = contextFixture();
  const {result} = renderHook(() => useTextToSpeech());
  await act(async () => {});
  let spoken;
  act(() => { spoken = result.current.speak('Rice'); });
  expect(context.resume).toHaveBeenCalledTimes(1);
  expect(synthesizeSpeech).not.toHaveBeenCalled();
  await act(async () => {});
  expect(source.start).toHaveBeenCalledTimes(1);
  expect(result.current.isSpeaking).toBe(true);
  await act(async () => { source.onended(); await spoken; });
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(result.current.isSpeaking).toBe(false);
});

test('stop during decoding cannot start stale audio', async () => {
  const {context, source} = contextFixture();
  let decoded;
  context.decodeAudioData.mockReturnValue(new Promise(resolve => { decoded=resolve; }));
  const {result} = renderHook(() => useTextToSpeech());
  await act(async () => {});
  let spoken;
  await act(async () => { spoken=result.current.speak('Rice'); });
  act(() => result.current.stop());
  await act(async () => { decoded({}); await spoken; });
  expect(source.start).not.toHaveBeenCalled();
  expect(context.close).toHaveBeenCalledTimes(1);
});

test('audio decoding failures are visible and release the context', async () => {
  const {context} = contextFixture();
  context.decodeAudioData.mockRejectedValue(new Error('Bad audio'));
  const {result} = renderHook(() => useTextToSpeech());
  await act(async () => {});
  await act(async () => { expect(await result.current.speak('Rice')).toBe(false); });
  expect(result.current.error).toBe('speech.unavailable');
  expect(context.close).toHaveBeenCalledTimes(1);
});

test('failed capabilities recover automatically when connectivity returns', async () => {
  getSpeechCapabilities.mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({configured:true,tts_languages:['en']});
  const {result} = renderHook(() => useTextToSpeech());
  await act(async () => {});
  expect(result.current.isSupported).toBe(false);
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(result.current.isSupported).toBe(true);
});

test('splits long narration under provider limit without dropping content', () => {
  const text = 'Farm input example. '.repeat(300).trim();
  const parts = splitSpeechText(text);
  expect(parts.every((part) => part.length <= 2400)).toBe(true);
  expect(parts.join(' ')).toBe(text);
});

test('stop prevents late synthesized audio from playing', async () => {
  getSpeechCapabilities.mockResolvedValue({ configured: true, tts_languages: ['en'] });
  let resolve;
  synthesizeSpeech.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const audio = jest.spyOn(window, 'Audio');
  const { result } = renderHook(() => useTextToSpeech());
  await act(async () => {});
  let spoken;
  act(() => { spoken = result.current.speak('Rice'); });
  act(() => result.current.stop());
  await act(async () => { resolve({ audios: ['abc'] }); await spoken; });
  expect(audio).not.toHaveBeenCalled();
  expect(result.current.isSpeaking).toBe(false);
  audio.mockRestore();
});

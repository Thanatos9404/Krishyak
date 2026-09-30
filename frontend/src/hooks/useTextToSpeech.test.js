import { act, renderHook } from '@testing-library/react';
import { splitSpeechText, useTextToSpeech } from './useTextToSpeech';
import { getSpeechCapabilities, synthesizeSpeech } from '../api/speechApi';

jest.mock('../i18n/I18nProvider', () => ({ useI18n: () => ({ language: 'en' }) }));
jest.mock('../api/speechApi', () => ({
  getSpeechCapabilities: jest.fn(), synthesizeSpeech: jest.fn(), speechError: (_e, fallback) => fallback,
}));

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

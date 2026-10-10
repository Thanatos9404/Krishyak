import { act, renderHook } from '@testing-library/react';
import useVoiceRecognition, { parseVoiceCommand, selectBestAlternative, STATUS } from './useVoiceRecognition';
import { getSpeechCodes, SUPPORTED_LANGUAGES } from '../i18n/config';
import scheduledLocales from '../i18n/locales/scheduledLocales';

const localizedTerms = (code) => {
  const locale = scheduledLocales[code];
  return {
    crops: {
      Rice: locale.crops.rice,
      Wheat: locale.crops.wheat,
      Maize: locale.crops.maize,
      Cotton: locale.crops.cotton,
      Sugarcane: locale.crops.sugarcane,
      Soybean: locale.crops.soybean,
      Mustard: locale.crops.mustard,
      Potato: locale.crops.potato,
      Tomato: locale.crops.tomato,
      Onion: locale.crops.onion,
    },
    soils: {
      Alluvial: locale.soils.alluvial,
      Black: locale.soils.black,
      Red: locale.soils.red,
      Loamy: locale.soils.loamy,
      Clay: locale.soils.clay,
      Sandy: locale.soils.sandy,
    },
    units: locale.units,
    levels: {
      low: locale.common.low,
      medium: locale.common.medium,
      high: locale.common.high,
    },
  };
};

describe('localized farm input parsing', () => {
  test.each([
    ['ne', 'धान 2 हेक्टर कालो माटो'],
    ['mni', 'ꯐꯧ 2 ꯍꯦꯛꯇꯔ ꯑꯃꯨꯕ ꯂꯩꯕꯥꯛ'],
    ['sd', 'چانور 2 هيڪٽر ڪاري مٽي'],
  ])('extracts crop, area and soil from %s', (code, command) => {
    expect(parseVoiceCommand(command, localizedTerms(code))).toMatchObject({
      crop: 'Rice',
      area_hectares: 2,
      soil_type: 'Black',
    });
  });

  test('normalizes Devanagari digits and a Hindi dialect crop term', () => {
    expect(parseVoiceCommand('धानवा २ हेक्टेयर काली मिट्टी')).toMatchObject({
      crop: 'Rice',
      area_hectares: 2,
      soil_type: 'Black',
    });
  });
});

describe('speech recognition resilience', () => {
  test('prefers an agricultural phrase match over an irrelevant alternative', () => {
    const result = [
      { transcript: 'general meeting tomorrow', confidence: 0.72 },
      { transcript: 'धान दो हेक्टेयर', confidence: 0.61 },
    ];

    expect(selectBestAlternative(result, ['धान', 'हेक्टेयर'])).toMatchObject({
      transcript: 'धान दो हेक्टेयर',
      confidence: 0.61,
    });
  });

  test('every scheduled language has an ordered speech fallback ending in Indian English', () => {
    Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
      const speechCodes = getSpeechCodes(code);
      expect(speechCodes[0]).toBe(SUPPORTED_LANGUAGES[code].speechCode);
      expect(speechCodes).toContain('en-IN');
      expect(new Set(speechCodes).size).toBe(speechCodes.length);
    });
  });
});

describe('planning-page browser speech recognition', () => {
  let engines;
  beforeEach(() => {
    engines = [];
    window.SpeechRecognition = class {
      constructor() { engines.push(this); this.start = jest.fn(); this.stop = jest.fn(() => this.onend?.()); this.abort = jest.fn(); }
    };
  });
  afterEach(() => { delete window.SpeechRecognition; });

  test('uses only the browser engine, in the selected language, and reviews the best phrase', async () => {
    const originalFetch = global.fetch;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    const { result } = renderHook(() => useVoiceRecognition({ speechCode: 'hi-IN', phraseHints: ['धान'] }));
    expect(result.current.isSupported).toBe(true);
    await act(async () => { expect(await result.current.startListening()).toBe(true); });
    expect(engines[0].lang).toBe('hi-IN');
    expect(result.current.status).toBe(STATUS.LISTENING);
    act(() => {
      engines[0].onresult({ results: [[{ transcript: 'general meeting', confidence: 0.1 }, { transcript: 'धान दो हेक्टेयर', confidence: 0 }]] });
      engines[0].onend();
    });
    expect(result.current.transcript).toBe('धान दो हेक्टेयर');
    expect(result.current.confidence).toBeNull();
    expect(result.current.status).toBe(STATUS.IDLE);
    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  test('a denied microphone leaves text entry with a localized message', async () => {
    const { result } = renderHook(() => useVoiceRecognition({ errorMessages: { microphoneDenied: 'Mic denied' } }));
    await act(async () => { await result.current.startListening(); });
    act(() => { engines[0].onerror({ error: 'not-allowed' }); engines[0].onend(); });
    expect(result.current.status).toBe(STATUS.ERROR);
    expect(result.current.error).toBe('Mic denied');
    act(() => { result.current.setManualTranscript('Rice 2 hectare'); });
    expect(result.current.transcript).toBe('Rice 2 hectare');
  });

  test('a reset ignores late results from the cancelled session', async () => {
    const { result } = renderHook(() => useVoiceRecognition());
    await act(async () => { await result.current.startListening(); });
    const stale = engines[0];
    const onresult = stale.onresult;
    act(() => { result.current.resetTranscript(); });
    expect(stale.abort).toHaveBeenCalled();
    act(() => { onresult({ results: [[{ transcript: 'stale', confidence: 0.9 }]] }); });
    expect(result.current.transcript).toBe('');
  });

  test('browsers without speech recognition report no support and never record', async () => {
    delete window.SpeechRecognition;
    const { result } = renderHook(() => useVoiceRecognition());
    expect(result.current.isSupported).toBe(false);
    await act(async () => { expect(await result.current.startListening()).toBe(false); });
    expect(result.current.status).toBe(STATUS.NO_SUPPORT);
  });
});

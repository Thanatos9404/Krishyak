import { parseVoiceCommand, selectBestAlternative } from './useVoiceRecognition';
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

import { getLanguageCodes, getSpeechCode, isRTL, SUPPORTED_LANGUAGES, loadLanguagePreference } from './config';
import pilot from './pilotLanguages.json';

describe('Indian language configuration', () => {
  test('includes all 22 scheduled Indian languages plus English', () => {
    const scheduled = Object.values(SUPPORTED_LANGUAGES).filter((language) => language.scheduled);

    expect(scheduled).toHaveLength(22);
    expect(getLanguageCodes()).toEqual(pilot.codes);
    expect(new Set(scheduled.map((language) => language.code)).size).toBe(22);
    pilot.deferred.forEach((code) => expect(SUPPORTED_LANGUAGES[code]).toBeUndefined());
  });

  test('uses an Indian BCP-47 speech tag for every language', () => {
    Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
      expect(getSpeechCode(code)).toMatch(/^[a-z]{2,3}-IN$/);
    });
  });

  test('applies right-to-left layout only to Perso-Arabic interface packs', () => {
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('ks')).toBe(true);
    expect(isRTL('sd')).toBe(true);
    expect(isRTL('hi')).toBe(false);
  });

  test('retains an Odia preference and rejects an unsupported code', () => {
    localStorage.setItem('krishyak_language', 'or');
    expect(loadLanguagePreference()).toBe('or');
    localStorage.setItem('krishyak_language', 'invalid');
    expect(pilot.codes).toContain(loadLanguagePreference());
    localStorage.clear();
  });
});

import { getLanguageCodes, getSpeechCode, isRTL, SUPPORTED_LANGUAGES, loadLanguagePreference } from './config';
import pilot from './pilotLanguages.json';

describe('Indian language configuration', () => {
  test('includes the ten selected pilot languages plus English', () => {
    const scheduled = Object.values(SUPPORTED_LANGUAGES).filter((language) => language.scheduled);

    expect(scheduled).toHaveLength(10);
    expect(getLanguageCodes()).toEqual(pilot.codes);
    expect(new Set(scheduled.map((language) => language.code)).size).toBe(10);
    pilot.deferred.forEach((code) => expect(SUPPORTED_LANGUAGES[code]).toBeUndefined());
  });

  test('uses an Indian BCP-47 speech tag for every language', () => {
    Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
      expect(getSpeechCode(code)).toMatch(/^[a-z]{2,3}-IN$/);
    });
  });

  test('applies right-to-left layout only to Perso-Arabic interface packs', () => {
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('hi')).toBe(false);
  });

  test('a preference saved for a deferred language returns an active language', () => {
    localStorage.setItem('krishyak_language', 'or');
    expect(pilot.codes).toContain(loadLanguagePreference());
    localStorage.clear();
  });
});

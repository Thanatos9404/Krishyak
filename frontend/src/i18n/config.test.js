import { getLanguageCodes, getSpeechCode, isRTL, SUPPORTED_LANGUAGES } from './config';

describe('Indian language configuration', () => {
  test('includes every Eighth Schedule language plus English', () => {
    const scheduled = Object.values(SUPPORTED_LANGUAGES).filter((language) => language.scheduled);

    expect(scheduled).toHaveLength(22);
    expect(getLanguageCodes()).toHaveLength(23);
    expect(new Set(scheduled.map((language) => language.code)).size).toBe(22);
  });

  test('uses an Indian BCP-47 speech tag for every language', () => {
    Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
      expect(getSpeechCode(code)).toMatch(/^[a-z]{2,3}-IN$/);
    });
  });

  test('applies right-to-left layout only to Perso-Arabic interface packs', () => {
    expect(isRTL('ks')).toBe(true);
    expect(isRTL('sd')).toBe(true);
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('hi')).toBe(false);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import {
  LOCALE_LOADERS,
  GENERATED_LOCALE_LOADERS,
  SHELL_PATCHES,
  buildDerivedTranslations,
  deepMerge,
} from './I18nProvider';
import { SUPPORTED_LANGUAGES } from './config';
import catalogTranslations from './locales/catalogTranslations';
import english from './locales/en.json';
import { SARVAM_LOCALE_LOADERS } from './sarvamLocales';

const get = (source, path) => path.split('.').reduce((value, key) => value?.[key], source);

const collectVisibleKeys = () => {
  const keys = new Set();
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.endsWith('.test.js')) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) keys.add(match[1]);
      }
    }
  };
  visit(path.resolve(__dirname, '..'));
  return [...keys];
};

const VISIBLE_TRANSLATION_KEYS = collectVisibleKeys();

const FARMER_CRITICAL_KEYS = [
  'nav.dashboard', 'nav.market', 'nav.profile',
  'sidebar.cropSelection', 'sidebar.soilType', 'sidebar.farmArea', 'sidebar.marketPrice',
  'dashboard.yieldEstimate', 'dashboard.totalCost', 'dashboard.netProfit', 'dashboard.riskScore',
  'yieldChart.title', 'yieldChart.modifiers', 'yieldChart.impact',
  'weather.title', 'weatherCard.detectLocation', 'weatherAlert.title',
  'cropHealth.title', 'cropHealth.analyze', 'cropHealth.confidenceLevels.high',
  'fertilizer.title', 'fertilizer.followSchedule',
  'pest.title', 'risk.levels.low', 'risk.components.weather',
  'scenarios.title', 'schemes.title', 'schemes.checkEligibility',
  'jam.title', 'jam.aadhaarVerify', 'jam.bankAccount', 'jam.verifyIdentity',
  'registration.title', 'registration.fullName', 'registration.mobileNumber', 'registration.submit',
  'registration.step1Title', 'registration.aadhaarHelp',
  'voice.startListening', 'voiceNew.correctTranscript',
  'privacy.title', 'terms.title',
];

describe('runtime locale coverage', () => {
  test.each(Object.keys(SUPPORTED_LANGUAGES))('%s has every farmer-critical label', async (code) => {
    const source = await LOCALE_LOADERS[code]();
    const generated = await GENERATED_LOCALE_LOADERS[code]();
    const translated = deepMerge(
      deepMerge(
        deepMerge(
          deepMerge(buildDerivedTranslations(source || {}), source || {}),
          generated,
        ),
        catalogTranslations[code],
      ),
      SHELL_PATCHES[code],
    );

    const missing = FARMER_CRITICAL_KEYS.filter((key) => {
      const value = get(translated, key);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing).toEqual([]);
  });

  test.each(Object.keys(SUPPORTED_LANGUAGES).filter((code) => code !== 'en'))('%s translates the complete API crop and soil catalogs', (code) => {
    for (const section of ['crops', 'soils']) {
      expect(Object.keys(catalogTranslations[code][section])).toEqual(Object.keys(english[section]));
      const englishLeaks = Object.entries(catalogTranslations[code][section])
        .filter(([key, value]) => value.trim() === english[section][key].trim())
        .map(([key]) => `${section}.${key}`);
      expect(englishLeaks).toEqual([]);
    }
  });

  test.each(Object.keys(SUPPORTED_LANGUAGES))('%s contains every literal translation key used by the interface', async (code) => {
    const source = await LOCALE_LOADERS[code]();
    const generated = await GENERATED_LOCALE_LOADERS[code]();
    const translated = deepMerge(
      deepMerge(
        deepMerge(
          deepMerge(buildDerivedTranslations(source || {}), source || {}),
          generated,
        ),
        catalogTranslations[code],
      ),
      SHELL_PATCHES[code],
    );
    const active = deepMerge(translated, await (SARVAM_LOCALE_LOADERS[code]?.() || Promise.resolve({})));
    const missing = VISIBLE_TRANSLATION_KEYS.filter((key) => {
      const value = get(active, key);
      return typeof value !== 'string' || value.trim() === '';
    });
    expect(missing).toEqual([]);
  });
});

describe('legacy provider inside the workspace', () => {
  const { act, render, screen, waitFor } = require('@testing-library/react');
  const { I18nProvider, useTranslation } = require('./I18nProvider');
  const React = require('react');

  const Probe = () => {
    const { t, language } = useTranslation();
    return React.createElement('pre', { 'data-testid': 'probe', 'data-language': language },
      VISIBLE_TRANSLATION_KEYS.map((key) => t(key) || '').join('\n'));
  };

  test('Sindhi never shows the Devanagari machine pack in its right-to-left Perso-Arabic interface', async () => {
    expect(SARVAM_LOCALE_LOADERS.sd).toBeUndefined();
    render(React.createElement(I18nProvider, { preferredLanguage: 'sd' }, React.createElement(Probe)));
    await waitFor(() => expect(screen.getByTestId('probe').dataset.language).toBe('sd'));
    const text = screen.getByTestId('probe').textContent;
    expect(text).toMatch(/[؀-ۿ]/);
    expect(text).not.toMatch(/[ऀ-ॿ]/);
  });

  test('a nested provider leaves html lang, dir and the saved preference to the workspace', async () => {
    document.documentElement.lang = 'en-IN';
    document.documentElement.dir = 'ltr';
    localStorage.removeItem('krishyak_language');
    render(React.createElement(I18nProvider, { preferredLanguage: 'ur' }, React.createElement(Probe)));
    await waitFor(() => expect(screen.getByTestId('probe').dataset.language).toBe('ur'));
    await act(async () => {});
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en-IN');
    expect(localStorage.getItem('krishyak_language')).toBeNull();
  });

  test('a standalone provider still owns html lang and dir', async () => {
    document.documentElement.dir = 'ltr';
    localStorage.setItem('krishyak_language', 'ur');
    render(React.createElement(I18nProvider, null, React.createElement(Probe)));
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(document.documentElement.lang).toBe('ur-IN');
    localStorage.removeItem('krishyak_language');
    document.documentElement.dir = 'ltr';
  });
});

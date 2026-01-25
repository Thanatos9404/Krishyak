/**
 * Krishyak i18n Module - Main Export
 * Provides all internationalization functionality
 */

// Configuration
export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguage,
  getLanguageCodes,
  getLanguageList,
  isRTL,
  getSpeechCode,
  detectBrowserLanguage,
  saveLanguagePreference,
  loadLanguagePreference,
} from './config';

// Provider and Hooks
export {
  I18nProvider,
  useI18n,
  useTranslation
} from './I18nProvider';

// Default export
export { default } from './I18nProvider';

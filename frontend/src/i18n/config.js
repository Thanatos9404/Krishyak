/**
 * Krishyak Internationalization (i18n) Configuration
 * Supports 12+ Indian languages with accessibility-first design
 * 
 * Language codes follow BCP 47 and are compatible with:
 * - Web Speech API (TTS/STT)
 * - Google Translate
 * - Government of India's Bhashini API
 */

// Supported languages with metadata
export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    speechCode: 'en-IN', // Web Speech API code
    ttsVoice: 'en-IN',
    script: 'Latin',
    region: 'All India',
    isDefault: true,
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    direction: 'ltr',
    speechCode: 'hi-IN',
    ttsVoice: 'hi-IN',
    script: 'Devanagari',
    region: 'North India, Central India',
    isDefault: false,
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    direction: 'ltr',
    speechCode: 'mr-IN',
    ttsVoice: 'mr-IN',
    script: 'Devanagari',
    region: 'Maharashtra',
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    direction: 'ltr',
    speechCode: 'ta-IN',
    ttsVoice: 'ta-IN',
    script: 'Tamil',
    region: 'Tamil Nadu',
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    direction: 'ltr',
    speechCode: 'te-IN',
    ttsVoice: 'te-IN',
    script: 'Telugu',
    region: 'Andhra Pradesh, Telangana',
  },
  bn: {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    direction: 'ltr',
    speechCode: 'bn-IN',
    ttsVoice: 'bn-IN',
    script: 'Bengali',
    region: 'West Bengal',
  },
  gu: {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    direction: 'ltr',
    speechCode: 'gu-IN',
    ttsVoice: 'gu-IN',
    script: 'Gujarati',
    region: 'Gujarat',
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    direction: 'ltr',
    speechCode: 'kn-IN',
    ttsVoice: 'kn-IN',
    script: 'Kannada',
    region: 'Karnataka',
  },
  ml: {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    direction: 'ltr',
    speechCode: 'ml-IN',
    ttsVoice: 'ml-IN',
    script: 'Malayalam',
    region: 'Kerala',
  },
  pa: {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    direction: 'ltr',
    speechCode: 'pa-IN',
    ttsVoice: 'pa-IN',
    script: 'Gurmukhi',
    region: 'Punjab',
  },
  or: {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    direction: 'ltr',
    speechCode: 'or-IN',
    ttsVoice: 'or-IN',
    script: 'Odia',
    region: 'Odisha',
  },
  as: {
    code: 'as',
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    direction: 'ltr',
    speechCode: 'as-IN',
    ttsVoice: 'as-IN',
    script: 'Bengali',
    region: 'Assam',
  },
  ur: {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    direction: 'rtl',
    speechCode: 'ur-IN',
    ttsVoice: 'ur-IN',
    script: 'Arabic',
    region: 'Uttar Pradesh, Jammu & Kashmir',
  },
};

// Default language
export const DEFAULT_LANGUAGE = 'en';

// Get language by code
export const getLanguage = (code) => {
  return SUPPORTED_LANGUAGES[code] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
};

// Get all language codes
export const getLanguageCodes = () => Object.keys(SUPPORTED_LANGUAGES);

// Get languages as array for dropdowns
export const getLanguageList = () => {
  return Object.values(SUPPORTED_LANGUAGES).map(lang => ({
    value: lang.code,
    label: `${lang.nativeName} (${lang.name})`,
    ...lang,
  }));
};

// Check if language is RTL
export const isRTL = (code) => {
  const lang = getLanguage(code);
  return lang.direction === 'rtl';
};

// Get speech recognition code for a language
export const getSpeechCode = (code) => {
  const lang = getLanguage(code);
  return lang.speechCode || 'en-IN';
};

// Language detection from browser
export const detectBrowserLanguage = () => {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;

  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0];

  if (SUPPORTED_LANGUAGES[langCode]) {
    return langCode;
  }

  return DEFAULT_LANGUAGE;
};

// Persist language preference
export const saveLanguagePreference = (code) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('krishyak_language', code);
  }
};

// Load language preference
export const loadLanguagePreference = () => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('krishyak_language');
    if (saved && SUPPORTED_LANGUAGES[saved]) {
      return saved;
    }
  }
  return detectBrowserLanguage();
};

// Named export object for eslint compliance
const i18nConfig = {
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
};

export default i18nConfig;

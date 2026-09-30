/**
 * All 22 languages in the Eighth Schedule, plus Indian English.
 * Locale packs are loaded only after selection to keep the first mobile load small.
 */

function language(code, name, nativeName, speechCode, script, region, options = {}) {
  return {
    code,
    name,
    nativeName,
    direction: options.direction || 'ltr',
    speechCode,
    speechFallbackCodes: options.speechFallbackCodes || [],
    ttsVoice: speechCode,
    script,
    region,
    scheduled: options.scheduled !== false,
    isDefault: Boolean(options.isDefault),
  };
}

export const SUPPORTED_LANGUAGES = {
  en: language('en', 'English', 'English', 'en-IN', 'Latin', 'All India', { isDefault: true, scheduled: false }),
  as: language('as', 'Assamese', 'অসমীয়া', 'as-IN', 'Bengali–Assamese', 'Assam'),
  bn: language('bn', 'Bengali', 'বাংলা', 'bn-IN', 'Bengali–Assamese', 'West Bengal, Tripura'),
  brx: language('brx', 'Bodo', 'बर’ राव', 'brx-IN', 'Devanagari', 'Assam', { speechFallbackCodes: ['hi-IN', 'as-IN'] }),
  doi: language('doi', 'Dogri', 'डोगरी', 'doi-IN', 'Devanagari', 'Jammu region', { speechFallbackCodes: ['hi-IN', 'pa-IN'] }),
  gu: language('gu', 'Gujarati', 'ગુજરાતી', 'gu-IN', 'Gujarati', 'Gujarat'),
  hi: language('hi', 'Hindi', 'हिन्दी', 'hi-IN', 'Devanagari', 'North and Central India'),
  kn: language('kn', 'Kannada', 'ಕನ್ನಡ', 'kn-IN', 'Kannada', 'Karnataka'),
  ks: language('ks', 'Kashmiri', 'کٲشُر', 'ks-IN', 'Perso-Arabic', 'Jammu and Kashmir', { direction: 'rtl', speechFallbackCodes: ['ur-IN', 'hi-IN'] }),
  kok: language('kok', 'Konkani', 'कोंकणी', 'kok-IN', 'Devanagari', 'Goa and Konkan', { speechFallbackCodes: ['mr-IN', 'hi-IN'] }),
  mai: language('mai', 'Maithili', 'मैथिली', 'mai-IN', 'Devanagari', 'Bihar and Jharkhand', { speechFallbackCodes: ['hi-IN', 'bn-IN'] }),
  ml: language('ml', 'Malayalam', 'മലയാളം', 'ml-IN', 'Malayalam', 'Kerala'),
  mni: language('mni', 'Manipuri', 'ꯃꯤꯇꯩ ꯂꯣꯟ', 'mni-IN', 'Meitei Mayek', 'Manipur', { speechFallbackCodes: ['bn-IN', 'en-IN'] }),
  mr: language('mr', 'Marathi', 'मराठी', 'mr-IN', 'Devanagari', 'Maharashtra'),
  ne: language('ne', 'Nepali', 'नेपाली', 'ne-IN', 'Devanagari', 'Sikkim and North Bengal'),
  or: language('or', 'Odia', 'ଓଡ଼ିଆ', 'or-IN', 'Odia', 'Odisha'),
  pa: language('pa', 'Punjabi', 'ਪੰਜਾਬੀ', 'pa-IN', 'Gurmukhi', 'Punjab'),
  sa: language('sa', 'Sanskrit', 'संस्कृतम्', 'sa-IN', 'Devanagari', 'All India', { speechFallbackCodes: ['hi-IN'] }),
  sat: language('sat', 'Santali', 'ᱥᱟᱱᱛᱟᱲᱤ', 'sat-IN', 'Ol Chiki', 'Jharkhand, Odisha, West Bengal', { speechFallbackCodes: ['hi-IN', 'bn-IN'] }),
  sd: language('sd', 'Sindhi', 'سنڌي', 'sd-IN', 'Perso-Arabic', 'All India', { direction: 'rtl', speechFallbackCodes: ['ur-IN', 'hi-IN'] }),
  ta: language('ta', 'Tamil', 'தமிழ்', 'ta-IN', 'Tamil', 'Tamil Nadu'),
  te: language('te', 'Telugu', 'తెలుగు', 'te-IN', 'Telugu', 'Andhra Pradesh, Telangana'),
  ur: language('ur', 'Urdu', 'اردو', 'ur-IN', 'Perso-Arabic', 'All India', { direction: 'rtl' }),
};

export const DEFAULT_LANGUAGE = 'en';
export const getLanguage = (code) => SUPPORTED_LANGUAGES[code] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
export const getLanguageCodes = () => Object.keys(SUPPORTED_LANGUAGES);
export const getLanguageList = () => Object.values(SUPPORTED_LANGUAGES).map((lang) => ({ value: lang.code, label: `${lang.nativeName} (${lang.name})`, ...lang }));
export const isRTL = (code) => getLanguage(code).direction === 'rtl';
export const getSpeechCode = (code) => getLanguage(code).speechCode || 'en-IN';
export const getSpeechCodes = (code) => {
  const selected = getLanguage(code);
  return [...new Set([selected.speechCode, ...selected.speechFallbackCodes, 'en-IN'].filter(Boolean))];
};

export const detectBrowserLanguage = () => {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const browserTag = navigator.language || navigator.userLanguage || DEFAULT_LANGUAGE;
  const normalized = browserTag.toLowerCase();
  const exact = Object.values(SUPPORTED_LANGUAGES).find((lang) => lang.speechCode.toLowerCase() === normalized);
  if (exact) return exact.code;
  const base = normalized.split('-')[0];
  return SUPPORTED_LANGUAGES[base] ? base : DEFAULT_LANGUAGE;
};

export const saveLanguagePreference = (code) => {
  if (typeof localStorage !== 'undefined' && SUPPORTED_LANGUAGES[code]) localStorage.setItem('krishyak_language', code);
};

export const loadLanguagePreference = () => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('krishyak_language');
    if (saved && SUPPORTED_LANGUAGES[saved]) return saved;
  }
  return detectBrowserLanguage();
};

const i18nConfig = { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getLanguage, getLanguageCodes, getLanguageList, isRTL, getSpeechCode, getSpeechCodes, detectBrowserLanguage, saveLanguagePreference, loadLanguagePreference };
export default i18nConfig;

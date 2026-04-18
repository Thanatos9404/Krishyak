/**
 * Krishyak i18n Context and Provider
 * Manages language state and provides translation functions
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguage,
  isRTL,
  getSpeechCode,
  saveLanguagePreference,
  loadLanguagePreference
} from './config';

// Import all translation files
import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import pa from './locales/pa.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import or from './locales/or.json';
import as from './locales/as.json';
import ur from './locales/ur.json';

// Translation map
const translations = {
  en,
  hi,
  mr,
  ta,
  te,
  bn,
  gu,
  pa,
  kn,
  ml,
  or,
  as,
  ur,
};

// Create context
const I18nContext = createContext(null);

/**
 * Get nested translation by key path
 * @param {object} obj - Translation object
 * @param {string} path - Dot-separated path (e.g., "nav.dashboard")
 * @param {object} params - Optional interpolation parameters
 */
const getNestedTranslation = (obj, path, params = {}) => {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      // Return null instead of the key path to prevent raw key leakage in UI
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing translation: "${path}"`);
      }
      return null;
    }
  }

  // Handle interpolation {{variable}}
  if (typeof result === 'string' && Object.keys(params).length > 0) {
    return result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  return result;
};

/**
 * I18n Provider Component
 */
export const I18nProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language preference on mount
  useEffect(() => {
    const savedLang = loadLanguagePreference();
    setCurrentLanguage(savedLang);
    setIsLoading(false);

    // Apply RTL if needed
    if (isRTL(savedLang)) {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, []);

  // Change language function
  const changeLanguage = useCallback((langCode) => {
    if (SUPPORTED_LANGUAGES[langCode]) {
      setCurrentLanguage(langCode);
      saveLanguagePreference(langCode);

      // Update document direction for RTL languages
      if (isRTL(langCode)) {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
    }
  }, []);

  // Translation function
  const t = useCallback((key, params = {}) => {
    const currentTranslations = translations[currentLanguage] || translations[DEFAULT_LANGUAGE];
    const translation = getNestedTranslation(currentTranslations, key, params);

    // Fallback to English if not found in current language
    if (translation === null && currentLanguage !== DEFAULT_LANGUAGE) {
      return getNestedTranslation(translations[DEFAULT_LANGUAGE], key, params);
    }

    return translation;
  }, [currentLanguage]);

  // Get current language info
  const languageInfo = getLanguage(currentLanguage);

  // Get speech code for voice recognition
  const speechCode = getSpeechCode(currentLanguage);

  const value = {
    // Current language code
    language: currentLanguage,

    // Current language info object
    languageInfo,

    // Translation function
    t,

    // Change language
    changeLanguage,

    // Speech recognition language code
    speechCode,

    // RTL status
    isRTL: isRTL(currentLanguage),

    // All supported languages
    languages: SUPPORTED_LANGUAGES,

    // Loading state
    isLoading,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

/**
 * Hook to use i18n context
 */
export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

/**
 * Hook for just the translation function (shorthand)
 */
export const useTranslation = () => {
  const { t, language } = useI18n();
  return { t, language };
};

export default I18nProvider;

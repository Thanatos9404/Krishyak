/**
 * Language Selector Component
 * Dropdown for switching between supported languages
 */
import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

const LanguageSelector = ({ className = '' }) => {
  const { language, languageInfo, changeLanguage, languages, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle language change
  const handleLanguageSelect = (langCode) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };

  // Get language list for dropdown
  const languageList = Object.values(languages);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 
                   text-white transition-all duration-200 border border-white/20"
        aria-label={t('accessibility.selectLanguage')}
        aria-expanded={isOpen}
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm font-medium">{languageInfo.nativeName}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full mt-2 right-0 w-64 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto 
                     bg-white rounded-xl shadow-xl border border-gray-200 z-50"
        >
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('accessibility.selectLanguage')}
            </div>

            {languageList.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                           text-left transition-colors duration-150
                           ${language === lang.code
                    ? 'bg-farm-green-50 text-farm-green-700'
                    : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{lang.nativeName}</span>
                  <span className="text-xs text-gray-500">{lang.name} • {lang.region}</span>
                </div>

                {language === lang.code && (
                  <Check className="w-5 h-5 text-farm-green-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;

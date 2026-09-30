import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Globe2, Loader2, Search, Volume2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

const LanguageSelector = ({ className = '' }) => {
  const { language, languageInfo, changeLanguage, languages, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loadingCode, setLoadingCode] = useState(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen) window.setTimeout(() => searchRef.current?.focus(), 0);
    else setQuery('');
  }, [isOpen]);

  const languageList = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return Object.values(languages).filter((item) => !needle ||
      item.name.toLocaleLowerCase().includes(needle) ||
      item.nativeName.toLocaleLowerCase().includes(needle) ||
      item.region.toLocaleLowerCase().includes(needle));
  }, [languages, query]);

  const handleLanguageSelect = async (langCode) => {
    if (langCode === language) {
      setIsOpen(false);
      return;
    }
    setLoadingCode(langCode);
    const changed = await changeLanguage(langCode);
    setLoadingCode(null);
    if (changed) setIsOpen(false);
  };

  return (
    <div className={`language-picker ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="language-picker__trigger"
        aria-label={t('accessibility.selectLanguage') || 'Select language'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Globe2 aria-hidden="true" />
        <span>{languageInfo.nativeName}</span>
        <ChevronDown className={isOpen ? 'rotate-180' : ''} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="language-picker__menu" role="dialog" aria-label={t('accessibility.selectLanguage') || 'Select language'}>
          <div className="language-picker__heading">
            <div>
              <strong>{t('language.choose') || 'Choose your language'}</strong>
              <span>{t('language.coverage') || '22 Indian languages • interface and voice'}</span>
            </div>
            <Volume2 aria-hidden="true" />
          </div>

          <label className="language-picker__search">
            <Search aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('language.search') || 'Search language or region'}
              aria-label={t('language.search') || 'Search language or region'}
            />
          </label>

          <div className="language-picker__list" role="listbox" aria-label={t('language.available') || 'Available languages'}>
            {languageList.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={language === item.code}
                key={item.code}
                onClick={() => handleLanguageSelect(item.code)}
                disabled={Boolean(loadingCode)}
                className={language === item.code ? 'language-option language-option--active' : 'language-option'}
              >
                <span className="language-option__copy">
                  <strong lang={item.speechCode}>{item.nativeName}</strong>
                  <small>{item.name} · {item.region}</small>
                </span>
                {loadingCode === item.code ? <Loader2 className="animate-spin" aria-label={t('common.loading')} /> : null}
                {language === item.code && loadingCode !== item.code ? <Check aria-label={t('common.selected') || 'Selected'} /> : null}
              </button>
            ))}
            {!languageList.length ? <p className="language-picker__empty">{t('common.noResults') || 'No language found'}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LanguageSelector;

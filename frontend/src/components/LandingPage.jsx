import React from 'react';
import { ArrowUpRight, ArrowRight, Sprout, Leaf, CloudSun, BarChart3, Languages, ShieldCheck, Check, ChevronDown } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import ShineBorder from './ui/ShineBorder';
import { useTranslation } from '../i18n';
import { SUPPORTED_LANGUAGES } from '../i18n/config';

export default function LandingPage({ onRegister, onExplore, onNavigate }) {
  const { t } = useTranslation();
  const features = [
    { icon: Sprout, title: 'landing.planTitle', copy: 'landing.planCopy', className: 'feature-card--plan', tags: ['dashboard.yieldEstimate', 'dashboard.totalCost', 'dashboard.netProfit'] },
    { icon: Leaf, title: 'landing.healthTitle', copy: 'landing.healthCopy', className: 'feature-card--health', tags: ['nav.cropHealth', 'dashboard.riskAssessment'] },
    { icon: BarChart3, title: 'landing.marketTitle', copy: 'landing.marketCopy', className: 'feature-card--market', tags: ['nav.market', 'msp.allRates'] },
    { icon: CloudSun, title: 'landing.weatherTitle', copy: 'landing.weatherCopy', className: 'feature-card--weather', tags: ['nav.scenarios', 'nav.aiInsights'] },
  ];
  return <div className="landing-page">
    <a className="skip-link" href="#landing-main">{t('landing.skipContent')}</a>
    <header className="landing-header landing-wrap">
      <a className="landing-brand" href="#landing-main" aria-label="Krishyak"><img src="/krishyak_logo.png" alt="" width="44" height="44" /><span>Krishyak<span className="brand-dot">.</span></span></a>
      <nav className="landing-links" aria-label={t('accessibility.primaryNavigation')}><a href="#tools">{t('landing.tools')}</a><a href="#how-it-works">{t('landing.how')}</a><a href="#languages">{t('landing.languages')}</a></nav>
      <div className="landing-header-actions"><LanguageSelector /><button className="field-button field-button--small" onClick={onRegister}>{t('registration.submit')}<ArrowUpRight size={17} aria-hidden="true" /></button></div>
    </header>
    <main id="landing-main">
      <section className="landing-hero landing-wrap" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="field-eyebrow"><span />{t('landing.eyebrow')}</p>
          <h1 id="hero-title">{t('landing.title')}<em>{t('landing.titleAccent')}</em></h1>
          <p className="hero-description">{t('landing.intro')}</p>
          <div className="hero-actions"><button className="field-button" onClick={onRegister}>{t('landing.start')}<ArrowUpRight aria-hidden="true" /></button><a className="field-text-link" href="#how-it-works">{t('landing.how')}<ArrowRight size={18} aria-hidden="true" /></a></div>
          <div className="hero-assurance"><Languages size={19} aria-hidden="true" /><span>{t('landing.languageNote')}</span></div>
          <div className="hero-footnote"><span className="hero-footnote__line" /><p>{t('landing.builtFor')}</p></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo"><img src="/images/farmer-rice-field.webp" srcSet="/images/farmer-rice-field-small.webp 700w, /images/farmer-rice-field.webp 1400w" sizes="(max-width: 760px) 100vw, 48vw" alt={t('landing.photoAlt')} width="1400" height="2100" fetchpriority="high" /><span className="hero-photo__label"><Sprout size={17} aria-hidden="true" />{t('landing.rooted')}</span></div>
          <div className="field-note"><ShineBorder /><span className="field-note__icon"><Sprout aria-hidden="true" /></span><div><small>{t('landing.fieldNote')}</small><strong>{t('landing.fieldNoteTitle')}</strong><p>{t('landing.fieldNoteCopy')}</p></div></div>
          <span className="hero-photo-credit">Foto Murthy / Unsplash</span>
        </div>
      </section>
      <div className="landing-principles landing-wrap">{[['landing.principle1', Sprout], ['landing.principle2', ShieldCheck], ['landing.principle3', Languages]].map(([key, Icon]) => <div key={key}><Icon size={21} aria-hidden="true" /><span>{t(key)}</span></div>)}</div>
      <section className="landing-section landing-wrap" id="tools" aria-labelledby="tools-title">
        <div className="landing-section-heading"><div><p className="field-eyebrow">{t('landing.toolsEyebrow')}</p><h2 id="tools-title">{t('landing.toolsTitle')}</h2></div><p>{t('landing.toolsCopy')}</p></div>
        <div className="landing-features">{features.map(({ icon: Icon, title, copy, className, tags }, index) => <article className={`feature-card ${className}`} key={title}>
          <div className="feature-card__top"><span className="feature-icon"><Icon size={27} aria-hidden="true" /></span><span className="feature-number">0{index + 1}</span></div>
          <h3>{t(title)}</h3><p>{t(copy)}</p><div className="feature-tags">{tags.map(tag => <span key={tag}><Check size={13} aria-hidden="true" />{t(tag)}</span>)}</div>
        </article>)}</div>
      </section>
      <section className="landing-process" id="how-it-works" aria-labelledby="how-title"><div className="landing-wrap process-layout">
        <div><p className="field-eyebrow">{t('landing.how')}</p><h2 id="how-title">{t('landing.howTitle')}</h2><p className="process-intro">{t('landing.howCopy')}</p><button className="field-text-link" onClick={onRegister}>{t('landing.start')}<ArrowUpRight size={19} aria-hidden="true" /></button></div>
        <ol className="process-steps">{['One', 'Two', 'Three'].map((step, index) => <li key={step}><span className="step-number">0{index + 1}</span><div><h3>{t(`landing.step${step}Title`)}</h3><p>{t(`landing.step${step}Copy`)}</p></div></li>)}</ol>
      </div></section>
      <section className="landing-section landing-wrap language-section" id="languages" aria-labelledby="language-title"><div><p className="field-eyebrow"><Languages size={17} aria-hidden="true" />{t('landing.languages')}</p><h2 id="language-title">{t('landing.languageTitle')}</h2><p>{t('landing.languageCopy')}</p></div><div className="language-garden" aria-label={t('language.available')}>{Object.values(SUPPORTED_LANGUAGES).map(lang => <span lang={lang.speechCode} dir={lang.direction} key={lang.code}>{lang.nativeName}</span>)}</div></section>
      <section className="landing-wrap"><div className="landing-cta"><ShineBorder /><Sprout className="cta-leaf" size={150} strokeWidth={0.7} aria-hidden="true" /><p className="field-eyebrow">{t('landing.ctaEyebrow')}</p><h2>{t('landing.ctaTitle')}</h2><p>{t('landing.ctaCopy')}</p><button className="field-button field-button--cream" onClick={onRegister}>{t('registration.submit')}<ArrowUpRight aria-hidden="true" /></button><button className="cta-guest" onClick={onExplore}>{t('landing.explore')}<ArrowRight size={17} aria-hidden="true" /></button></div></section>
      <section className="landing-wrap landing-faq" aria-labelledby="faq-title"><h2 id="faq-title">{t('landing.faqTitle')}</h2>{['One', 'Two', 'Three'].map(item => <details key={item}><summary>{t(`landing.faq${item}Title`)}<ChevronDown size={18} aria-hidden="true" /></summary><p>{t(`landing.faq${item}Copy`)}</p></details>)}</section>
    </main>
    <footer className="landing-footer landing-wrap"><div><a className="landing-brand" href="#landing-main">Krishyak<span className="brand-dot">.</span></a><p>{t('footer.tagline')}</p></div><nav aria-label={t('landing.more')}><button onClick={() => onNavigate('msp')}>{t('msp.allRates')}</button><button onClick={() => onNavigate('privacy')}>{t('privacy.title')}</button><button onClick={() => onNavigate('terms')}>{t('terms.title')}</button><a href="https://unsplash.com/photos/lXVWulsnNQE" target="_blank" rel="noreferrer">Foto Murthy / Unsplash ↗</a></nav></footer>
  </div>;
}

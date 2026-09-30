import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguage,
  isRTL,
  getSpeechCode,
  getSpeechCodes,
  saveLanguagePreference,
  loadLanguagePreference,
} from './config';
import en from './locales/en.json';
import { SARVAM_LOCALE_LOADERS } from './sarvamLocales';

export const SHELL_PATCHES = {
  as: { nav: { market: 'বজাৰ দাম' }, registration: { skip: 'এতিয়া এৰি যাওক' }, language: { choose: 'ভাষা বাছনি কৰক', coverage: '২২টা ভাৰতীয় ভাষা • লিখা আৰু মাত', search: 'ভাষা বা অঞ্চল বিচাৰক', available: 'উপলব্ধ ভাষা' } },
  bn: { nav: { market: 'বাজার দর' }, registration: { skip: 'এখন বাদ দিন' }, language: { choose: 'আপনার ভাষা বেছে নিন', coverage: '২২টি ভারতীয় ভাষা • লেখা ও কথা', search: 'ভাষা বা অঞ্চল খুঁজুন', available: 'উপলব্ধ ভাষা' } },
  gu: { nav: { market: 'બજાર ભાવ' }, registration: { skip: 'હમણાં છોડો' }, language: { choose: 'તમારી ભાષા પસંદ કરો', coverage: '૨૨ ભારતીય ભાષાઓ • લખાણ અને અવાજ', search: 'ભાષા અથવા વિસ્તાર શોધો', available: 'ઉપલબ્ધ ભાષાઓ' } },
  hi: { nav: { market: 'मंडी भाव' }, registration: { skip: 'अभी छोड़ें' }, language: { choose: 'अपनी भाषा चुनें', coverage: '22 भारतीय भाषाएँ • लिखकर और बोलकर', search: 'भाषा या क्षेत्र खोजें', available: 'उपलब्ध भाषाएँ' } },
  kn: { nav: { market: 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ' }, registration: { skip: 'ಈಗ ಬಿಟ್ಟುಬಿಡಿ' }, language: { choose: 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ', coverage: '22 ಭಾರತೀಯ ಭಾಷೆಗಳು • ಬರಹ ಮತ್ತು ಧ್ವನಿ', search: 'ಭಾಷೆ ಅಥವಾ ಪ್ರದೇಶ ಹುಡುಕಿ', available: 'ಲಭ್ಯ ಭಾಷೆಗಳು' } },
  ml: { nav: { market: 'വിപണി വില' }, registration: { skip: 'ഇപ്പോൾ ഒഴിവാക്കുക' }, language: { choose: 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക', coverage: '22 ഇന്ത്യൻ ഭാഷകൾ • എഴുത്തും ശബ്ദവും', search: 'ഭാഷയോ പ്രദേശമോ തിരയുക', available: 'ലഭ്യമായ ഭാഷകൾ' } },
  mr: { nav: { market: 'बाजारभाव' }, registration: { skip: 'आत्ता वगळा' }, language: { choose: 'तुमची भाषा निवडा', coverage: '२२ भारतीय भाषा • लेखन आणि आवाज', search: 'भाषा किंवा प्रदेश शोधा', available: 'उपलब्ध भाषा' } },
  or: { nav: { market: 'ବଜାର ଦର' }, registration: { skip: 'ବର୍ତ୍ତମାନ ଛାଡ଼ନ୍ତୁ' }, language: { choose: 'ନିଜ ଭାଷା ବାଛନ୍ତୁ', coverage: '୨୨ଟି ଭାରତୀୟ ଭାଷା • ଲେଖା ଓ କଥା', search: 'ଭାଷା କିମ୍ବା ଅଞ୍ଚଳ ଖୋଜନ୍ତୁ', available: 'ଉପଲବ୍ଧ ଭାଷା' } },
  pa: { nav: { market: 'ਮੰਡੀ ਭਾਅ' }, registration: { skip: 'ਹੁਣ ਲਈ ਛੱਡੋ' }, language: { choose: 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ', coverage: '22 ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ • ਲਿਖਤ ਅਤੇ ਆਵਾਜ਼', search: 'ਭਾਸ਼ਾ ਜਾਂ ਇਲਾਕਾ ਲੱਭੋ', available: 'ਉਪਲਬਧ ਭਾਸ਼ਾਵਾਂ' } },
  ta: { nav: { market: 'சந்தை விலை' }, registration: { skip: 'இப்போது தவிர்க்கவும்' }, language: { choose: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்', coverage: '22 இந்திய மொழிகள் • எழுத்து மற்றும் குரல்', search: 'மொழி அல்லது பகுதியைத் தேடவும்', available: 'கிடைக்கும் மொழிகள்' } },
  te: { nav: { market: 'మార్కెట్ ధర' }, registration: { skip: 'ఇప్పటికి వదిలేయండి' }, language: { choose: 'మీ భాషను ఎంచుకోండి', coverage: '22 భారతీయ భాషలు • వచనం మరియు స్వరం', search: 'భాష లేదా ప్రాంతం వెతకండి', available: 'అందుబాటులో ఉన్న భాషలు' } },
  ur: { nav: { market: 'منڈی بھاؤ' }, registration: { skip: 'ابھی چھوڑیں' }, language: { choose: 'اپنی زبان منتخب کریں', coverage: '22 بھارتی زبانیں • تحریر اور آواز', search: 'زبان یا علاقہ تلاش کریں', available: 'دستیاب زبانیں' } },
};

export const deepMerge = (base, patch) => {
  if (!patch || typeof patch !== 'object') return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(base?.[key] || {}, value)
      : value;
  }
  return result;
};

const scheduledLoader = (code) => import('./locales/scheduledLocales').then((module) => module.scheduledLocales[code]);
const catalogLoader = (code) => code === DEFAULT_LANGUAGE
  ? Promise.resolve({})
  : import('./locales/catalogTranslations').then((module) => module.catalogTranslations[code] || {});

// Generated completion packs are also language-split. They fill only keys that
// are absent from the reviewed locale file, keeping the initial download small.
export const GENERATED_LOCALE_LOADERS = {
  en: async () => ({}),
  as: () => import('./locales/generated/as.json').then((module) => module.default),
  bn: () => import('./locales/generated/bn.json').then((module) => module.default),
  brx: () => import('./locales/generated/brx.json').then((module) => module.default),
  doi: () => import('./locales/generated/doi.json').then((module) => module.default),
  gu: () => import('./locales/generated/gu.json').then((module) => module.default),
  hi: () => import('./locales/generated/hi.json').then((module) => module.default),
  kn: () => import('./locales/generated/kn.json').then((module) => module.default),
  ks: () => import('./locales/generated/ks.json').then((module) => module.default),
  kok: () => import('./locales/generated/kok.json').then((module) => module.default),
  mai: () => import('./locales/generated/mai.json').then((module) => module.default),
  ml: () => import('./locales/generated/ml.json').then((module) => module.default),
  mni: () => import('./locales/generated/mni.json').then((module) => module.default),
  mr: () => import('./locales/generated/mr.json').then((module) => module.default),
  ne: () => import('./locales/generated/ne.json').then((module) => module.default),
  or: () => import('./locales/generated/or.json').then((module) => module.default),
  pa: () => import('./locales/generated/pa.json').then((module) => module.default),
  sa: () => import('./locales/generated/sa.json').then((module) => module.default),
  sat: () => import('./locales/generated/sat.json').then((module) => module.default),
  sd: () => import('./locales/generated/sd.json').then((module) => module.default),
  ta: () => import('./locales/generated/ta.json').then((module) => module.default),
  te: () => import('./locales/generated/te.json').then((module) => module.default),
  ur: () => import('./locales/generated/ur.json').then((module) => module.default),
};

// Every non-English pack is a separate lazy chunk. Farmers download only the
// language they select; English and the app shell remain in the first bundle.
export const LOCALE_LOADERS = {
  en: async () => en,
  as: () => import('./locales/as.json').then((module) => module.default),
  bn: () => import('./locales/bn.json').then((module) => module.default),
  brx: () => scheduledLoader('brx'),
  doi: () => scheduledLoader('doi'),
  gu: () => import('./locales/gu.json').then((module) => module.default),
  hi: () => import('./locales/hi.json').then((module) => module.default),
  kn: () => import('./locales/kn.json').then((module) => module.default),
  ks: () => scheduledLoader('ks'),
  kok: () => scheduledLoader('kok'),
  mai: () => scheduledLoader('mai'),
  ml: () => import('./locales/ml.json').then((module) => module.default),
  mni: () => scheduledLoader('mni'),
  mr: () => import('./locales/mr.json').then((module) => module.default),
  ne: () => scheduledLoader('ne'),
  or: () => import('./locales/or.json').then((module) => module.default),
  pa: () => import('./locales/pa.json').then((module) => module.default),
  sa: () => scheduledLoader('sa'),
  sat: () => scheduledLoader('sat'),
  sd: () => scheduledLoader('sd'),
  ta: () => import('./locales/ta.json').then((module) => module.default),
  te: () => import('./locales/te.json').then((module) => module.default),
  ur: () => import('./locales/ur.json').then((module) => module.default),
};

const I18nContext = createContext(null);

const getNestedTranslation = (source, path, params = {}) => {
  let result = source;
  for (const key of path.split('.')) {
    if (result && typeof result === 'object' && key in result) result = result[key];
    else return null;
  }
  if (typeof result === 'string') {
    return result.replace(/\{\{(\w+)\}\}/g, (match, key) => params[key] !== undefined ? params[key] : match);
  }
  return result;
};

// Short derived labels keep API-driven cards localized even when an older
// locale pack does not yet contain the newer semantic keys. They are composed
// only from words already reviewed in that locale; components never fall back
// to hard-coded English copy.
export const buildDerivedTranslations = (messages) => {
  const read = (key, fallback = '') => getNestedTranslation(messages, key) || fallback;
  const low = read('sidebar.low');
  const medium = read('sidebar.medium');
  const high = read('sidebar.high');
  const risk = read('scenarios.risk', read('dashboard.riskScore'));
  const weather = read('weather.title', read('sidebar.weatherConditions', read('dashboard.title')));
  const market = read('nav.market', read('sidebar.marketInfo', read('mandi.title', read('dashboard.title'))));
  const pest = read('sidebar.pestRisk', read('pest.title'));
  const soil = read('sidebar.soilType');
  const join = (...parts) => parts.filter(Boolean).join(' ');

  return {
    common: {
      optional: read('registration.nameOptional', read('common.select', read('common.submit'))),
      information: read('common.select', read('common.submit')),
      live: read('weather.current'),
      notAvailable: read('common.noResults', read('common.error')),
      selected: read('common.success', read('common.select')),
      offline: read('soilSensor.offline', read('common.error')),
      saving: read('common.loading'),
      submitting: read('common.loading'),
      on: read('common.success'),
      and: '•',
      logout: read('common.close'),
    },
    nav: { profile: read('registration.title', read('common.submit')) },
    accessibility: { primaryNavigation: read('nav.dashboard'), mobileNavigation: read('nav.dashboard') },
    sidebar: {
      adjustInputs: read('sidebar.title'),
      marketPrice: market,
      saleMonth: market,
      month: market,
      months: market,
      immediate: read('weather.current', market),
    },
    weather: {
      title: weather,
      lastUpdated: read('weather.current', weather),
      dismissAlert: read('common.close'), kmPerHour: read('weather.wind'), rainSummary: join('{{rain}}', read('weather.rainfall')),
      dataSource: read('weather.title'), conditions: { clear: read('weather.goodConditions'), clouds: read('weather.title'), cloudy: read('weather.title'), rain: read('weather.rainfall'), drizzle: read('weather.rainfall'), unknown: read('weather.title') },
    },
    weatherCard: {
      detecting: read('common.loading'), autoDetect: join(read('weather.current'), soil),
      region: read('pest.location', read('registration.location')), soilType: soil,
      avgRainfall: read('weather.rainfall'), autoFilled: read('common.success'),
      monsoonWarning: read('sidebar.monsoonDelay'), demoData: read('weather.title'),
      clickToDetect: read('weather.advisory', weather), detectLocation: read('pest.detectLocation', read('common.select', weather)),
      detectedLocation: read('registration.location', read('weather.title')),
      india: read('registration.country', read('language.coverage')),
      detectedSummary: join('{{location}}', soil, '{{soil}}'),
      errors: {
        denied: read('common.error'), notSupported: read('common.error'),
        failed: read('common.error'), timeout: read('common.error'),
      },
    },
    weatherAlert: {
      title: read('weather.alerts', weather), recommendation: read('weather.advisory', weather),
      checkForecast: read('weather.forecast'), followAdvice: read('weather.advisory'),
      severity: { critical: read('weather.alerts'), warning: read('weather.alerts'), advisory: read('weather.advisory'), info: read('weather.title') },
    },
    voiceErrors: {
      microphoneDenied: read('voice.notSupported'), noMicrophone: read('voice.notSupported'), network: read('voice.notSupported'),
      serviceUnavailable: read('voice.notSupported'), languageUnavailable: read('voice.notSupported'), notAvailable: read('voice.notSupported'), noMatch: read('voiceNew.noParamsHint'),
    },
    voiceNew: {
      recognitionUsing: '{{code}}',
      correctTranscript: read('voiceNew.statusPlaceholder', read('voice.startListening', read('common.submit'))),
      confidence: read('voice.detected', read('common.success')),
    },
    dashboard: {
      confidence: read('voice.detected'),
      roi: read('scenarios.profit'),
      riskDistribution: read('dashboard.riskAssessment', risk),
      riskInsights: read('recommendations.keyInsights', risk),
      costBreakdown: read('dashboard.totalCost'),
      cultivationCost: read('dashboard.totalCost'),
    },
    yieldChart: {
      title: join(read('scenarios.yield', read('dashboard.yieldEstimate')), read('recommendations.keyInsights', read('dashboard.riskInsights'))),
      modifiers: read('recommendations.optimalParameters', read('sidebar.title')), impact: read('scenarios.yieldBoost', read('dashboard.yieldEstimate')),
      totalModifier: read('scenarios.yieldBoost'), ofBaseYield: read('scenarios.expectedYield'),
      factors: {
        soil, rainfall: read('weather.rainfall'), irrigation: read('sidebar.irrigation'),
        fertilizer: read('sidebar.fertilizerMix'), seed: read('sidebar.seedQuality'), pest,
      },
    },
    scenarios: {
      title: read('nav.scenarios', read('dashboard.title')),
      yieldBoost: read('dashboard.yieldEstimate'),
      expectedYield: read('dashboard.yieldEstimate'),
      risk: read('dashboard.riskScore'),
      profit: read('dashboard.netProfit'),
    },
    recommendations: {
      strategyTitle: read('recommendations.title'),
      strategySubtitle: read('recommendations.keyInsights'),
      strategySummary: read('dashboard.runPrompt'),
      currentProfit: join(read('scenarios.currentPlan'), read('scenarios.profit')),
      optimizedProfit: join(read('scenarios.aiOptimal'), read('scenarios.profit')),
      lossMitigated: read('common.decrease'),
      currentRisk: join(read('scenarios.currentPlan'), risk),
      optimizedRisk: join(read('scenarios.aiOptimal'), risk),
      reduction: read('common.decrease'),
      points: read('scenarios.pointsLower'),
      keyChanges: read('recommendations.optimalParameters'),
      timesPerMonth: read('sidebar.irrigationFrequency'),
      actionItems: read('recommendations.keyInsights'),
    },
    scenarioDetails: {
      seedCost: read('dashboard.totalCost'), moreWater: read('sidebar.irrigation'), lessWater: read('sidebar.irrigation'),
      pumpCost: read('dashboard.totalCost'), saveWater: read('common.decrease'), pestReduction: join(read('pest.lowRisk'), '{{value}}%'),
      sprayCost: read('dashboard.totalCost'), fertilizerBalance: read('sidebar.fertilizerMix'), currentMix: read('scenarios.currentPlan'),
      betterNpk: read('scenarios.aiOptimal'), costVaries: read('dashboard.totalCost'), storageCost: read('dashboard.totalCost'),
      changeTitle: read('recommendations.optimalParameters'), changeSubtitle: read('scenarios.description'), expectedImpact: read('recommendations.profitImprovement'),
      lossReduction: read('common.decrease'), extraYield: read('scenarios.yieldBoost'), estimateNotice: read('msp.infoText'),
      assumptions: read('scenarios.description'), currentAssumption: read('scenarios.currentPlan'), optimizedAssumption: read('scenarios.aiOptimal'), worstAssumption: read('scenarios.worstCase'),
      lossToProfit: read('scenarios.profit'), priceSource: read('msp.source'), stalePriceNotice: read('msp.infoText'), livePriceNotice: read('msp.infoText'), disclaimer: read('msp.infoText'),
    },
    priceForecast: {
      title: read('simulation.priceForecast', market),
      price: market,
      currentPrice: read('msp.currentMsp', market),
      expectedPeak: join(market, high),
      optimalWindow: market,
      sellingAdvice: '{{start}} – {{end}}',
      disclaimer: read('msp.infoText', market),
      trends: { insufficient: read('dashboard.noData'), earlyPeak: join(market, high), lateRise: join(market, high), upward: join(market, high), downward: join(market, low), stable: join(market, medium) },
    },
    msp: {
      title: market, allRates: market, viewAll: read('common.viewAll', market),
      currentMsp: market, perQuintal: read('common.perQuintal', market),
      selectCrop: read('sidebar.cropSelection'), infoText: read('weather.advisory', market),
      source: read('sidebar.marketInfo', market), lastUpdated: read('weather.lastUpdated'),
      seasonSummary: join(read('seasons.kharif'), read('seasons.rabi'), read('sidebar.saleMonth')),
    },
    mandi: {
      title: market, loading: read('common.loading'), noData: read('common.noResults', read('dashboard.noData')),
      source: read('sidebar.marketInfo', market), lastUpdated: read('weather.lastUpdated', read('weather.current', market)),
    },
    fertilizer: {
      title: read('sidebar.fertilizerMix', read('dashboard.fertilizers', read('sidebar.title'))),
      forCrop: '{{crop}}', refresh: join(read('common.refresh'), read('fertilizer.title')),
      loadError: join(read('common.error'), read('fertilizer.title')),
      followSchedule: read('fertilizer.schedule', read('weather.advisory', read('sidebar.fertilizerMix'))),
      products: { urea: 'Urea', dap: 'DAP', mop: 'MOP', npk: 'NPK', organic: read('fertilizer.organic') },
      tooltips: {
        urea: join(read('soilSensor.nitrogen'), read('fertilizer.followSchedule')), dap: join(read('soilSensor.phosphorus'), read('fertilizer.followSchedule')),
        mop: join(read('soilSensor.potassium'), read('fertilizer.followSchedule')), npk: join(read('fertilizer.npkApplied'), read('fertilizer.followSchedule')),
        organic: join(read('fertilizer.organic'), read('fertilizer.followSchedule')),
      },
      methods: { basal: read('fertilizer.basal'), topDress: read('fertilizer.lateVegetative'), split: read('fertilizer.schedule'), beforeSowing: read('fertilizer.basal'), atSowing: read('fertilizer.basal') },
      stages: { basal: read('fertilizer.basal'), earlyvegetative: read('fertilizer.earlyVegetative'), latevegetative: read('fertilizer.lateVegetative'), flowering: read('fertilizer.flowering'), grainfilling: read('fertilizer.grainFilling') },
      safety: { 1: read('fertilizer.safetyNotes'), 2: read('fertilizer.safetyNotes'), 3: read('fertilizer.safetyNotes'), 4: read('fertilizer.safetyNotes') },
    },
    soilSensor: {
      liveSensor: join(read('common.live'), read('soilSensor.title')), sampleData: read('weatherCard.demoData'), noSensor: read('soilSensor.disconnected'),
      cachedData: read('soilSensor.offline'), manualEntry: read('soilSensor.enterManually'),
      sources: { sensor: read('soilSensor.connected'), sample: read('weatherCard.demoData'), cache: read('soilSensor.offline'), manual: read('soilSensor.enterManually'), unknown: read('common.notAvailable') },
      timeAgo: { seconds: join('{{count}}', read('weather.secondsAgo')), minutes: join('{{count}}', read('weather.minutesAgo')), hours: join('{{count}}', read('weather.hoursAgo')) },
      help: { nitrogen: read('soilSensor.nitrogen'), phosphorus: read('soilSensor.phosphorus'), potassium: read('soilSensor.potassium'), ph: read('soilSensor.properties'), organicCarbon: read('soilSensor.organicCarbon') },
    },
    cropHealth: {
      analyze: read('cropHealth.analyzing', read('sidebar.runSimulation')),
      selectedPlant: read('cropHealth.selectCrop'), sampleUnavailable: read('cropHealth.modelLimitationsDesc'),
      invalidImage: read('cropHealth.supportsText'), imageTooLarge: read('cropHealth.supportsText'),
      healthySummary: read('cropHealth.noDiseaseDetected'), symptomsSummary: read('cropHealth.symptoms'),
      chemicalSummary: read('cropHealth.agronomicDisclaimer'), organicSummary: read('cropHealth.agronomicDisclaimer'), preventionSummary: read('cropHealth.agronomicDisclaimer'),
      confidenceLevels: {
        high: join(high, read('dashboard.confidence', read('voice.detected', read('common.success')))), highDesc: read('cropHealth.diseaseDetected'),
        medium: join(medium, read('dashboard.confidence')), mediumDesc: read('cropHealth.agronomicDisclaimer'),
        low: join(low, read('dashboard.confidence')), lowDesc: read('cropHealth.agronomicDisclaimer'),
      },
    },
    diseases: {
      blast: read('cropHealth.diseaseDetected'), bacterialblight: read('cropHealth.diseaseDetected'), brownspot: read('cropHealth.diseaseDetected'), tungro: read('cropHealth.diseaseDetected'),
      yellowrust: read('cropHealth.diseaseDetected'), brownrust: read('cropHealth.diseaseDetected'), blackrust: read('cropHealth.diseaseDetected'), leafblight: read('cropHealth.diseaseDetected'),
      leafcurl: read('cropHealth.diseaseDetected'), anthracnose: read('cropHealth.diseaseDetected'), aphid: read('cropHealth.diseaseDetected'), commonrust: read('cropHealth.diseaseDetected'),
      grayleafspot: read('cropHealth.diseaseDetected'), earrot: read('cropHealth.diseaseDetected'), fallarmyworm: read('cropHealth.diseaseDetected'), mosaic: read('cropHealth.diseaseDetected'),
      redrot: read('cropHealth.diseaseDetected'), earlyblight: read('cropHealth.diseaseDetected'), lateblight: read('cropHealth.diseaseDetected'), leafmold: read('cropHealth.diseaseDetected'),
      powderymildew: read('cropHealth.diseaseDetected'), downymildew: read('cropHealth.diseaseDetected'), canker: read('cropHealth.diseaseDetected'), greening: read('cropHealth.diseaseDetected'),
    },
    validation: {
      required: read('common.error'), min: read('common.error'), max: read('common.error'),
      range: join('{{label}}', '{{min}}', '{{max}}'), invalid: read('common.error'),
      saveFailed: read('validation.submitFailed', read('common.error')),
      submitFailed: read('common.error'), loadFailed: read('common.error'),
    },
    pest: {
      title: pest,
      refresh: join(read('common.refresh'), read('pest.title')),
      loading: join(read('common.loading'), read('pest.title')),
      unavailable: join(read('common.error'), read('pest.title')),
      connectionHint: read('pest.selectCropMessage'),
      offlineFallback: join(read('pest.title'), '{{crop}}'),
      safeZone: read('pest.safeMessage', low),
      noCropAlerts: read('pest.noAlerts'),
      alertDescription: read('pest.safeMessage'),
      predictionFactor: read('pest.seasonalRisk'),
      actions: { 1: read('pest.recommendedActions'), 2: read('pest.recommendedActions'), 3: read('pest.recommendedActions') },
    },
    risk: {
      levels: { low: join(low, risk), moderate: join(medium, risk), high: join(high, risk), severe: join(high, risk) },
      guidance: { low, moderate: medium, high, severe: high },
      range: { safe: low, elevated: high },
      explanation: join(risk, '{{level}}'),
      components: { weather: join(weather, risk), price: join(market, risk), pest, soil: join(soil, risk) },
      insights: {
        weatherHigh: join(weather, high), weatherModerate: join(weather, medium), weatherLow: join(weather, low),
        priceHigh: join(market, high), priceModerate: join(market, medium), priceLow: join(market, low),
        pestHigh: join(pest, high), pestModerate: join(pest, medium), pestLow: join(pest, low),
        soilHigh: join(soil, high), soilModerate: join(soil, medium), soilLow: join(soil, low),
        reviewInputs: read('dashboard.runPrompt'),
      },
    },
    costs: {
      seed_cost: read('dashboard.seeds', read('sidebar.seedQuality')),
      fertilizer_cost: read('dashboard.fertilizers', read('sidebar.fertilizerMix')),
      irrigation_cost: read('dashboard.irrigation', read('sidebar.irrigationPest')),
      labour_cost: read('dashboard.labour', read('dashboard.totalCost')),
      pesticide_cost: read('dashboard.pestControl', pest),
      land_preparation: read('registration.step3Title', soil),
      harvesting_cost: read('dashboard.totalCost'),
      market_fees: market,
      logistics_cost: read('dashboard.logistics', read('dashboard.totalCost')),
      miscellaneous: read('dashboard.totalCost'),
    },
    jam: {
      title: read('schemes.title'), aadhaarVerify: read('schemes.checkEligibility'),
      landRecords: read('sidebar.farmArea'), bankAccount: read('schemes.documents'),
      pmKisanStatus: 'PM-KISAN', consentTitle: read('schemes.checkEligibility'),
      consentMessage: read('schemes.checkEligibility'), grantConsent: read('common.submit'),
      denyConsent: read('common.cancel'), verified: read('common.success'),
      pending: read('common.loading'), notLinked: read('common.noResults'),
      startVerification: read('schemes.checkEligibility'), verifyAndFetch: read('schemes.checkEligibility'),
      enterAadhaar: read('schemes.documents'), nameOptional: read('common.optional'),
      schemeEligibility: read('schemes.eligible'), farmerCategory: read('schemes.eligible'),
      demoNotice: read('jam.consentMessage', read('schemes.checkEligibility')),
      pmKisanEligibility: read('jam.pmKisanStatus', 'PM-KISAN'),
      pmKisanBenefit: read('jam.landRecords', read('sidebar.farmArea')),
      dbtReady: read('jam.dbtEnabled', read('common.success')),
      dbtBenefit: read('jam.bankAccount', read('schemes.documents')),
      schemeMatching: read('jam.schemeEligibility', read('schemes.eligible')),
      schemeBenefit: read('schemes.eligibleSchemes'),
      privacyProtected: read('privacy.title', read('common.save')),
      privacyBenefit: read('jam.consentMessage', read('schemes.checkEligibility')),
      subtitle: read('jam.title', read('schemes.title')), willAccess: read('jam.consentMessage', read('schemes.checkEligibility')),
      aadhaarScope: read('jam.aadhaarVerify', read('schemes.checkEligibility')), landScope: read('jam.landRecords', read('sidebar.farmArea')),
      bankScope: read('jam.bankAccount', read('schemes.documents')), pmKisanScope: read('jam.pmKisanStatus', 'PM-KISAN'),
      verifyIdentity: read('jam.startVerification', read('schemes.checkEligibility')), verifyIdentityHint: read('jam.consentMessage', read('schemes.checkEligibility')),
      consentGranted: read('jam.verified', read('common.success')), demoDigits: read('jam.demoNotice', read('schemes.checkEligibility')),
      namePlaceholder: read('jam.nameOptional', read('common.optional')), verifying: read('common.loading'),
      nameMatched: read('jam.verified', read('common.success')), janDhan: read('jam.bankAccount', read('schemes.documents')),
      received: read('jam.verified', read('common.success')), notEnrolled: read('jam.notLinked', read('common.noResults')),
      categories: {
        small: read('jam.smallFarmer', read('schemes.eligible')), marginal: read('jam.marginalFarmer', read('schemes.eligible')),
        medium: read('jam.farmerCategory', read('schemes.eligible')), large: read('jam.farmerCategory', read('schemes.eligible')),
      },
    },
    schemes: {
      title: read('nav.schemes', read('dashboard.title')),
      checkEligibility: read('schemes.eligible', read('common.submit', read('common.next'))),
      likelyEligible: read('schemes.eligible'), needsVerification: read('jam.pending'), moreInfo: read('common.information'), notMatched: read('common.noResults'),
      catalog: {
        'pm-kisan': { name: 'PM-KISAN', fullName: read('schemes.title') }, pmfby: { name: 'PMFBY', fullName: read('schemes.title') },
        'soil-health-card': { name: read('soilSensor.title'), fullName: read('schemes.title') }, 'micro-irrigation': { name: read('sidebar.irrigation'), fullName: read('schemes.title') },
        'organic-farming': { name: read('farmingType.organic'), fullName: read('schemes.title') }, kcc: { name: read('schemes.title'), fullName: read('schemes.title') },
        msp: { name: 'MSP', fullName: read('msp.title') }, smam: { name: read('schemes.title'), fullName: read('schemes.title') },
        aif: { name: read('schemes.title'), fullName: read('schemes.title') }, enam: { name: 'e-NAM', fullName: read('nav.market') },
      },
      programDescription: read('schemes.title'), frequency: { yearly: read('seasons.annual') }, basisOfMatch: read('schemes.checkEligibility'), matches: read('schemes.eligible'),
      missing: read('common.information'), officialSource: read('msp.source'), verifyNotice: read('schemes.checkEligibility'), headerTitle: read('schemes.title'),
      headerSubtitle: read('schemes.checkEligibility'), estimatedSupport: read('schemes.benefits'), tracking: join('{{count}}', read('schemes.allSchemes')), transparencyNote: read('schemes.checkEligibility'),
      notes: {
        enterFarmData: read('dashboard.runPrompt'), noData: read('dashboard.noData'), area: join(read('sidebar.farmArea'), '{{area}}'), crop: join(read('sidebar.cropSelection'), '{{crop}}'),
        minimumArea: join(read('sidebar.farmArea'), '{{minimum}}'), areaMatches: read('schemes.eligible'), landRequired: read('jam.landRecords'), landMatches: read('jam.verified'),
        cropNotSupported: read('schemes.notMatched'), cropMatches: read('schemes.eligible'), allCrops: read('schemes.allSchemes'), clusterRequired: read('jam.pending'), irrigationRequired: read('sidebar.irrigationPest'), bankVerification: read('jam.bankAccount'),
      },
      documentNames: {
        castecertificateifapplicable: read('schemes.documents'),
        aadhaarcard: read('jam.aadhaarVerify'), bankaccount: read('jam.bankAccount'), bankaccountdetails: read('jam.bankAccount'),
        clusterformation: read('schemes.documents'), cropinsuranceapp: read('schemes.documents'), ekyccompletion: read('jam.verified'), idproof: read('schemes.documents'), landdetails: read('jam.landRecords'),
        landrecords: read('jam.landRecords'), landleasedocuments: read('jam.landRecords'), mandiregistration: read('nav.market'), organicplan: read('farmingType.organic'), passportphoto: read('cropHealth.takePhoto'),
        producequalitycertificate: read('schemes.documents'), projectreport: read('schemes.documents'), sowingcertificate: read('schemes.documents'), watersourceproof: read('sidebar.irrigationPest'),
      },
    },
    registration: {
      title: join(read('nav.profile'), read('common.submit')),
      subtitle: join(read('schemes.checkEligibility'), read('dashboard.runPrompt')),
      step1Title: read('sidebar.basicInfo', read('common.submit')), step2Title: read('pest.location', weather),
      step3Title: soil, step4Title: read('sidebar.title'),
      stepOf: join(read('common.next'), '{{current}}', read('common.total'), '{{total}}'),
      fullName: read('nav.profile', read('common.submit')), fullNamePlaceholder: read('nav.profile', read('common.submit')),
      fatherName: read('nav.profile', read('common.submit')), fatherNamePlaceholder: read('nav.profile', read('common.submit')),
      mobileNumber: read('voice.startListening', read('common.submit')), dateOfBirth: read('nav.profile', read('common.submit')), aadhaarNumber: read('schemes.documents'),
      aadhaarHelp: read('schemes.checkEligibility', read('common.information', read('common.save'))),
      state: read('pest.location', weather), selectState: read('pest.detectLocation', read('common.select')),
      district: read('pest.location', weather), selectDistrict: read('pest.detectLocation', read('common.select')),
      tehsil: read('pest.location', weather), selectTehsil: read('pest.detectLocation', read('common.select')),
      village: read('pest.location', weather), villagePlaceholder: read('pest.location', weather), pinCode: read('pest.location', weather),
      khasraNumber: read('schemes.documents'), khasraPlaceholder: read('schemes.documents'),
      totalLandArea: read('sidebar.farmArea'), irrigatedLand: read('sidebar.irrigation'), rainfedLand: read('weather.rainfall'),
      ownershipType: read('schemes.documents'), primaryCrop: read('sidebar.cropSelection'), secondaryCrops: read('sidebar.cropSelection'),
      farmingType: read('sidebar.title'), experience: read('sidebar.title'), consentTitle: read('schemes.checkEligibility'),
      consentData: read('schemes.checkEligibility'), consentTerms: read('schemes.checkEligibility'),
      previous: read('common.back'), next: read('common.next'), skip: read('common.close'),
      submit: read('common.submit'), autoSave: read('common.saving', read('common.save')),
      success: read('common.success'), nameOptional: read('common.optional'), country: read('language.coverage'),
    },
    ownership: {
      own: read('common.success'), leased: read('schemes.documents'), shared: read('schemes.documents'),
    },
    farmingType: {
      organic: read('fertilizer.organic'), conventional: read('sidebar.title'), mixed: read('sidebar.fertilizerMix'),
    },
    experience: {
      '0-5': '0–5', '5-10': '5–10', '10-20': '10–20', '20+': '20+',
    },
    privacy: {
      title: read('privacy.title', read('common.select', read('common.save'))), lastUpdated: read('weather.lastUpdated', read('weather.current')),
      summary: read('jam.privacyBenefit', read('privacy.title', read('common.information'))), contact: 'privacy@krishyak.app',
      sections: {
        1: { title: read('registration.title'), body: read('jam.consentMessage') },
        2: { title: read('registration.step2Title'), body: read('cropHealth.subtitle') },
        3: { title: read('jam.aadhaarVerify'), body: read('jam.privacyBenefit', read('jam.consentMessage')) },
        4: { title: read('common.logout'), body: read('registration.autoSave') },
      },
    },
    terms: {
      title: read('terms.title', read('schemes.eligible', read('common.next'))), lastUpdated: read('weather.lastUpdated', read('weather.current')),
      summary: read('msp.infoText', read('terms.title', read('schemes.checkEligibility'))), contact: 'support@krishyak.app',
      sections: {
        1: { title: read('sidebar.title'), body: read('dashboard.runPrompt') },
        2: { title: read('simulation.title'), body: read('msp.infoText') },
        3: { title: read('schemes.title'), body: read('schemes.checkEligibility') },
        4: { title: read('fertilizer.safetyNotes', read('terms.title')), body: read('cropHealth.agronomicDisclaimer', read('terms.title')) },
      },
    },
  };
};

const applyDocumentLanguage = (code) => {
  if (typeof document === 'undefined') return;
  const info = getLanguage(code);
  document.documentElement.lang = info.speechCode;
  document.documentElement.dir = info.direction;
};

export const I18nProvider = ({ children }) => {
  const initialEnglishRef = useRef(null);
  if (!initialEnglishRef.current) {
    initialEnglishRef.current = deepMerge(buildDerivedTranslations(en), en);
  }
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [messages, setMessages] = useState(initialEnglishRef.current);
  const [isLoading, setIsLoading] = useState(true);
  const cacheRef = useRef({ en: initialEnglishRef.current });
  const requestRef = useRef(0);

  const loadLanguage = useCallback(async (code) => {
    const safeCode = SUPPORTED_LANGUAGES[code] ? code : DEFAULT_LANGUAGE;
    if (cacheRef.current[safeCode]) return cacheRef.current[safeCode];
    const sarvam = await (SARVAM_LOCALE_LOADERS[safeCode]?.() || Promise.resolve({}));
    if (sarvam.app && sarvam.speech) {
      cacheRef.current[safeCode] = sarvam;
      return sarvam;
    }
    // Retain the previous static pack only while a new pack is being generated.
    const [loaded, generated, catalog] = await Promise.all([
      LOCALE_LOADERS[safeCode](),
      GENERATED_LOCALE_LOADERS[safeCode](),
      catalogLoader(safeCode),
    ]);
    const withDerivedKeys = deepMerge(buildDerivedTranslations(loaded || {}), loaded || {});
    const withGenerated = deepMerge(withDerivedKeys, generated);
    const withCatalog = deepMerge(withGenerated, catalog);
    cacheRef.current[safeCode] = deepMerge(deepMerge(withCatalog, SHELL_PATCHES[safeCode]), sarvam);
    return cacheRef.current[safeCode];
  }, []);

  const changeLanguage = useCallback(async (langCode) => {
    if (!SUPPORTED_LANGUAGES[langCode]) return false;
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const nextMessages = await loadLanguage(langCode);
      if (requestId !== requestRef.current) return false;
      setMessages(nextMessages);
      setCurrentLanguage(langCode);
      saveLanguagePreference(langCode);
      applyDocumentLanguage(langCode);
      return true;
    } catch (error) {
      console.error(`[i18n] Could not load ${langCode}`, error);
      return false;
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, [loadLanguage]);

  useEffect(() => {
    const saved = loadLanguagePreference();
    changeLanguage(saved).finally(() => setIsLoading(false));
  }, [changeLanguage]);

  const t = useCallback((key, params = {}) => {
    const translated = getNestedTranslation(messages, key, params);
    if (translated !== null && translated !== undefined) return translated;
    const fallback = getNestedTranslation(en, key, params);
    return fallback === null || fallback === undefined ? null : fallback;
  }, [messages]);

  const languageInfo = getLanguage(currentLanguage);
  const value = {
    language: currentLanguage,
    languageInfo,
    t,
    changeLanguage,
    speechCode: getSpeechCode(currentLanguage),
    speechCodes: getSpeechCodes(currentLanguage),
    isRTL: isRTL(currentLanguage),
    languages: SUPPORTED_LANGUAGES,
    isLoading,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
};

export const useTranslation = () => {
  const { t, language, languageInfo, speechCode, speechCodes, isLoading } = useI18n();
  return { t, language, languageInfo, speechCode, speechCodes, isLoading };
};

export default I18nProvider;

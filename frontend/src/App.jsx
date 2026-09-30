import React, { useEffect, useRef, useState } from 'react';
import { areaInHectares } from './utils/units';
import {
  BarChart3,
  ChevronDown,
  FileText,
  Leaf,
  Lightbulb,
  LogOut,
  MapPin,
  Mic,
  Shield,
  Store,
  TrendingUp,
  UserRound,
  WifiOff
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LoadingOverlay from './components/LoadingOverlay';
import FloatingActionButton from './components/FloatingActionButton';
import BottomSheet from './components/BottomSheet';
import { useToast, ToastContainer } from './components/Toast';
import LanguageSelector from './components/LanguageSelector';
import LandingPage from './components/LandingPage';
import VoiceInputModal from './components/VoiceInputModal';
import { SpeakButton, visiblePageText } from './hooks/useTextToSpeech';
import { useFarmerSession } from './hooks/useFarmerSession';
import { useTranslation } from './i18n';
import farmingApi from './api/farmingApi';
import { readSimulationCache, sameFarmInputs, SIMULATION_CACHE_VERSION } from './utils/simulationCache';

import useFarmCatalog from './hooks/useFarmCatalog';
import {deferredFeature} from './components/deferredFeature';

const ScenarioComparison = deferredFeature(() => import('./components/ScenarioComparison'));
const RecommendationPanel = deferredFeature(() => import('./components/RecommendationPanel'));
const CropHealthCheck = deferredFeature(() => import('./components/CropHealthCheck'));
const MandiPriceCard = deferredFeature(() => import('./components/MandiPriceCard'));
const MSPRateCard = deferredFeature(() => import('./components/MSPRateCard'));
const PriceForecastChart = deferredFeature(() => import('./components/PriceForecastChart'));
const FarmerRegistrationForm = deferredFeature(() => import('./components/FarmerRegistrationForm'));
const MSPFullView = deferredFeature(() => import('./components/MSPFullView'));
const PrivacyPolicy = deferredFeature(() => import('./components/PrivacyPolicy'));
const TermsOfService = deferredFeature(() => import('./components/TermsOfService'));

function App() {
  const { t } = useTranslation();
  const {
    farmer,
    isRegistered,
    loading: sessionLoading,
    logout,
    login,
    guestLogin
  } = useFarmerSession();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentPage, setCurrentPage] = useState('main');
  const { crops, soilTypes, status: catalogStatus, reload: reloadCatalog } = useFarmCatalog();
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [mobileInputsOpen, setMobileInputsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const { toasts, addToast, removeToast } = useToast();

  const [formData, setFormData] = useState({
    crop: 'Rice',
    soil_type: 'Alluvial',
    area_hectares: 2.0,
    seed_quality: 0.75,
    expected_rainfall: 800,
    rainfall_delay: 0,
    irrigation_frequency: 4,
    fertilizer_mix: {
      Urea: 100,
      DAP: 50,
      MOP: 40,
      NPK: 0,
      Organic: 20
    },
    pest_probability: 0.2,
    labour_days: 30,
    pest_control_intensity: 0.6,
    sale_month: 2,
    current_market_price: 2500,
    seed_quantity_kg: 100
  });

  const requestSequence = useRef(0);
  const defaultInputs = useRef(formData);
  const resultInputs = useRef(null);
  const currentInputs = useRef(formData);
  currentInputs.current = formData;
  useEffect(() => () => { requestSequence.current += 1; }, []);
  useEffect(() => {
    if (resultInputs.current && !sameFarmInputs(resultInputs.current, formData)) {
      setSimulationData(null);
      setComparisonData(null);
      setRecommendationData(null);
      setIsOffline(false);
      resultInputs.current = null;
    }
  }, [formData]);

  const isGuest = guestMode || Boolean(farmer?.isGuest);

  useEffect(() => {
    try {
      const cached = readSimulationCache(localStorage.getItem('krishyak_sim_cache'));
      if (cached) {
        resultInputs.current = cached.formData;
        setSimulationData(cached.simulationData);
        setComparisonData(cached.comparisonData);
        setRecommendationData(cached.recommendationData);
        setFormData(cached.formData);
        setIsOffline(true);
      }
    } catch (error) {
      console.warn('Ignoring invalid saved simulation data.');
    }
  }, []);

  useEffect(() => {
    if (farmer?.isGuest) setGuestMode(true);
  }, [farmer]);

  useEffect(() => {
    if (farmer?.primaryCrop) {
      setFormData(previous => ({
        ...previous,
        crop: farmer.primaryCrop,
        area_hectares: areaInHectares(farmer.totalLandArea, farmer.landUnit) ?? previous.area_hectares
      }));
    }
  }, [farmer]);


  useEffect(() => {
    const pageFromPath = () => {
      const path = window.location.pathname;
      if (path === '/privacy') return 'privacy';
      if (path === '/terms') return 'terms';
      if (path === '/msp') return 'msp';
      if (path === '/register') return 'register';
      return 'main';
    };

    setCurrentPage(pageFromPath());
    const handlePopState = () => setCurrentPage(pageFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const navigateTo = (page) => {
    const paths = {
      main: '/',
      msp: '/msp',
      privacy: '/privacy',
      terms: '/terms',
      register: '/register'
    };
    window.history.pushState({}, '', paths[page] || '/');
    setCurrentPage(page);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const selectTab = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runSimulation = async () => {
    const sequence = ++requestSequence.current;
    const inputs = JSON.parse(JSON.stringify(formData));
    const isCurrent = () => sequence === requestSequence.current && sameFarmInputs(inputs, currentInputs.current);
    setLoading(true);
    setMobileInputsOpen(false);
    setIsOffline(false);

    try {
      const [simRes, compRes, recRes] = await Promise.all([
        farmingApi.simulate(inputs, 500),
        farmingApi.compareScenarios(inputs, 500),
        farmingApi.getRecommendations(inputs)
      ]);

      if (!isCurrent()) return;
      if (![simRes, compRes, recRes].every(result => result?.success === true && result.data)) {
        throw new Error('Incomplete simulation response');
      }
      resultInputs.current = inputs;
      setSimulationData(simRes.data);
      setComparisonData(compRes.data);
      setRecommendationData(recRes.data);
      selectTab('dashboard');

      try {
        localStorage.setItem('krishyak_sim_cache', JSON.stringify({
          schemaVersion: SIMULATION_CACHE_VERSION,
          simulationData: simRes.data,
          comparisonData: compRes.data,
          recommendationData: recRes.data,
          formData: inputs,
          cached_at: new Date().toISOString(),
          source: 'cached'
        }));
      } catch (error) {
        console.warn('Could not save simulation for offline use.');
      }

      addToast({
        type: 'success',
        message: t('simulation.complete') || 'Analysis complete',
        profitImprovement: recRes.data.profit_improvement || 0,
        actionText: t('recommendations.title') || 'View Recommendations',
        onAction: () => selectTab('recommendations')
      });
    } catch (error) {
      if (!isCurrent()) return;
      try {
        const cached = readSimulationCache(localStorage.getItem('krishyak_sim_cache'), inputs);
        if (cached) {
          resultInputs.current = inputs;
          setIsOffline(true);
          setSimulationData(cached.simulationData);
          setComparisonData(cached.comparisonData);
          setRecommendationData(cached.recommendationData);

          selectTab('dashboard');
          addToast({
            type: 'error',
            message: `${t('common.offline')}. ${t('soilSensor.cachedData')}.`
          });
        } else {
          addToast({
            type: 'error',
            message: t('common.error'),
            actionText: t('common.retry') || 'Retry',
            onAction: runSimulation
          });
        }
      } catch (cacheError) {
        addToast({
          type: 'error',
          message: t('errors.simulationFailed') || 'Failed to run simulation.'
        });
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  const handleRegistrationComplete = (profile) => {
    login(profile);
    setGuestMode(false);
    addToast({
      type: 'success',
      message: t('registration.success') || `Welcome, ${profile.fullName}! Registration complete.`
    });
    navigateTo('main');
  };

  const handleSkipRegistration = () => {
    guestLogin();
    setGuestMode(true);
    navigateTo('main');
  };

  const handleProfileClick = () => {
    if (!isRegistered) {
      navigateTo('register');
      return;
    }
    setProfileOpen(open => !open);
  };

  const handleLogout = () => {
    requestSequence.current += 1;
    setSimulationData(null);
    setComparisonData(null);
    setRecommendationData(null);
    setLoading(false);
    setIsOffline(false);
    setActiveTab('dashboard');
    resultInputs.current = null;
    setFormData(defaultInputs.current);
    logout();
    setGuestMode(false);
    setProfileOpen(false);
    navigateTo('main');
  };

  const catalogNotice = Object.values(catalogStatus).some(status => status !== 'live') ? (
    <div role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      {Object.entries(catalogStatus).filter(([,status]) => status !== 'live').map(([key,status]) => (
        <p key={key}>{t(key === 'crops' ? 'sidebar.cropType' : 'sidebar.soilType')}: {t(
          status === 'loading' ? 'common.loading' : status === 'cached' ? 'soilSensor.cachedData' : 'common.notAvailable'
        )}</p>
      ))}
      <button type="button" onClick={reloadCatalog} disabled={Object.values(catalogStatus).includes('loading')}>
        {t('common.retry')}
      </button>
    </div>
  ) : null;

  if (sessionLoading) {
    return (
      <div className="app-loading">
        <div className="spinner h-12 w-12 mx-auto mb-4" />
        <p>{t('common.loading') || 'Loading...'}</p>
      </div>
    );
  }

  if (!isRegistered && !isGuest && currentPage === 'main') {
    return <LandingPage onRegister={() => navigateTo('register')} onExplore={handleSkipRegistration} onNavigate={navigateTo} />;
  }

  if (currentPage === 'privacy') return <PrivacyPolicy onBack={() => navigateTo('main')} />;
  if (currentPage === 'terms') return <TermsOfService onBack={() => navigateTo('main')} />;
  if (currentPage === 'msp') return <MSPFullView onBack={() => navigateTo('main')} />;
  if (currentPage === 'register') {
    return <>{catalogNotice}<FarmerRegistrationForm crops={crops} onComplete={handleRegistrationComplete} onSkip={isRegistered || isGuest ? () => navigateTo('main') : handleSkipRegistration} /></>;
  }

  const tabs = [
    { id: 'dashboard', icon: BarChart3, label: t('nav.dashboard') },
    { id: 'comparison', icon: TrendingUp, label: t('nav.scenarios'), disabled: !simulationData },
    { id: 'recommendations', icon: Lightbulb, label: t('nav.aiInsights'), disabled: !simulationData },
    { id: 'market', icon: Store, label: t('nav.market') || 'Market' },
    { id: 'health', icon: Leaf, label: t('nav.cropHealth') }
  ];

  const renderSidebar = (hideTitle = false) => (
    <Sidebar
      formData={formData}
      setFormData={setFormData}
      crops={crops}
      soilTypes={soilTypes}
      onSimulate={runSimulation}
      loading={loading}
      hideTitle={hideTitle}
      onOpenVoice={() => { setMobileInputsOpen(false); setVoiceOpen(true); }}
    />
  );

  return (
    <div className="app-shell">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <LoadingOverlay isLoading={loading} />

      <header className="app-header">
        <div className="app-header__inner">
          <button className="brand-lockup" onClick={() => selectTab('dashboard')} aria-label={t('app.name')}>
            <img src="/krishyak_logo.png" alt="" className="brand-logo" />
            <span className="brand-copy">
              <strong>{t('app.name')}</strong>
              <small>{t('app.tagline')}</small>
            </span>
          </button>

          <div className="header-actions">
            {farmer?.village || farmer?.district ? (
              <div className="location-chip">
                <MapPin aria-hidden="true" />
                <span>{farmer.village || farmer.district}</span>
              </div>
            ) : null}
            {isOffline ? (
              <div className="offline-chip" role="status">
                <WifiOff aria-hidden="true" />
                <span>{t('soilSensor.cachedData')}</span>
              </div>
            ) : null}
            <LanguageSelector />

            <div className="profile-area" ref={profileRef}>
              <button
                type="button"
                className={`profile-trigger ${!isRegistered ? 'profile-trigger--register' : ''}`}
                onClick={handleProfileClick}
                aria-expanded={isRegistered ? profileOpen : undefined}
              >
                <UserRound aria-hidden="true" />
                <span>{isRegistered ? farmer?.fullName?.split(' ')[0] : t('registration.submit')}</span>
                {isRegistered ? <ChevronDown aria-hidden="true" /> : null}
              </button>

              {isRegistered && profileOpen ? (
                <div className="profile-menu">
                  <div className="profile-menu__identity">
                    <span className="profile-avatar"><UserRound aria-hidden="true" /></span>
                    <div>
                      <strong>{farmer?.fullName}</strong>
                      {farmer?.primaryCrop ? <span>{farmer.primaryCrop}</span> : null}
                    </div>
                  </div>
                  <dl className="profile-details">
                    {farmer?.village || farmer?.district ? (
                      <div><dt>{t('registration.village')}</dt><dd>{farmer.village || farmer.district}</dd></div>
                    ) : null}
                    {farmer?.totalLandArea ? (
                      <div><dt>{t('registration.totalLandArea')}</dt><dd>{farmer.totalLandArea} {farmer.landUnit}</dd></div>
                    ) : null}
                  </dl>
                  <button type="button" className="profile-menu__logout" onClick={handleLogout}>
                    <LogOut aria-hidden="true" />
                    {t('common.logout') || 'Logout'}
                  </button>
                </div>
              ) : null}
            </div>

          </div>
        </div>
      </header>

      <nav className="primary-nav" aria-label={t('accessibility.primaryNavigation')}>
        <div className="primary-nav__inner">
          {tabs.map(tab => (
            <TabButton
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => selectTab(tab.id)}
              disabled={tab.disabled}
            />
          ))}
        </div>
      </nav>

      <main className="app-content">
        <div className="workspace-intro"><div><p className="field-eyebrow"><Leaf size={15} aria-hidden="true" />{t('landing.workspaceEyebrow')}</p><h1>{tabs.find(tab => tab.id === activeTab)?.label}</h1><p>{t('landing.workspaceCopy')}</p></div><span className="workspace-crop"><Leaf size={18} aria-hidden="true" />{t(`crops.${formData.crop.toLowerCase()}`)}</span></div>
        <div className="speech-toolbar">
          <button type="button" className="voice-mode-button" onClick={() => setVoiceOpen(true)} aria-haspopup="dialog" aria-expanded={voiceOpen}>
            <Mic size={20} aria-hidden="true" />{t('voice.title')}
          </button>
          <SpeakButton getText={visiblePageText} resetKey={activeTab} className="speech-toolbar__reading" />
        </div>
        {catalogNotice}
        <div className="workspace-grid">
          <aside className="desktop-inputs" aria-label={t('sidebar.title')}>{renderSidebar()}</aside>

          <section className="workspace-main">
            {activeTab === 'dashboard' ? (
              <Dashboard simulationData={simulationData} formData={formData} farmer={farmer} crops={crops} />
            ) : null}
            {activeTab === 'comparison' ? <ScenarioComparison comparisonData={comparisonData} /> : null}
            {activeTab === 'recommendations' ? (
              <RecommendationPanel
                recommendationData={recommendationData}
                simulationData={simulationData}
                formData={formData}
              />
            ) : null}
            {activeTab === 'market' ? (
              <div className="page-stack">
                <div className="page-heading">
                  <div className="page-heading__icon"><Store aria-hidden="true" /></div>
                  <div>
                    <h1>{t('nav.market') || 'Market'}</h1>
                    <p>{[formData.crop ? (t(`crops.${formData.crop.toLowerCase()}`) || formData.crop) : null, farmer?.district, farmer?.state].filter(Boolean).join(' • ')}</p>
                  </div>
                </div>
                <MandiPriceCard
                  commodity={null}
                  state={farmer?.state || null}
                  district={farmer?.district || null}
                  maxItems={8}
                />
                <div className="market-support-grid">
                  <MSPRateCard
                    primaryCrop={formData.crop || simulationData?.crop}
                    currentMarketPrice={formData.current_market_price}
                  />
                  {simulationData?.price_forecast ? (
                    <PriceForecastChart forecastData={simulationData.price_forecast} />
                  ) : null}
                </div>
              </div>
            ) : null}
            {activeTab === 'health' ? <CropHealthCheck /> : null}
          </section>
        </div>
      </main>

      <FloatingActionButton onClick={() => setMobileInputsOpen(true)} />
      <VoiceInputModal isOpen={voiceOpen} onClose={() => setVoiceOpen(false)} onApply={parsed => setFormData(previous => ({ ...previous, ...parsed }))} />
      <BottomSheet isOpen={mobileInputsOpen} onClose={() => setMobileInputsOpen(false)} title={t('sidebar.title') || 'Farm Inputs'}>
        {renderSidebar(true)}
      </BottomSheet>

      <nav className="mobile-bottom-nav" aria-label={t('accessibility.mobileNavigation')}>
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => selectTab(tab.id)}
            disabled={tab.disabled}
            compact
          />
        ))}
      </nav>

      <footer className="app-footer">
        <div>
          <p><strong>{t('app.name')}</strong> - {t('footer.tagline')}</p>
          <div className="footer-links">
            <button onClick={() => navigateTo('msp')}><TrendingUp />{t('msp.allRates')}</button>
            <button onClick={() => navigateTo('privacy')}><Shield />{t('privacy.title')}</button>
            <button onClick={() => navigateTo('terms')}><FileText />{t('terms.title')}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

const TabButton = ({ icon: Icon, label, active, onClick, disabled, compact = false }) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    className={`nav-item ${active ? 'nav-item--active' : ''} ${disabled ? 'nav-item--disabled' : ''} ${compact ? 'nav-item--compact' : ''}`}
    disabled={disabled}
    aria-current={active ? 'page' : undefined}
  >
    <Icon aria-hidden="true" />
    <span>{label}</span>
  </button>
);

export default App;

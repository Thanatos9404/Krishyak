import React, { useState, useEffect } from 'react';
import { BarChart3, Lightbulb, TrendingUp, Leaf } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ScenarioComparison from './components/ScenarioComparison';
import RecommendationPanel from './components/RecommendationPanel';
import CropHealthCheck from './components/CropHealthCheck';
import LoadingOverlay from './components/LoadingOverlay';
import FloatingActionButton from './components/FloatingActionButton';
import BottomSheet from './components/BottomSheet';
import { useToast, ToastContainer } from './components/Toast';
import LanguageSelector from './components/LanguageSelector';
import { useTranslation } from './i18n';
import farmingApi from './api/farmingApi';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [crops, setCrops] = useState([]);
  const [soilTypes, setSoilTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simulationData, setSimulationData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [mobileInputsOpen, setMobileInputsOpen] = useState(false);
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

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [cropsRes, soilsRes] = await Promise.all([
        farmingApi.getCrops(),
        farmingApi.getSoilTypes()
      ]);
      setCrops(cropsRes.crops || []);
      setSoilTypes(soilsRes.soil_types || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setCrops(['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane']);
      setSoilTypes(['Alluvial', 'Black', 'Red', 'Laterite', 'Desert']);
    }
  };

  const runSimulation = async () => {
    setLoading(true);
    setMobileInputsOpen(false);

    try {
      const [simRes, compRes, recRes] = await Promise.all([
        farmingApi.simulate(formData, 500),
        farmingApi.compareScenarios(formData, 500),
        farmingApi.getRecommendations(formData)
      ]);

      setSimulationData(simRes.data);
      setComparisonData(compRes.data);
      setRecommendationData(recRes.data);
      setActiveTab('dashboard');

      const profitImprovement = recRes.data.profit_improvement || 0;
      addToast({
        type: 'success',
        message: '✅ Analysis Complete!',
        profitImprovement: profitImprovement,
        actionText: 'View Recommendations',
        onAction: () => setActiveTab('recommendations')
      });

    } catch (error) {
      console.error('Simulation error:', error);
      addToast({
        type: 'error',
        message: 'Failed to run simulation. Please check if backend is running.',
        actionText: 'Retry',
        onAction: runSimulation
      });
    } finally {
      setLoading(false);
    }
  };

  const SidebarContent = () => (
    <Sidebar
      formData={formData}
      setFormData={setFormData}
      crops={crops}
      soilTypes={soilTypes}
      onSimulate={runSimulation}
      loading={loading}
    />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-farm-green-50 via-earth-brown-50 to-sky-blue-50">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <LoadingOverlay isLoading={loading} />

      {/* Header */}
      <header className="bg-gradient-to-r from-farm-green-600 via-farm-green-500 to-farm-green-400 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/krishyak_logo.png" alt="Krishyak Logo" className="w-14 h-14 sm:w-16 sm:h-16 mr-3 sm:mr-4 rounded-lg" />
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-white">{t('app.name')}</h1>
                <p className="text-xs sm:text-sm text-green-100">{t('app.tagline')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="hidden md:block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                <p className="text-xs text-white font-semibold">
                  {t('app.subtitle')}
                </p>
              </div>
              <LanguageSelector />
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-2 sm:px-6">
          <div className="flex overflow-x-auto scrollbar-hide">
            <TabButton icon={BarChart3} label={t('nav.dashboard')} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <TabButton icon={TrendingUp} label={t('nav.scenarios')} active={activeTab === 'comparison'} onClick={() => setActiveTab('comparison')} />
            <TabButton icon={Lightbulb} label={t('nav.aiInsights')} active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')} />
            <TabButton icon={Leaf} label={t('nav.cropHealth')} active={activeTab === 'health'} onClick={() => setActiveTab('health')} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <SidebarContent />
          </div>

          <div className="flex-1">
            {activeTab === 'dashboard' && <Dashboard simulationData={simulationData} />}
            {activeTab === 'comparison' && <ScenarioComparison comparisonData={comparisonData} />}
            {activeTab === 'recommendations' && (
              <RecommendationPanel
                recommendationData={recommendationData}
                simulationData={simulationData}
                formData={formData}
              />
            )}
            {activeTab === 'health' && <CropHealthCheck />}
          </div>
        </div>
      </div>

      <FloatingActionButton onClick={() => setMobileInputsOpen(true)} />

      <BottomSheet isOpen={mobileInputsOpen} onClose={() => setMobileInputsOpen(false)} title="Farm Inputs">
        <SidebarContent />
      </BottomSheet>

      {/* Footer */}
      <footer className="bg-white border-t-2 border-farm-green-100 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="text-center text-gray-600 text-sm">
            <p className="mb-2">
              <span className="font-semibold text-farm-green-600">Krishyak</span> - Empowering Indian farmers with AI-driven decision support
            </p>
            <p className="text-xs text-gray-500">
              Built with React, FastAPI, and advanced ML models • Data-driven insights for sustainable farming
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const TabButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3 sm:px-6 py-3 sm:py-4 font-semibold transition-all duration-300 border-b-4 whitespace-nowrap ${active
      ? 'border-farm-green-500 text-farm-green-600 bg-farm-green-50'
      : 'border-transparent text-gray-600 hover:text-farm-green-600 hover:bg-gray-50'
      }`}
  >
    <Icon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
    <span className="text-sm sm:text-base">{label}</span>
  </button>
);

export default App;

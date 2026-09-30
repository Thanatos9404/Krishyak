import React, { useState } from 'react';
import { Info, Mic, Sprout } from 'lucide-react';
import AccordionSection from './AccordionSection';
import WeatherCard from './WeatherCard';
import VoiceInputModal from './VoiceInputModal';
import SoilDataCard from './SoilDataCard';
import { useTranslation } from '../i18n';

const Sidebar = ({ formData, setFormData, crops, soilTypes, onSimulate, loading, hideTitle = false }) => {
  const { t } = useTranslation();
  const soilTranslationKey = (soil) => soil.toLowerCase().includes('sandy') ? 'sandy' : soil.toLowerCase();
  // Accordion state - Basic Information is expanded by default
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    soil: false,
    weather: false,
    fertilizer: false,
    irrigation: false,
    market: false
  });

  // Voice input modal state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFertilizerChange = (fertilizer, value) => {
    setFormData(prev => ({
      ...prev,
      fertilizer_mix: {
        ...prev.fertilizer_mix,
        [fertilizer]: parseFloat(value) || 0
      }
    }));
  };

  const handleVoiceApply = (parsedData) => {
    setFormData(prev => ({
      ...prev,
      ...parsedData
    }));
  };

  const handleWeatherUpdate = (weatherData) => {
    setFormData(prev => {
      const updates = { ...prev };
      for (const field of ['expected_rainfall', 'rainfall_delay']) {
        const value = weatherData[field];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) updates[field] = value;
      }
      if (weatherData.soil_source === 'verified_soil_record' && soilTypes.includes(weatherData.soil_type)) {
        updates.soil_type = weatherData.soil_type;
      }
      return updates;
    });
    // Auto-expand weather section to show updated values
    setExpandedSections(prev => ({ ...prev, weather: true }));
  };

  return (
    <>
      <div className="sidebar-panel w-full bg-white rounded-2xl flex flex-col lg:max-h-[calc(100vh-160px)] lg:sticky lg:top-20">
        {/* Header */}
        <div className="text-center p-4 sm:p-6 border-b-2 border-farm-green-100 flex-shrink-0">
          {!hideTitle ? (
            <>
              <div className="flex items-center justify-center mb-2">
                <Sprout className="w-8 h-8 text-farm-green-600 mr-2" />
                <h2 className="text-2xl font-bold text-farm-green-800">{t('sidebar.title')}</h2>
              </div>
              <p className="text-sm text-gray-600">{t('sidebar.configureParams') || 'Configure your farming parameters'}</p>
            </>
          ) : null}

          {/* Voice Input Button */}
          <button
            onClick={() => setVoiceModalOpen(true)}
            className="mt-3 flex items-center justify-center w-full bg-blue-800 text-white py-2.5 px-4 rounded-xl hover:bg-blue-900 transition-colors duration-150"
          >
            <Mic className="w-4 h-4 mr-2" />
            <span className="text-sm font-semibold">{t('voice.title')}</span>
          </button>
        </div>

        {/* Scrollable Accordion Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Basic Information Section */}
          <AccordionSection
            title={t('sidebar.basicInfo') || 'Basic Information'}
            icon={null}
            isExpanded={expandedSections.basic}
            onToggle={() => toggleSection('basic')}
          >
            {/* Crop Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">{t('sidebar.cropType') || 'Crop Type'}</label>
              <select
                value={formData.crop}
                onChange={(e) => handleChange('crop', e.target.value)}
                className="input-farm"
              >
                <option value="">{t('sidebar.selectCrop')}</option>
                {crops.map(crop => (
                  <option key={crop} value={crop}>{t(`crops.${crop.toLowerCase()}`) || crop}</option>
                ))}
              </select>
            </div>

            {/* Soil Type */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">{t('sidebar.soilType')}</label>
              <select
                value={formData.soil_type}
                onChange={(e) => handleChange('soil_type', e.target.value)}
                className="input-farm"
              >
                <option value="">{t('sidebar.selectSoil')}</option>
                {soilTypes.map(soil => (
                  <option key={soil} value={soil}>{t(`soils.${soilTranslationKey(soil)}`) || soil}</option>
                ))}
              </select>
            </div>

            {/* Area */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.farmArea')} ({t('units.hectares')})
              </label>
              <input
                type="number"
                value={formData.area_hectares}
                onChange={(e) => handleChange('area_hectares', parseFloat(e.target.value))}
                min="0.1"
                step="0.1"
                className="input-farm"
              />
            </div>
          </AccordionSection>

          {/* Soil Sensor Data Section */}
          <AccordionSection
            title={t('soilSensor.title') || 'Soil Sensor Data'}
            icon={null}
            isExpanded={expandedSections.soil}
            onToggle={() => toggleSection('soil')}
          >
            <SoilDataCard
              deviceId="default"
              onDataUpdate={(data) => {
                // Update fertilizer recommendations based on soil data
                if (data && data.nitrogen !== undefined) {
                  // Could auto-adjust fertilizer mix based on soil NPK
                  console.log('Soil data updated:', data);
                }
              }}
            />
          </AccordionSection>

          {/* Weather Conditions Section */}
          <AccordionSection
            title={t('sidebar.weatherConditions') || 'Weather Conditions'}
            icon={null}
            isExpanded={expandedSections.weather}
            onToggle={() => toggleSection('weather')}
          >
            {/* Weather Card with Location Detection */}
            <WeatherCard onWeatherUpdate={handleWeatherUpdate} />

            {/* Rainfall */}
            <div className="space-y-2 mt-4">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.rainfall') || 'Expected Rainfall (mm)'}
              </label>
              <input
                type="number"
                value={formData.expected_rainfall}
                onChange={(e) => handleChange('expected_rainfall', parseFloat(e.target.value))}
                min="0"
                className="input-farm"
              />
            </div>

            {/* Rainfall Delay */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.monsoonDelay') || 'Monsoon Delay (days)'}
              </label>
              <input
                type="number"
                value={formData.rainfall_delay}
                onChange={(e) => handleChange('rainfall_delay', parseInt(e.target.value))}
                min="0"
                className="input-farm"
              />
            </div>

            {/* Seed Quality */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.seedQuality') || 'Seed Quality'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 0.4, labelKey: 'sidebar.poor', label: 'Poor', color: 'bg-red-100 border-red-300 text-red-700' },
                  { value: 0.6, labelKey: 'sidebar.fair', label: 'Fair', color: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
                  { value: 0.8, labelKey: 'sidebar.good', label: 'Good', color: 'bg-green-100 border-green-300 text-green-700' },
                  { value: 0.95, labelKey: 'sidebar.premium', label: 'Premium', color: 'bg-blue-100 border-blue-300 text-blue-700' }
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChange('seed_quality', option.value);
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-lg border-2 transition-all ${formData.seed_quality === option.value
                      ? option.color + ' ring-2 ring-offset-1 ring-gray-400'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {t(option.labelKey) || option.label}
                  </button>
                ))}
              </div>
            </div>
          </AccordionSection>

          {/* Fertilizer Mix Section */}
          <AccordionSection
            title={t('sidebar.fertilizerMix') || 'Fertilizer Mix (kg/ha)'}
            icon={null}
            isExpanded={expandedSections.fertilizer}
            onToggle={() => toggleSection('fertilizer')}
          >
            <div className="bg-farm-green-50 rounded-xl p-4 space-y-3">
              {[
                { name: 'Urea', labelKey: 'fertilizer.products.urea', tooltipKey: 'fertilizer.tooltips.urea' },
                { name: 'DAP', labelKey: 'fertilizer.products.dap', tooltipKey: 'fertilizer.tooltips.dap' },
                { name: 'MOP', labelKey: 'fertilizer.products.mop', tooltipKey: 'fertilizer.tooltips.mop' },
                { name: 'NPK', labelKey: 'fertilizer.products.npk', tooltipKey: 'fertilizer.tooltips.npk' },
                { name: 'Organic', labelKey: 'fertilizer.products.organic', tooltipKey: 'fertilizer.tooltips.organic' }
              ].map(fert => (
                <div key={fert.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-700 font-medium">{t(fert.labelKey)}</span>
                    <div className="relative group ml-2">
                      <Info className="w-4 h-4 text-gray-400 cursor-help" aria-label={t('common.information')} />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg px-3 py-2 w-48 z-50 shadow-lg">
                        {t(fert.tooltipKey)}
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={formData.fertilizer_mix[fert.name] || 0}
                    onChange={(e) => handleFertilizerChange(fert.name, e.target.value)}
                    min="0"
                    className="w-24 px-3 py-2 border-2 border-farm-green-200 rounded-lg focus:border-farm-green-500 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* Irrigation & Pest Control Section */}
          <AccordionSection
            title={t('sidebar.irrigationPest') || 'Irrigation & Pest Control'}
            icon={null}
            isExpanded={expandedSections.irrigation}
            onToggle={() => toggleSection('irrigation')}
          >
            {/* Irrigation */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.irrigationFrequency') || 'Irrigation Frequency (per month)'}
              </label>
              <input
                type="number"
                value={formData.irrigation_frequency}
                onChange={(e) => handleChange('irrigation_frequency', parseInt(e.target.value))}
                min="0"
                className="input-farm"
              />
            </div>

            {/* Pest Probability */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.pestRisk')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 0.1, labelKey: 'risk.levels.low', color: 'bg-green-100 border-green-300 text-green-700' },
                  { value: 0.3, labelKey: 'risk.levels.moderate', color: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
                  { value: 0.5, labelKey: 'risk.levels.high', color: 'bg-orange-100 border-orange-300 text-orange-700' },
                  { value: 0.7, labelKey: 'risk.levels.severe', color: 'bg-red-100 border-red-300 text-red-700' }
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChange('pest_probability', option.value);
                    }}
                    className={`py-2 px-2 text-xs font-medium rounded-lg border-2 transition-all ${formData.pest_probability === option.value
                      ? option.color + ' ring-2 ring-offset-1 ring-gray-400'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </AccordionSection>

          {/* Market Information Section */}
          <AccordionSection
            title={t('sidebar.marketInfo') || 'Market Information'}
            icon={null}
            isExpanded={expandedSections.market}
            onToggle={() => toggleSection('market')}
          >
            {/* Market Price */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.marketPrice') || 'Current Market Price'} (₹/{t('units.quintal') || 'quintal'})
              </label>
              <input
                type="number"
                value={formData.current_market_price}
                onChange={(e) => handleChange('current_market_price', parseFloat(e.target.value))}
                min="0"
                className="input-farm"
              />
            </div>

            {/* Sale Month */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('sidebar.saleMonth') || 'Planned Sale Month'}
              </label>
              <select
                value={formData.sale_month}
                onChange={(e) => handleChange('sale_month', parseInt(e.target.value))}
                className="input-farm"
              >
                <option value="0">{t('sidebar.immediate') || 'Immediate'}</option>
                <option value="1">1 {t('sidebar.month') || 'Month'}</option>
                <option value="2">2 {t('sidebar.months') || 'Months'}</option>
                <option value="3">3 {t('sidebar.months') || 'Months'}</option>
                <option value="4">4 {t('sidebar.months') || 'Months'}</option>
                <option value="5">5 {t('sidebar.months') || 'Months'}</option>
                <option value="6">6 {t('sidebar.months') || 'Months'}</option>
                <option value="7">7 {t('sidebar.months') || 'Months'}</option>
                <option value="8">8 {t('sidebar.months') || 'Months'}</option>
                <option value="9">9 {t('sidebar.months') || 'Months'}</option>
                <option value="10">10 {t('sidebar.months') || 'Months'}</option>
                <option value="11">11 {t('sidebar.months') || 'Months'}</option>
                <option value="12">12 {t('sidebar.months') || 'Months'}</option>
              </select>
            </div>
          </AccordionSection>
        </div>

        {/* Sticky Simulate Button */}
        <div className="p-3 sm:p-4 border-t-2 border-farm-green-100 bg-white flex-shrink-0 rounded-b-2xl">
          <button
            onClick={onSimulate}
            disabled={loading}
            className="w-full py-4 text-lg font-bold flex items-center justify-center bg-farm-green-700 text-white rounded-xl hover:bg-farm-green-800 transition-colors duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                {t('sidebar.analyzing')}
              </div>
            ) : (
              <>
                <Sprout className="w-6 h-6 mr-2" />
                {t('sidebar.runSimulation')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Voice Input Modal */}
      <VoiceInputModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onApply={handleVoiceApply}
        currentFormData={formData}
      />
    </>
  );
};

export default Sidebar;

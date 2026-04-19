import React, { useState, useEffect, useCallback, memo } from 'react';
import { User, MapPin, Landmark, Wheat, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useTranslation } from '../i18n';
import { indianStates, getDistrictsByState, getTehsilsByDistrict } from '../data/indianStates';
import { useFormValidation } from '../hooks/useFormValidation';
import { useFarmerSession } from '../hooks/useFarmerSession';
import farmingApi from '../api/farmingApi';

const INITIAL_FORM_DATA = {
  // Step 1: Personal Info
  fullName: '',
  fatherName: '',
  mobileNumber: '',
  dateOfBirth: '',
  aadhaarNumber: '',
  // Step 2: Location
  state: '',
  district: '',
  tehsil: '',
  village: '',
  pinCode: '',
  // Step 3: Land Details
  khasraNumber: '',
  totalLandArea: '',
  landUnit: 'hectares',
  irrigatedLand: '',
  rainfedLand: '',
  ownershipType: '',
  // Step 4: Farming Info
  primaryCrop: '',
  secondaryCrops: [],
  farmingType: '',
  experience: '',
  consentData: false,
  consentTerms: false
};

const CROPS = [
  'Rice', 'Wheat', 'Maize', 'Barley', 'Bajra', 'Jowar', 'Ragi',
  'Tur', 'Gram', 'Urad', 'Moong', 'Lentil', 'Chickpea',
  'Groundnut', 'Soybean', 'Sunflower', 'Mustard', 'Sesame',
  'Cotton', 'Sugarcane', 'Jute', 'Tobacco',
  'Potato', 'Onion', 'Tomato', 'Brinjal', 'Cabbage', 'Cauliflower',
  'Okra', 'Carrot', 'Green Peas', 'Spinach', 'Chilli', 'Garlic',
  'Ginger', 'Coriander', 'Capsicum', 'Cucumber', 'Pumpkin', 'Radish',
  'Mango', 'Banana', 'Grapes', 'Pomegranate', 'Orange', 'Guava',
  'Papaya', 'Apple', 'Watermelon', 'Lemon', 'Coconut', 'Litchi',
  'Turmeric', 'Cumin', 'Fenugreek', 'Black Pepper', 'Cardamom'
];

// Input components defined OUTSIDE main component to prevent re-creation
const InputField = memo(({ label, field, type = 'text', required = false, placeholder, maxLength, pattern, value, onChange, error }) => (
  <div className="space-y-1">
    <label className="block text-sm font-semibold text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        pattern={pattern}
        className={`w-full px-4 py-3 border-2 rounded-xl text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-farm-green-200 ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-farm-green-500'
          }`}
        style={{ fontSize: '16px' }}
      />
    </div>
    {error && (
      <p className="text-sm text-red-500 mt-1">{error}</p>
    )}
  </div>
));

const SelectField = memo(({ label, field, options, required = false, placeholder, value, onChange, error, t }) => (
  <div className="space-y-1">
    <label className="block text-sm font-semibold text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(field, e.target.value)}
      className={`w-full px-4 py-3 border-2 rounded-xl text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-farm-green-200 ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-farm-green-500'
        }`}
      style={{ fontSize: '16px' }}
    >
      <option value="">{placeholder || (t && t('common.select')) || 'Select...'}</option>
      {options.map(opt => (
        <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
    {error && (
      <p className="text-sm text-red-500 mt-1">{error}</p>
    )}
  </div>
));

const FarmerRegistrationForm = ({ onComplete, onSkip }) => {
  const { t } = useTranslation();
  const { login, saveDraft, loadDraft, clearDraft } = useFarmerSession();
  const { errors, validateStep, clearFieldError } = useFormValidation();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [districts, setDistricts] = useState([]);
  const [tehsils, setTehsils] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastLoadedState, setLastLoadedState] = useState('');
  const [lastLoadedDistrict, setLastLoadedDistrict] = useState('');

  // Load draft on mount - only once
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setFormData(prev => ({ ...prev, ...draft }));
      if (draft.state) {
        const dists = getDistrictsByState(draft.state);
        setDistricts(dists);
        setLastLoadedState(draft.state);
        if (draft.district) {
          const tehs = getTehsilsByDistrict(draft.state, draft.district);
          setTehsils(tehs);
          setLastLoadedDistrict(draft.district);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft on form change
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraft(formData);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [formData, saveDraft]);

  // Handle state change - update districts
  const handleStateChange = useCallback((newState) => {
    if (newState !== lastLoadedState) {
      const newDistricts = getDistrictsByState(newState);
      setDistricts(newDistricts);
      setTehsils([]);
      setFormData(prev => ({ ...prev, state: newState, district: '', tehsil: '' }));
      setLastLoadedState(newState);
      setLastLoadedDistrict('');
    }
  }, [lastLoadedState]);

  // Handle district change - update tehsils
  const handleDistrictChange = useCallback((newDistrict) => {
    if (newDistrict !== lastLoadedDistrict && formData.state) {
      const newTehsils = getTehsilsByDistrict(formData.state, newDistrict);
      setTehsils(newTehsils);
      setFormData(prev => ({ ...prev, district: newDistrict, tehsil: '' }));
      setLastLoadedDistrict(newDistrict);
    }
  }, [formData.state, lastLoadedDistrict]);

  const handleChange = useCallback((field, value) => {
    // Special handling for state and district to manage cascading
    if (field === 'state') {
      handleStateChange(value);
      return;
    }
    if (field === 'district') {
      handleDistrictChange(value);
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
    clearFieldError(field);
  }, [clearFieldError, handleStateChange, handleDistrictChange]);

  const handleNext = () => {
    if (validateStep(currentStep, formData)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(4, formData)) return;

    setIsSubmitting(true);
    try {
      // Add registration timestamp
      const registrationData = {
        ...formData,
        registeredAt: new Date().toISOString()
      };

      // Call backend to save to CSV (non-blocking, fire and forget)
      farmingApi.registerFarmer(registrationData).catch(err => {
        console.warn('Backend registration failed (CSV not saved):', err);
      });

      // Call login to save session locally
      const farmerProfile = login(registrationData);
      // Clear the draft after successful registration
      clearDraft();

      // Small delay to ensure state is saved and UI updates
      await new Promise(resolve => setTimeout(resolve, 200));

      // Call onComplete callback to redirect to dashboard
      if (onComplete) {
        onComplete(farmerProfile);
      }
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, icon: User, titleKey: 'registration.step1Title', title: 'Personal Information' },
    { number: 2, icon: MapPin, titleKey: 'registration.step2Title', title: 'Location Details' },
    { number: 3, icon: Landmark, titleKey: 'registration.step3Title', title: 'Land Details' },
    { number: 4, icon: Wheat, titleKey: 'registration.step4Title', title: 'Farming Information' }
  ];

  const renderProgressStepper = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${currentStep > step.number
                ? 'bg-green-500 text-white'
                : currentStep === step.number
                  ? 'bg-farm-green-600 text-white ring-4 ring-farm-green-200'
                  : 'bg-gray-200 text-gray-500'
                }`}>
                {currentStep > step.number ? (
                  <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <step.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>
              <span className={`mt-2 text-xs sm:text-sm font-medium text-center hidden sm:block ${currentStep >= step.number ? 'text-farm-green-700' : 'text-gray-400'
                }`}>
                {t(step.titleKey) || step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 rounded ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                }`} />
            )}
          </React.Fragment>
        ))}
      </div>
      <p className="text-center mt-4 text-sm text-gray-600 sm:hidden">
        {t('registration.stepOf', { current: currentStep, total: 4 }) || `Step ${currentStep} of 4`}
      </p>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <User className="w-6 h-6 mr-2 text-farm-green-600" />
        {t('registration.step1Title') || 'Personal Information'}
      </h3>

      <InputField
        label={t('registration.fullName') || 'Full Name (पूरा नाम)'}
        field="fullName"
        required
        placeholder={t('registration.fullNamePlaceholder') || 'Enter your full name'}
        value={formData.fullName}
        onChange={handleChange}
        error={errors.fullName}
      />

      <InputField
        label={t('registration.fatherName') || "Father's/Husband's Name (पिता/पति का नाम)"}
        field="fatherName"
        required
        placeholder={t('registration.fatherNamePlaceholder') || "Enter father's or husband's name"}
        value={formData.fatherName}
        onChange={handleChange}
        error={errors.fatherName}
      />

      <InputField
        label={t('registration.mobileNumber') || 'Mobile Number (मोबाइल नंबर)'}
        field="mobileNumber"
        type="tel"
        required
        placeholder="9876543210"
        maxLength={10}
        value={formData.mobileNumber}
        onChange={handleChange}
        error={errors.mobileNumber}
      />

      <InputField
        label={t('registration.dateOfBirth') || 'Date of Birth (जन्म तिथि)'}
        field="dateOfBirth"
        type="date"
        value={formData.dateOfBirth}
        onChange={handleChange}
        error={errors.dateOfBirth}
      />

      {/* Optional Aadhaar Section */}
      <div className="mt-2 pt-4 border-t border-dashed border-gray-200">
        <p className="text-xs text-gray-500 mb-3 flex items-center">
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium mr-2">Optional</span>
          You can verify your Aadhaar later from your profile
        </p>
        <InputField
          label={(t('registration.aadhaarNumber') || 'Aadhaar Number (आधार संख्या)') + ' — Optional'}
          field="aadhaarNumber"
          placeholder="XXXX XXXX XXXX"
          maxLength={14}
          value={formData.aadhaarNumber}
          onChange={handleChange}
          error={errors.aadhaarNumber}
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <MapPin className="w-6 h-6 mr-2 text-farm-green-600" />
        {t('registration.step2Title') || 'Location Details'}
      </h3>

      <SelectField
        label={t('registration.state') || 'State (राज्य)'}
        field="state"
        required
        options={indianStates.map(s => ({ value: s.name, label: s.name }))}
        placeholder={t('registration.selectState') || 'Select State'}
        value={formData.state}
        onChange={handleChange}
        error={errors.state}
        t={t}
      />

      <SelectField
        label={t('registration.district') || 'District (जिला)'}
        field="district"
        required
        options={districts.map(d => ({ value: d.name, label: d.name }))}
        placeholder={t('registration.selectDistrict') || 'Select District'}
        value={formData.district}
        onChange={handleChange}
        error={errors.district}
        t={t}
      />

      <SelectField
        label={t('registration.tehsil') || 'Tehsil/Block (तहसील/ब्लॉक)'}
        field="tehsil"
        required
        options={tehsils}
        placeholder={t('registration.selectTehsil') || 'Select Tehsil'}
        value={formData.tehsil}
        onChange={handleChange}
        error={errors.tehsil}
        t={t}
      />

      <InputField
        label={t('registration.village') || 'Village (गाँव)'}
        field="village"
        required
        placeholder={t('registration.villagePlaceholder') || 'Enter village name'}
        value={formData.village}
        onChange={handleChange}
        error={errors.village}
      />

      <InputField
        label={t('registration.pinCode') || 'PIN Code (पिन कोड)'}
        field="pinCode"
        required
        placeholder="123456"
        maxLength={6}
        value={formData.pinCode}
        onChange={handleChange}
        error={errors.pinCode}
      />
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Landmark className="w-6 h-6 mr-2 text-farm-green-600" />
        {t('registration.step3Title') || 'Land Details'}
      </h3>

      <InputField
        label={t('registration.khasraNumber') || 'Khasra/Survey Number (खसरा संख्या)'}
        field="khasraNumber"
        required
        placeholder={t('registration.khasraPlaceholder') || 'Enter Khasra number'}
        value={formData.khasraNumber}
        onChange={handleChange}
        error={errors.khasraNumber}
      />

      <div className="space-y-1">
        <label className="block text-sm font-semibold text-gray-700">
          {t('registration.totalLandArea') || 'Total Land Area'} <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={formData.totalLandArea}
            onChange={(e) => handleChange('totalLandArea', e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            className={`flex-1 px-4 py-3 border-2 rounded-xl text-base ${errors.totalLandArea ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-farm-green-500'
              }`}
            style={{ fontSize: '16px' }}
          />
          <select
            value={formData.landUnit}
            onChange={(e) => handleChange('landUnit', e.target.value)}
            className="px-4 py-3 border-2 border-gray-200 rounded-xl"
          >
            <option value="hectares">{t('units.hectares') || 'Hectares'}</option>
            <option value="acres">{t('units.acres') || 'Acres'}</option>
          </select>
        </div>
        {errors.totalLandArea && <p className="text-sm text-red-500">{errors.totalLandArea}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InputField
          label={t('registration.irrigatedLand') || 'Irrigated Land'}
          field="irrigatedLand"
          type="number"
          placeholder="0.00"
          value={formData.irrigatedLand}
          onChange={handleChange}
          error={errors.irrigatedLand}
        />
        <InputField
          label={t('registration.rainfedLand') || 'Rain-fed Land'}
          field="rainfedLand"
          type="number"
          placeholder="0.00"
          value={formData.rainfedLand}
          onChange={handleChange}
          error={errors.rainfedLand}
        />
      </div>

      <SelectField
        label={t('registration.ownershipType') || 'Land Ownership Type'}
        field="ownershipType"
        required
        options={[
          { value: 'own', label: t('ownership.own') || 'Own' },
          { value: 'leased', label: t('ownership.leased') || 'Leased' },
          { value: 'shared', label: t('ownership.shared') || 'Shared' }
        ]}
        value={formData.ownershipType}
        onChange={handleChange}
        error={errors.ownershipType}
        t={t}
      />
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Wheat className="w-6 h-6 mr-2 text-farm-green-600" />
        {t('registration.step4Title') || 'Farming Information'}
      </h3>

      <SelectField
        label={t('registration.primaryCrop') || 'Primary Crop (मुख्य फसल)'}
        field="primaryCrop"
        required
        options={CROPS.map(c => ({ value: c, label: t(`crops.${c.toLowerCase()}`) || c }))}
        value={formData.primaryCrop}
        onChange={handleChange}
        error={errors.primaryCrop}
        t={t}
      />

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          {t('registration.farmingType') || 'Farming Type'} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'organic', label: t('farmingType.organic') || 'Organic', bgActive: 'bg-green-100', borderActive: 'border-green-500', textActive: 'text-green-700' },
            { value: 'conventional', label: t('farmingType.conventional') || 'Conventional', bgActive: 'bg-blue-100', borderActive: 'border-blue-500', textActive: 'text-blue-700' },
            { value: 'mixed', label: t('farmingType.mixed') || 'Mixed', bgActive: 'bg-purple-100', borderActive: 'border-purple-500', textActive: 'text-purple-700' }
          ].map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => handleChange('farmingType', type.value)}
              className={`py-3 px-4 rounded-xl font-medium transition-all duration-200 min-h-[48px] ${formData.farmingType === type.value
                ? `${type.bgActive} border-2 ${type.borderActive} ${type.textActive}`
                : 'bg-gray-100 border-2 border-gray-200 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        {errors.farmingType && <p className="text-sm text-red-500">{errors.farmingType}</p>}
      </div>

      <SelectField
        label={t('registration.experience') || 'Farming Experience'}
        field="experience"
        options={[
          { value: '0-5', label: t('experience.0-5') || '0-5 Years' },
          { value: '5-10', label: t('experience.5-10') || '5-10 Years' },
          { value: '10-20', label: t('experience.10-20') || '10-20 Years' },
          { value: '20+', label: t('experience.20+') || '20+ Years' }
        ]}
        value={formData.experience}
        onChange={handleChange}
        error={errors.experience}
        t={t}
      />

      {/* Consent Checkboxes */}
      <div className="space-y-3 mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <h4 className="font-semibold text-blue-800">{t('registration.consentTitle') || 'Terms & Consent'}</h4>

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.consentData}
            onChange={(e) => handleChange('consentData', e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-gray-300 text-farm-green-600 focus:ring-farm-green-500"
          />
          <span className="text-sm text-gray-700">
            {t('registration.consentData') || 'I consent to share my data with government departments for scheme eligibility'}
            <span className="text-red-500"> *</span>
          </span>
        </label>
        {errors.consentData && <p className="text-sm text-red-500 ml-8">{errors.consentData}</p>}

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.consentTerms}
            onChange={(e) => handleChange('consentTerms', e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-gray-300 text-farm-green-600 focus:ring-farm-green-500"
          />
          <span className="text-sm text-gray-700">
            {t('registration.consentTerms') || 'I agree to the'}{' '}
            <a href="/terms" className="text-farm-green-600 underline" target="_blank" rel="noopener noreferrer">
              {t('terms.title') || 'Terms of Service'}
            </a>{' '}
            {t('common.and') || 'and'}{' '}
            <a href="/privacy" className="text-farm-green-600 underline" target="_blank" rel="noopener noreferrer">
              {t('privacy.title') || 'Privacy Policy'}
            </a>
            <span className="text-red-500"> *</span>
          </span>
        </label>
        {errors.consentTerms && <p className="text-sm text-red-500 ml-8">{errors.consentTerms}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-farm-green-50 via-white to-sky-blue-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Branding Header */}
        <div className="flex items-center justify-center mb-6">
          <img
            src="/krishyak_logo.png"
            alt="Krishyak Logo"
            className="w-16 h-16 sm:w-20 sm:h-20 mr-4 rounded-xl shadow-md"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-farm-green-700">
              {t('app.name') || 'Krishyak'}
            </h1>
            <p className="text-sm text-gray-600">
              {t('app.tagline') || 'Data-Driven Farming Insights'}
            </p>
          </div>
        </div>

        {/* Registration Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            {t('registration.title') || 'Farmer Registration'}
          </h2>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            {t('registration.subtitle') || 'Join Krishyak to access government schemes and data-driven farming insights'}
          </p>
        </div>

        {/* Progress Stepper */}
        {renderProgressStepper()}

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={onSkip}
                className="flex items-center px-6 py-3 rounded-xl font-semibold transition-all min-h-[48px] text-farm-green-700 bg-farm-green-50 hover:bg-farm-green-100 border border-farm-green-200"
              >
                Skip for now
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrevious}
                className="flex items-center px-6 py-3 rounded-xl font-semibold transition-all min-h-[48px] bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                {t('registration.previous') || 'Previous'}
              </button>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center px-6 py-3 bg-farm-green-600 text-white rounded-xl font-semibold hover:bg-farm-green-700 transition-all min-h-[48px]"
              >
                {t('registration.next') || 'Next'}
                <ChevronRight className="w-5 h-5 ml-1" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center px-8 py-3 bg-gradient-to-r from-farm-green-500 to-farm-green-600 text-white rounded-xl font-semibold hover:from-farm-green-600 hover:to-farm-green-700 transition-all min-h-[48px] disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    {t('common.loading') || 'Processing...'}
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    {t('registration.submit') || 'Register'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Auto-save indicator */}
        <p className="text-center text-sm text-gray-500 mt-4">
          {t('registration.autoSave') || '💾 Your progress is automatically saved'}
        </p>
      </div>
    </div>
  );
};

export default FarmerRegistrationForm;

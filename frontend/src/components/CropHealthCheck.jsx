import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Camera, X, Loader2, AlertTriangle,
  CheckCircle, Leaf, Bug, Droplets, Shield,
  ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { useTranslation } from '../i18n';
import diseaseDatabase from '../data/diseaseDatabase.json';
import { API_BASE_URL as API_URL } from '../config/api';
import { parseDiseaseResponse } from '../utils/diseaseResponse';

/**
 * Crop Health Check Component
 * Allows users to upload plant images for disease detection
 */
const CropHealthCheck = () => {
  const { t, language } = useTranslation();
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showTreatment, setShowTreatment] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const operation = useRef(0);
  const activeRequest = useRef(null);
  const [capabilities, setCapabilities] = useState(null);
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const [capabilityLoading, setCapabilityLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let current = true;
    setCapabilityLoading(true);
    fetch(`${API_URL}/disease-capabilities`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (current) setCapabilities(data?.success && data.data?.model_available === true
          && Array.isArray(data.data.supported_crops)
          && data.data.supported_crops.every(crop => typeof crop === 'string' && /^[a-z_]+$/.test(crop))
          ? data.data : null);
      })
      .catch(() => { if (current) setCapabilities(null); })
      .finally(() => { clearTimeout(timeout); if (current) setCapabilityLoading(false); });
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [capabilityAttempt]);
  useEffect(() => () => { operation.current += 1; activeRequest.current?.abort(); }, []);
  const cropCatalog = [
    // Rice diseases
    { value: 'rice', label: 'Rice (धान)', diseases: ['Blast', 'Bacterial Blight', 'Brown Spot', 'Tungro'] },
    // Wheat diseases  
    { value: 'wheat', label: 'Wheat (गेहूं)', diseases: ['Yellow Rust', 'Brown Rust', 'Black Rust', 'Leaf Blight'] },
    // Cotton diseases
    { value: 'cotton', label: 'Cotton (कपास)', diseases: ['Leaf Curl', 'Bacterial Blight', 'Anthracnose', 'Aphid'] },
    // Maize diseases
    { value: 'maize', label: 'Maize (मक्का)', diseases: ['Common Rust', 'Gray Leaf Spot', 'Ear Rot', 'Fall Armyworm'] },
    // Sugarcane diseases
    { value: 'sugarcane', label: 'Sugarcane (गन्ना)', diseases: ['Mosaic', 'Red Rot', 'Red Rust', 'Yellow Rust'] },
    // Other crops from disease database
    { value: 'tomato', label: 'Tomato (टमाटर)', diseases: ['Early Blight', 'Late Blight', 'Leaf Mold', 'Mosaic'] },
    { value: 'potato', label: 'Potato (आलू)', diseases: ['Early Blight', 'Late Blight'] },
    { value: 'mango', label: 'Mango (आम)', diseases: ['Anthracnose', 'Powdery Mildew'] },
    { value: 'grapes', label: 'Grapes (अंगूर)', diseases: ['Downy Mildew', 'Powdery Mildew'] },
    { value: 'citrus', label: 'Citrus (संतरा)', diseases: ['Canker', 'Greening'] },
    { value: 'chilli', label: 'Chilli (मिर्च)', diseases: ['Leaf Curl', 'Anthracnose'] },
  ];
  const supportedCrops = [...new Set(capabilities?.supported_crops || [])];
  const trainedModelCrops = supportedCrops.map(value => cropCatalog.find(c => c.value === value) || {
    value, label: value.charAt(0).toUpperCase() + value.slice(1), diseases: []
  });

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError(t('cropHealth.invalidImage'));
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError(t('cropHealth.imageTooLarge'));
      return;
    }

    const token = ++operation.current;
    activeRequest.current?.abort();
    setIsAnalyzing(false);
    setSelectedImage(file);
    setImagePreview(null);
    setShowTreatment(false);
    setError(null);
    setResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (token === operation.current) setImagePreview(e.target.result);
    };
    reader.onerror = () => {
      if (token !== operation.current) return;
      setSelectedImage(null);
      setError(t('cropHealth.invalidImage'));
    };
    reader.readAsDataURL(file);
  }, [t]);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Analyze image
  const analyzeImage = async () => {
    if (!supportedCrops.includes(selectedCrop)) {
      setError(t('cropHealth.selectCropWarning'));
      return;
    }
    if (!selectedImage) {
      setError(t('cropHealth.uploadPrompt'));
      return;
    }

    const token = ++operation.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedImage);
      formData.append('crop_type', selectedCrop);

      let data;
      const response = await fetch(`${API_URL}/detect_disease`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('analysis_failed');
      }

      data = await response.json();
      if (token !== operation.current) return;
      if (data.success !== true) throw new Error('analysis_failed');
      if (!['healthy', 'disease_detected'].includes(data.data?.status)) {
        setResult(null);
        setError(typeof data.data?.message === 'string' ? data.data.message : t('common.error'));
        return;
      }
      const diagnosis = parseDiseaseResponse(data.data, selectedCrop);
      if (!diagnosis) throw new Error('analysis_failed');

      // If disease detected and we have the full info in local database, use it
      if (diagnosis.status === 'disease_detected') {
        const fullDiseaseInfo = diseaseDatabase.diseases[selectedCrop]?.find(d => d.id === diagnosis.disease.id);
        if (fullDiseaseInfo) {
          diagnosis.diseaseDetails = fullDiseaseInfo;
        }
      }

      setResult(diagnosis);
      setShowTreatment(true);
    } catch (err) {
      if (token !== operation.current) return;
      // Hard failure for live upload. NEVER simulate a diagnosis for a real uploaded image.
      setError(t('common.error'));
      setResult(null);
    } finally {
      clearTimeout(timeout);
      if (token === operation.current) setIsAnalyzing(false);
    }
  };

  // Reset state
  const reset = () => {
    operation.current += 1;
    activeRequest.current?.abort();
    setIsAnalyzing(false);
    setSelectedImage(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
    setShowTreatment(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Load a photograph; only the classifier may assign a diagnosis.
  const trySampleImage = async () => {
    if (!supportedCrops.includes(selectedCrop)) {
      setError(t('cropHealth.selectCropWarning'));
      return;
    }
    const token = ++operation.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch('/sample-crop-leaf.jpg', {signal:controller.signal});
      if (!response.ok) throw new Error('Sample unavailable');
      const blob = await response.blob();
      if (token !== operation.current) return;
      handleFileSelect(new File([blob], 'sample-crop-leaf.jpg', {type:blob.type || 'image/jpeg'}));
    } catch {
      if (token === operation.current) setError(t('common.error'));
    } finally {
      clearTimeout(timeout);
      if (token === operation.current) setIsAnalyzing(false);
    }
  };

  const diseaseKey = (name = '') => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const diseaseName = (name) => name ? (t(`diseases.${diseaseKey(name)}`) || t('cropHealth.diseaseDetected')) : t('cropHealth.diseaseDetected');
  const translatedCropName = (crop) => t(`crops.${crop?.value === 'citrus' ? 'orange' : crop?.value}`) || crop?.label || t('common.notAvailable');
  const safeLocalizedList = (items, fallbackKey) => language === 'en' && Array.isArray(items) && items.length ? items : [t(fallbackKey)];

  // Get selected crop info
  const selectedCropInfo = trainedModelCrops.find(c => c.value === selectedCrop);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t('cropHealth.title') || 'Crop Health Check'}</h2>
            <p className="text-green-100">{t('cropHealth.subtitle') || 'Upload a plant image for visual disease detection'}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: Upload Section */}
        <div className="space-y-4">
          {/* Crop Selection - MANDATORY */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('cropHealth.selectCrop') || 'Select Crop Type'} <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => { reset(); setSelectedCrop(e.target.value); }}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${!selectedCrop ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'
                }`}
            >
              <option value="">{t('cropHealth.selectCropPlaceholder') || '-- Select Crop Type --'}</option>
              {trainedModelCrops.map(crop => (
                <option key={crop.value} value={crop.value}>
                  {translatedCropName(crop)}
                </option>
              ))}
            </select>
            {!selectedCrop && (
              <p className="text-xs text-orange-600 mt-1">{t('cropHealth.selectCropWarning') || 'Please select a crop before uploading an image'}</p>
            )}
            {!capabilities && <div role="status" className="mt-2 text-sm text-amber-700">
              <p>{t(capabilityLoading ? 'common.loading' : 'common.notAvailable')}</p>
              <button type="button" disabled={capabilityLoading} onClick={() => setCapabilityAttempt(value => value + 1)}>{t('common.retry')}</button>
            </div>}
          </div>

          {/* Upload Zone */}
          <div
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-2xl p-4 sm:p-8 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-green-400 hover:bg-green-50/50'
              }
              ${imagePreview ? 'bg-gray-50' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt={t('cropHealth.selectedPlant')}
                  className="max-h-64 mx-auto rounded-xl shadow-md bg-white"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-1">
                  {isDragging ? (t('cropHealth.dropImage') || 'Drop image here') : (t('cropHealth.dragDrop') || 'Drag & drop plant image')}
                </p>
                <p className="text-sm text-gray-400">{t('cropHealth.clickBrowse') || 'or click to browse'}</p>
                <p className="text-xs text-gray-400 mt-2">{t('cropHealth.supportsText') || 'Supports: JPG, PNG, WebP (max 10MB)'}</p>
              </>
            )}
          </div>

          {/* Camera Capture (Mobile) */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium"
            >
              <Camera className="w-5 h-5" />
              {t('cropHealth.takePhoto') || 'Take Photo'}
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleInputChange}
              className="hidden"
            />

            <button
              onClick={analyzeImage}
              disabled={!selectedImage || isAnalyzing || !supportedCrops.includes(selectedCrop)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all
                ${selectedImage && !isAnalyzing
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('cropHealth.analyzing') || 'Analyzing...'}
                </>
              ) : (
                <>
                  <Leaf className="w-5 h-5" />
                  {t('cropHealth.analyze') || 'Analyze'}
                </>
              )}
            </button>
          </div>

          {/* Fix H: Try Sample Image button for demo */}
          {!imagePreview && !result && (
            <button
              onClick={trySampleImage}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors font-medium border border-amber-200 disabled:opacity-50"
            >
              <Leaf className="w-5 h-5" />
              {t('cropHealth.trySampleDemo') || 'Try Sample Image (Demo)'}
            </button>
          )}
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Right: Results Section */}
        <div>
          {result ? (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Result Header */}
              <div className={`p-6 ${result.status === 'healthy' ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-4">
                  {result.status === 'healthy' ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-green-800">{t('cropHealth.plantHealthy') || 'Plant is Healthy!'}</h3>
                        <p className="text-green-600 text-sm">{t('cropHealth.noDiseaseDetected') || 'No significant disease detected in frame.'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center border border-amber-200">
                        <Bug className="w-8 h-8 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-amber-800 leading-tight">
                          {diseaseName(result.disease?.name)}
                        </h3>
                        {result.unsupportedCrop && (
                          <p className="text-[10px] text-amber-600 font-semibold mb-1 uppercase tracking-wide">
                            {t('cropHealth.limitedModelSupport') || 'Limited Model Support for'} {translatedCropName(selectedCropInfo)}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border flex items-center text-gray-600 bg-gray-100 border-gray-200">
                            {t('cropHealth.severity')}: {t('common.notAvailable')}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Result Content */}
              <div className="p-6 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {t('dashboard.confidence')}: {((result.status === 'healthy' ? result.confidence : result.disease.confidence) * 100).toFixed(1)}%
                  </p>
                  <h4 className="text-sm font-semibold text-gray-800">{t('cropHealth.modelLimitationsTitle')}</h4>
                  <p className="text-sm text-gray-600">{t('cropHealth.agronomicDisclaimer')}</p>
                </div>
                {result.status === 'healthy' ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-green-500" />
                      {t('cropHealth.recommendations') || 'Recommendations'}
                    </h4>
                    <ul className="space-y-2">
                      {safeLocalizedList(result.suggestions || diseaseDatabase.healthyIndicators, 'cropHealth.healthySummary').map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <>
                    {/* Symptoms */}
                    {result.diseaseDetails?.symptoms && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-800">{t('cropHealth.symptoms') || 'Symptoms'}</h4>
                        <ul className="space-y-1">
                          {safeLocalizedList(result.diseaseDetails.symptoms, 'cropHealth.symptomsSummary').map((symptom, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-amber-500">•</span>
                              {symptom}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Treatment Accordion */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setShowTreatment(!showTreatment)}
                        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-semibold text-gray-800 flex items-center gap-2">
                          <Droplets className="w-5 h-5 text-blue-500" />
                          {t('cropHealth.treatmentPrevention') || 'Treatment & Prevention'}
                        </span>
                        {showTreatment ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </button>

                      {showTreatment && (
                        <div className="p-4 space-y-4">
                          {/* Chemical Treatment */}
                          {(result.treatment?.chemical || result.diseaseDetails?.treatment) && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">{t('cropHealth.chemicalTreatment') || 'Chemical Treatment'}</h5>
                              <ul className="space-y-1">
                                {safeLocalizedList(result.treatment?.chemical || result.diseaseDetails?.treatment, 'cropHealth.chemicalSummary').map((item, i) => (
                                  <li key={i} className="text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Organic Treatment */}
                          {result.treatment?.organic && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">{t('cropHealth.organicOptions') || 'Organic Options'}</h5>
                              <ul className="space-y-1">
                                {safeLocalizedList(result.treatment.organic, 'cropHealth.organicSummary').map((item, i) => (
                                  <li key={i} className="text-sm text-gray-600 bg-green-50 rounded-lg px-3 py-2">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Prevention */}
                          {(result.treatment?.prevention || result.diseaseDetails?.prevention) && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">{t('cropHealth.prevention') || 'Prevention'}</h5>
                              <ul className="space-y-1">
                                {safeLocalizedList(result.treatment?.prevention || result.diseaseDetails?.prevention, 'cropHealth.preventionSummary').map((item, i) => (
                                  <li key={i} className="text-sm text-gray-600 bg-amber-50 rounded-lg px-3 py-2">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button
                  onClick={reset}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors flex items-center justify-center gap-2 mt-4"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('cropHealth.analyzeAnother') || 'Analyze Another Image'}
                </button>
                
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="bg-gray-50 rounded-2xl p-8 text-center h-full flex flex-col justify-center border border-gray-200">
              <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">{t('cropHealth.noAnalysisYet') || 'No Analysis Yet'}</h3>
              <p className="text-sm text-gray-400">
                {t('cropHealth.uploadPrompt') || 'Upload a plant image to check for diseases'}
              </p>

              {/* Transparency Notice */}
              <div className="mt-6 text-left bg-white border border-gray-100 shadow-sm rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wide">{t('cropHealth.modelLimitationsTitle') || 'Model Limitations'}</h4>
                <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
                  {t('cropHealth.agronomicDisclaimer')}
                </p>
                <div className="flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0"></span>
                  <p className="text-[11px] text-gray-500 leading-tight">{trainedModelCrops.map(translatedCropName).join(', ')}</p>
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400 mt-1 flex-shrink-0"></span>
                  <p className="text-[11px] text-gray-500 leading-tight">{t('cropHealth.uploadPrompt')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CropHealthCheck;


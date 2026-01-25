import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, Camera, X, Loader2, AlertTriangle,
  CheckCircle, Leaf, Bug, Droplets, Shield,
  ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import diseaseDatabase from '../data/diseaseDatabase.json';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Crop Health Check Component
 * Allows users to upload plant images for disease detection
 */
const CropHealthCheck = () => {
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

  // All crops from trained model (42 classes)
  const trainedModelCrops = [
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

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image (JPG, PNG, or WebP)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Maximum size is 10MB');
      return;
    }

    setSelectedImage(file);
    setError(null);
    setResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }, []);

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
    if (!selectedCrop) {
      setError('Please select a crop type first');
      return;
    }
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedImage);
      formData.append('crop_type', selectedCrop);

      const response = await fetch(`${API_URL}/detect_disease`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze image');
      }

      const data = await response.json();

      // If disease detected and we have the full info in local database, use it
      if (data.data.status === 'disease_detected' && data.data.disease) {
        const diseaseId = data.data.disease.id;
        // Try to find full disease info from local database
        let fullDiseaseInfo = null;
        // eslint-disable-next-line no-unused-vars
        for (const [_crop, diseases] of Object.entries(diseaseDatabase.diseases)) {
          const found = diseases.find(d => d.id === diseaseId);
          if (found) {
            fullDiseaseInfo = found;
            break;
          }
        }
        if (fullDiseaseInfo) {
          data.data.diseaseDetails = fullDiseaseInfo;
        }
      }

      setResult(data.data);
      setShowTreatment(true);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Reset state
  const reset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
    setShowTreatment(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

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
            <h2 className="text-2xl font-bold">Crop Health Check</h2>
            <p className="text-green-100">Upload a plant image for AI-powered disease detection</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Upload Section */}
        <div className="space-y-4">
          {/* Crop Selection - MANDATORY */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Crop Type <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all ${!selectedCrop ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'
                }`}
            >
              <option value="">-- Select Crop Type --</option>
              {trainedModelCrops.map(crop => (
                <option key={crop.value} value={crop.value}>
                  {crop.label}
                </option>
              ))}
            </select>
            {!selectedCrop && (
              <p className="text-xs text-orange-600 mt-1">⚠️ Please select a crop before uploading image</p>
            )}
            {selectedCropInfo && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="font-medium">Detectable diseases:</span> {selectedCropInfo.diseases.join(', ')}
              </div>
            )}
          </div>

          {/* Upload Zone */}
          <div
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
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
                  alt="Selected plant"
                  className="max-h-64 mx-auto rounded-xl shadow-md"
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
                  {isDragging ? 'Drop image here' : 'Drag & drop plant image'}
                </p>
                <p className="text-sm text-gray-400">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">Supports: JPG, PNG, WebP (max 10MB)</p>
              </>
            )}
          </div>

          {/* Camera Capture (Mobile) */}
          <div className="flex gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium"
            >
              <Camera className="w-5 h-5" />
              Take Photo
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
              disabled={!selectedImage || isAnalyzing}
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
                  Analyzing...
                </>
              ) : (
                <>
                  <Leaf className="w-5 h-5" />
                  Analyze
                </>
              )}
            </button>
          </div>

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
                        <h3 className="text-xl font-bold text-green-800">Plant is Healthy!</h3>
                        <p className="text-green-600">No disease detected</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                        <Bug className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-amber-800">
                          {result.disease?.name || 'Disease Detected'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(result.disease?.severity)}`}>
                            {result.disease?.severity?.toUpperCase()} Severity
                          </span>
                          <span className="text-amber-600 text-sm">
                            {((result.disease?.confidence || 0) * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Result Content */}
              <div className="p-6 space-y-4">
                {result.status === 'healthy' ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-green-500" />
                      Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {(result.suggestions || diseaseDatabase.healthyIndicators).map((tip, i) => (
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
                        <h4 className="font-semibold text-gray-800">Symptoms</h4>
                        <ul className="space-y-1">
                          {result.diseaseDetails.symptoms.map((symptom, i) => (
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
                          Treatment & Prevention
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
                              <h5 className="text-sm font-medium text-gray-700 mb-2">💊 Chemical Treatment</h5>
                              <ul className="space-y-1">
                                {(result.treatment?.chemical || result.diseaseDetails?.treatment)?.map((t, i) => (
                                  <li key={i} className="text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
                                    {t}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Organic Treatment */}
                          {result.treatment?.organic && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">🌿 Organic Options</h5>
                              <ul className="space-y-1">
                                {result.treatment.organic.map((t, i) => (
                                  <li key={i} className="text-sm text-gray-600 bg-green-50 rounded-lg px-3 py-2">
                                    {t}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Prevention */}
                          {result.diseaseDetails?.prevention && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">🛡️ Prevention</h5>
                              <ul className="space-y-1">
                                {result.diseaseDetails.prevention.map((p, i) => (
                                  <li key={i} className="text-sm text-gray-600 bg-amber-50 rounded-lg px-3 py-2">
                                    {p}
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

                {/* Analyze Another */}
                <button
                  onClick={reset}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-green-400 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Analyze Another Image
                </button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="bg-gray-50 rounded-2xl p-8 text-center h-full flex flex-col justify-center">
              <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Analysis Yet</h3>
              <p className="text-sm text-gray-400">
                Upload a plant image to check for diseases
              </p>

              {/* Tips */}
              <div className="mt-6 text-left bg-white rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">📷 Tips for best results:</h4>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Take a clear, well-lit photo</li>
                  <li>• Focus on the affected leaf or part</li>
                  <li>• Avoid blurry or dark images</li>
                  <li>• Include visible symptoms like spots or discoloration</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CropHealthCheck;

/**
 * PestReportForm Component
 * Modal form for farmers to report pest sightings
 * 
 * Features:
 * - Crop and pest type selection
 * - Severity rating
 * - Description input
 * - Auto-location detection
 * - Photo upload placeholder
 */

import React, { useState, useEffect } from 'react';
import { X, Bug, MapPin, Camera, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from '../i18n';

// Common pests by crop for dropdown
const PEST_OPTIONS = {
  rice: [
    { id: 'brown_planthopper', name: 'Brown Planthopper (BPH)' },
    { id: 'stem_borer', name: 'Yellow Stem Borer' },
    { id: 'leaf_folder', name: 'Rice Leaf Folder' },
    { id: 'gall_midge', name: 'Gall Midge' },
    { id: 'rice_hispa', name: 'Rice Hispa' },
    { id: 'other', name: 'Other' }
  ],
  wheat: [
    { id: 'aphid', name: 'Wheat Aphid' },
    { id: 'termite', name: 'Termite' },
    { id: 'army_worm', name: 'Army Worm' },
    { id: 'pink_borer', name: 'Pink Borer' },
    { id: 'other', name: 'Other' }
  ],
  cotton: [
    { id: 'bollworm', name: 'American Bollworm' },
    { id: 'pink_bollworm', name: 'Pink Bollworm' },
    { id: 'whitefly', name: 'Whitefly' },
    { id: 'jassid', name: 'Jassid' },
    { id: 'thrips', name: 'Thrips' },
    { id: 'other', name: 'Other' }
  ],
  sugarcane: [
    { id: 'early_shoot_borer', name: 'Early Shoot Borer' },
    { id: 'top_borer', name: 'Top Borer' },
    { id: 'woolly_aphid', name: 'Woolly Aphid' },
    { id: 'scale_insect', name: 'Scale Insect' },
    { id: 'pyrilla', name: 'Pyrilla' },
    { id: 'other', name: 'Other' }
  ],
  maize: [
    { id: 'fall_armyworm', name: 'Fall Armyworm' },
    { id: 'stem_borer', name: 'Stem Borer' },
    { id: 'aphid', name: 'Aphid' },
    { id: 'other', name: 'Other' }
  ]
};

const CROPS = ['Rice', 'Wheat', 'Cotton', 'Sugarcane', 'Maize', 'Soybean', 'Groundnut', 'Other'];

const PestReportForm = ({ isOpen, onClose, onSubmit, initialCrop = '', initialLocation = null }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    crop: initialCrop,
    pestType: '',
    pestName: '',
    severity: 'medium',
    description: '',
    lat: initialLocation?.lat || 0,
    lon: initialLocation?.lon || 0,
    district: '',
    state: '',
    photoUrl: null
  });

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Get pest options based on selected crop
  const getPestOptions = () => {
    const cropKey = formData.crop.toLowerCase();
    return PEST_OPTIONS[cropKey] || [{ id: 'other', name: 'Other' }];
  };

  // Detect location
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setFormData(prev => ({ ...prev, lat, lon }));

        // Try to get location name (reverse geocoding)
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const data = await response.json();

          if (data.address) {
            setFormData(prev => ({
              ...prev,
              district: data.address.county || data.address.city || data.address.town || '',
              state: data.address.state || ''
            }));
          }
        } catch (e) {
          console.warn('Reverse geocoding failed:', e);
        }

        setLocationLoading(false);
      },
      (err) => {
        setLocationError('Could not detect location');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Auto-detect location on open
  useEffect(() => {
    if (isOpen && !formData.lat) {
      detectLocation();
    }
  }, [isOpen]);

  // Handle form input changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Update pest name when pest type changes
    if (field === 'pestType') {
      const options = getPestOptions();
      const selected = options.find(p => p.id === value);
      if (selected) {
        setFormData(prev => ({ ...prev, pestName: selected.name }));
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.crop || !formData.pestType || !formData.severity) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.state) {
      setError('Please detect or enter your location');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit(formData);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          // Reset form
          setFormData({
            crop: '',
            pestType: '',
            pestName: '',
            severity: 'medium',
            description: '',
            lat: 0,
            lon: 0,
            district: '',
            state: '',
            photoUrl: null
          });
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit report');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center">
            <div className="p-2 bg-farm-green-100 rounded-xl mr-3">
              <Bug className="w-5 h-5 text-farm-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">
              {t('pest.reportTitle') || 'Report Pest Sighting'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Report Submitted!</h3>
            <p className="text-gray-600">Thank you for contributing to pest monitoring.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Crop Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Affected Crop *
              </label>
              <select
                value={formData.crop}
                onChange={(e) => handleChange('crop', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green-500"
                required
              >
                <option value="">Select crop</option>
                {CROPS.map(crop => (
                  <option key={crop} value={crop}>{crop}</option>
                ))}
              </select>
            </div>

            {/* Pest Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pest Type *
              </label>
              <select
                value={formData.pestType}
                onChange={(e) => handleChange('pestType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green-500"
                required
                disabled={!formData.crop}
              >
                <option value="">Select pest</option>
                {getPestOptions().map(pest => (
                  <option key={pest.id} value={pest.id}>{pest.name}</option>
                ))}
              </select>
            </div>

            {/* Severity Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity Level *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['low', 'medium', 'high'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleChange('severity', level)}
                    className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${formData.severity === level
                        ? level === 'low' ? 'border-green-500 bg-green-50 text-green-700' :
                          level === 'medium' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' :
                            'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    {level === 'low' ? '🟢 Low' : level === 'medium' ? '🟡 Medium' : '🔴 High'}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location *
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locationLoading}
                  className="flex items-center px-3 py-2 bg-farm-green-100 text-farm-green-700 rounded-lg hover:bg-farm-green-200 transition-colors disabled:opacity-50"
                >
                  <MapPin className={`w-4 h-4 mr-1 ${locationLoading ? 'animate-pulse' : ''}`} />
                  {locationLoading ? 'Detecting...' : 'Detect Location'}
                </button>
                {formData.state && (
                  <span className="text-sm text-gray-600">
                    {formData.district && `${formData.district}, `}{formData.state}
                  </span>
                )}
              </div>
              {locationError && (
                <p className="text-xs text-red-500 mt-1">{locationError}</p>
              )}
            </div>

            {/* Manual Location Input */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">District</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  placeholder="Enter district"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-farm-green-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">State *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="Enter state"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-farm-green-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe what you observed..."
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-farm-green-500"
              />
              <p className="text-xs text-gray-400 text-right">{formData.description.length}/500</p>
            </div>

            {/* Photo Upload Placeholder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Photo (optional)
              </label>
              <button
                type="button"
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 transition-colors flex items-center justify-center"
                disabled
              >
                <Camera className="w-5 h-5 mr-2" />
                Photo upload coming soon
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-farm-green-600 text-white font-semibold rounded-xl hover:bg-farm-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <Bug className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Report
                </>
              )}
            </button>

            {/* Privacy Note */}
            <p className="text-xs text-gray-400 text-center">
              Your location is shared anonymously to help other farmers.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default PestReportForm;

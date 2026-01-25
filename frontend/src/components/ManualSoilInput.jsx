/**
 * ManualSoilInput - Form for Manual Soil Data Entry
 * 
 * Used when IoT sensors are unavailable
 * Validates input ranges and submits to backend
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from '../i18n';

// Input field component
const FormField = ({
  label,
  name,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  tooltip,
  error
}) => (
  <div className="mb-4">
    <div className="flex items-center justify-between mb-1">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
        {label}
        {tooltip && (
          <div className="relative group">
            <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg px-3 py-2 w-48 z-50">
              {tooltip}
            </div>
          </div>
        )}
      </label>
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
    <input
      type="number"
      name={name}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      className={`w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 transition ${error
        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-200 focus:border-farm-green-500 focus:ring-farm-green-200'
        }`}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

const ManualSoilInput = ({
  deviceId = 'default',
  initialData = null,
  onSubmit,
  onClose
}) => {
  const { t } = useTranslation();

  // Form state with defaults
  const [formData, setFormData] = useState({
    nitrogen: initialData?.nitrogen || 120,
    phosphorus: initialData?.phosphorus || 40,
    potassium: initialData?.potassium || 100,
    ph: initialData?.ph || 6.5,
    moisture: initialData?.moisture || 45,
    temperature: initialData?.temperature || 25,
    organic_carbon: initialData?.organic_carbon || 0.8,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Validation rules
  const validationRules = {
    nitrogen: { min: 0, max: 500, label: t('soilSensor.nitrogen') || 'Nitrogen' },
    phosphorus: { min: 0, max: 200, label: t('soilSensor.phosphorus') || 'Phosphorus' },
    potassium: { min: 0, max: 500, label: t('soilSensor.potassium') || 'Potassium' },
    ph: { min: 0, max: 14, label: 'pH' },
    moisture: { min: 0, max: 100, label: t('soilSensor.moisture') || 'Moisture' },
    temperature: { min: -10, max: 60, label: t('soilSensor.temp') || 'Temperature' },
    organic_carbon: { min: 0, max: 20, label: t('soilSensor.organicCarbon') || 'Organic Carbon' },
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));

    // Clear error on change
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    for (const [field, rules] of Object.entries(validationRules)) {
      const value = formData[field];
      if (value < rules.min || value > rules.max) {
        newErrors[field] = `${rules.label} must be between ${rules.min} and ${rules.max}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const result = await onSubmit(formData);

      if (!result.success) {
        setSubmitError(result.error || 'Failed to save data');
      }
    } catch (err) {
      setSubmitError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">
            {t('soilSensor.manualInput') || 'Manual Soil Data Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          {/* NPK Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              NPK {t('soilSensor.levels') || 'Levels'}
            </h3>

            <FormField
              label={t('soilSensor.nitrogen') || 'Nitrogen (N)'}
              name="nitrogen"
              value={formData.nitrogen}
              onChange={handleChange}
              min={0}
              max={500}
              step={1}
              unit="kg/ha"
              tooltip="Available nitrogen in soil. Ideal: 100-150 kg/ha for most crops."
              error={errors.nitrogen}
            />

            <FormField
              label={t('soilSensor.phosphorus') || 'Phosphorus (P)'}
              name="phosphorus"
              value={formData.phosphorus}
              onChange={handleChange}
              min={0}
              max={200}
              step={1}
              unit="kg/ha"
              tooltip="Available phosphorus. Ideal: 30-50 kg/ha."
              error={errors.phosphorus}
            />

            <FormField
              label={t('soilSensor.potassium') || 'Potassium (K)'}
              name="potassium"
              value={formData.potassium}
              onChange={handleChange}
              min={0}
              max={500}
              step={1}
              unit="kg/ha"
              tooltip="Available potassium. Ideal: 80-120 kg/ha."
              error={errors.potassium}
            />
          </div>

          {/* Soil Properties Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              {t('soilSensor.properties') || 'Soil Properties'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="pH"
                name="ph"
                value={formData.ph}
                onChange={handleChange}
                min={0}
                max={14}
                step={0.1}
                tooltip="Soil acidity/alkalinity. Ideal: 6.0-7.0 for most crops."
                error={errors.ph}
              />

              <FormField
                label={t('soilSensor.moisture') || 'Moisture'}
                name="moisture"
                value={formData.moisture}
                onChange={handleChange}
                min={0}
                max={100}
                step={1}
                unit="%"
                error={errors.moisture}
              />

              <FormField
                label={t('soilSensor.temp') || 'Temperature'}
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                min={-10}
                max={60}
                step={0.5}
                unit="°C"
                error={errors.temperature}
              />

              <FormField
                label={t('soilSensor.organicCarbon') || 'Organic Carbon'}
                name="organic_carbon"
                value={formData.organic_carbon}
                onChange={handleChange}
                min={0}
                max={20}
                step={0.1}
                unit="%"
                tooltip="Organic carbon content. Higher is better for fertility."
                error={errors.organic_carbon}
              />
            </div>
          </div>

          {/* Device ID Info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              {t('soilSensor.plotId') || 'Plot/Device ID'}:
              <span className="font-medium text-gray-700 ml-1">{deviceId}</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-farm-green-500 text-white rounded-xl hover:bg-farm-green-600 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('common.saving') || 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t('common.save') || 'Save'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ManualSoilInput;

import { useState, useCallback } from 'react';
import { useTranslation } from '../i18n';

// Validation patterns
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const AADHAAR_REGEX = /^\d{12}$/;
const PIN_REGEX = /^\d{6}$/;

export const useFormValidation = () => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState({});

  const validateField = useCallback((fieldName, value, isRequired = false) => {
    let error = null;

    // Check required
    if (isRequired && (!value || (typeof value === 'string' && !value.trim()))) {
      error = t('validation.required') || 'This field is required';
      setErrors(prev => ({ ...prev, [fieldName]: error }));
      return false;
    }

    // Field-specific validation
    switch (fieldName) {
      case 'mobileNumber':
        if (value && !MOBILE_REGEX.test(value)) {
          error = t('validation.invalidMobile') || 'Please enter a valid 10-digit mobile number';
        }
        break;
      case 'aadhaarNumber':
        if (value && !AADHAAR_REGEX.test(value.replace(/\s/g, ''))) {
          error = t('validation.invalidAadhaar') || 'Please enter a valid 12-digit Aadhaar number';
        }
        break;
      case 'pinCode':
        if (value && !PIN_REGEX.test(value)) {
          error = t('validation.invalidPinCode') || 'Please enter a valid 6-digit PIN code';
        }
        break;
      case 'totalLandArea':
        if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 1000000)) {
          error = t('validation.invalidArea') || 'Please enter a valid land area';
        }
        break;
      case 'irrigatedLand':
      case 'rainfedLand':
        if (value !== undefined && value !== null && String(value).trim() !== '' &&
            (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1000000)) {
          error = t('validation.invalidArea');
        }
        break;
      default:
        break;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[fieldName] = error;
      } else {
        delete newErrors[fieldName];
      }
      return newErrors;
    });

    return !error;
  }, [t]);

  const validateStep = useCallback((stepNumber, formData) => {
    const stepErrors = {};
    let isValid = true;

    const addError = (field, message) => {
      stepErrors[field] = message;
      isValid = false;
    };
    const validateText = (field, label, max = 1000) => {
      const value = typeof formData[field] === 'string' ? formData[field].trim() : '';
      const length = Array.from(value).length;
      if (!length) addError(field, t('validation.required'));
      else if (length < 2 || length > max) addError(field, t('validation.range', {label: t(label), min: 2, max}));
    };

    switch (stepNumber) {
      case 1: // Personal Information
        validateText('fullName', 'registration.fullName', 100);
        validateText('fatherName', 'registration.fatherName', 100);
        if (!formData.mobileNumber?.trim()) {
          addError('mobileNumber', t('validation.required') || 'This field is required');
        } else if (!MOBILE_REGEX.test(formData.mobileNumber.trim())) {
          addError('mobileNumber', t('validation.invalidMobile') || 'Please enter a valid 10-digit mobile number');
        }
        // Aadhaar is optional - only validate format if provided
        if (formData.aadhaarNumber && formData.aadhaarNumber.trim() && !AADHAAR_REGEX.test(formData.aadhaarNumber.replace(/\s/g, ''))) {
          addError('aadhaarNumber', t('validation.invalidAadhaar') || 'Please enter a valid 12-digit Aadhaar number');
        }
        break;

      case 2: // Location Details
        for (const field of ['state', 'district', 'tehsil', 'village']) validateText(field, `registration.${field}`);
        if (!formData.pinCode?.trim()) {
          addError('pinCode', t('validation.required') || 'This field is required');
        } else if (!PIN_REGEX.test(formData.pinCode.trim())) {
          addError('pinCode', t('validation.invalidPinCode') || 'Please enter a valid 6-digit PIN code');
        }
        break;

      case 3: // Land Details
        if (!formData.khasraNumber?.trim()) addError('khasraNumber', t('validation.required') || 'This field is required');
        if (!Number.isFinite(Number(formData.totalLandArea)) || Number(formData.totalLandArea) <= 0 || Number(formData.totalLandArea) > 1000000) {
          addError('totalLandArea', t('validation.invalidArea') || 'Please enter a valid land area');
        }
        for (const field of ['irrigatedLand', 'rainfedLand']) {
          const raw = formData[field];
          if (raw !== undefined && raw !== null && String(raw).trim() !== '' &&
              (!Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 1000000)) {
            addError(field, t('validation.invalidArea'));
          }
        }
        if (Number(formData.irrigatedLand || 0) + Number(formData.rainfedLand || 0) > Number(formData.totalLandArea) + 1e-9) {
          addError('irrigatedLand', t('validation.invalidArea'));
          addError('rainfedLand', t('validation.invalidArea'));
        }
        if (!formData.ownershipType) addError('ownershipType', t('validation.required') || 'This field is required');
        break;

      case 4: // Farming Information
        if (!formData.primaryCrop) addError('primaryCrop', t('validation.required') || 'This field is required');
        if (!formData.farmingType) addError('farmingType', t('validation.required') || 'This field is required');
        if (!formData.consentData) addError('consentData', t('validation.consentRequired') || 'You must consent to data sharing');
        if (!formData.consentTerms) addError('consentTerms', t('validation.termsRequired') || 'You must agree to Terms and Privacy Policy');
        break;

      default:
        break;
    }

    setErrors(stepErrors);
    return isValid;
  }, [t]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((fieldName) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  return {
    errors,
    validateField,
    validateStep,
    clearErrors,
    clearFieldError
  };
};

export default useFormValidation;

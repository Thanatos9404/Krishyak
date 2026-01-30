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
        if (value !== undefined && (isNaN(value) || parseFloat(value) <= 0)) {
          error = t('validation.invalidArea') || 'Please enter a valid land area';
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

    switch (stepNumber) {
      case 1: // Personal Information
        if (!formData.fullName?.trim()) {
          addError('fullName', t('validation.required') || 'This field is required');
        }
        if (!formData.fatherName?.trim()) {
          addError('fatherName', t('validation.required') || 'This field is required');
        }
        if (!formData.mobileNumber?.trim()) {
          addError('mobileNumber', t('validation.required') || 'This field is required');
        } else if (!MOBILE_REGEX.test(formData.mobileNumber)) {
          addError('mobileNumber', t('validation.invalidMobile') || 'Please enter a valid 10-digit mobile number');
        }
        if (formData.aadhaarNumber && !AADHAAR_REGEX.test(formData.aadhaarNumber.replace(/\s/g, ''))) {
          addError('aadhaarNumber', t('validation.invalidAadhaar') || 'Please enter a valid 12-digit Aadhaar number');
        }
        break;

      case 2: // Location Details
        if (!formData.state) addError('state', t('validation.required') || 'This field is required');
        if (!formData.district) addError('district', t('validation.required') || 'This field is required');
        if (!formData.tehsil) addError('tehsil', t('validation.required') || 'This field is required');
        if (!formData.village?.trim()) addError('village', t('validation.required') || 'This field is required');
        if (!formData.pinCode?.trim()) {
          addError('pinCode', t('validation.required') || 'This field is required');
        } else if (!PIN_REGEX.test(formData.pinCode)) {
          addError('pinCode', t('validation.invalidPinCode') || 'Please enter a valid 6-digit PIN code');
        }
        break;

      case 3: // Land Details
        if (!formData.khasraNumber?.trim()) addError('khasraNumber', t('validation.required') || 'This field is required');
        if (!formData.totalLandArea || parseFloat(formData.totalLandArea) <= 0) {
          addError('totalLandArea', t('validation.invalidArea') || 'Please enter a valid land area');
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

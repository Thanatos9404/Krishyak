import { useState, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * useJAMTrinity - React hook for JAM Trinity verification
 * 
 * Manages:
 * - Consent flow
 * - Aadhaar verification with tokenization
 * - Land records lookup
 * - Jan Dhan bank verification
 * - PM-KISAN status
 * - Unified farmer profile
 */
const useJAMTrinity = () => {
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [consentId, setConsentId] = useState(null);
  const [consentStatus, setConsentStatus] = useState('none'); // none, pending, granted, revoked
  const [aadhaarToken, setAadhaarToken] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState({
    aadhaar: 'pending',
    land: 'pending',
    bank: 'pending',
    pmKisan: 'pending'
  });

  // Verification results
  const [aadhaarResult, setAadhaarResult] = useState(null);
  const [landRecords, setLandRecords] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [pmKisanStatus, setPmKisanStatus] = useState(null);
  const [farmerProfile, setFarmerProfile] = useState(null);

  /**
   * Request consent from user for data access
   */
  const requestConsent = useCallback(async (purpose, scopes) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/consent/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, scopes })
      });

      const data = await response.json();

      if (data.success) {
        setConsentId(data.data.consent_id);
        setConsentStatus('pending');
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to request consent');
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Grant consent (user confirms)
   */
  const grantConsent = useCallback(async (consentIdToGrant) => {
    const id = consentIdToGrant || consentId;
    if (!id) {
      setError('No consent ID to grant');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/consent/grant/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setConsentStatus('granted');
        return true;
      } else {
        throw new Error(data.error || 'Failed to grant consent');
      }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [consentId]);

  /**
   * Revoke consent
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const revokeConsent = useCallback(async () => {
    if (!consentId) {
      setError('No consent to revoke');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/consent/revoke/${consentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setConsentStatus('revoked');
        setAadhaarToken(null);
        setConsentId(null);
        resetVerifications();
        return true;
      } else {
        throw new Error(data.error || 'Failed to revoke consent');
      }
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [consentId]);

  /**
   * Verify Aadhaar using last 4 digits
   */
  const verifyAadhaar = useCallback(async (aadhaarLast4, name = null) => {
    if (!consentId || consentStatus !== 'granted') {
      setError('Consent required before verification');
      return null;
    }

    if (!aadhaarLast4 || aadhaarLast4.length !== 4) {
      setError('Please enter last 4 digits of Aadhaar');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/verify/aadhaar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhaar_last4: aadhaarLast4,
          consent_id: consentId,
          name: name
        })
      });

      const data = await response.json();

      if (data.success && data.data.verified) {
        setAadhaarToken(data.data.token);
        setAadhaarResult(data.data);
        setVerificationStatus(prev => ({ ...prev, aadhaar: 'verified' }));
        return data.data;
      } else {
        setVerificationStatus(prev => ({ ...prev, aadhaar: 'failed' }));
        throw new Error(data.error || 'Aadhaar verification failed');
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [consentId, consentStatus]);

  /**
   * Verify land records
   */
  const verifyLandRecords = useCallback(async () => {
    if (!aadhaarToken || !consentId) {
      setError('Aadhaar verification required first');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/verify/land`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhaar_token: aadhaarToken,
          consent_id: consentId
        })
      });

      const data = await response.json();

      if (data.success && data.data.verified) {
        setLandRecords(data.data);
        setVerificationStatus(prev => ({ ...prev, land: 'verified' }));
        return data.data;
      } else {
        setVerificationStatus(prev => ({ ...prev, land: 'failed' }));
        throw new Error(data.error || 'Land records verification failed');
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [aadhaarToken, consentId]);

  /**
   * Verify Jan Dhan bank account
   */
  const verifyJanDhan = useCallback(async () => {
    if (!aadhaarToken || !consentId) {
      setError('Aadhaar verification required first');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/verify/jan-dhan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhaar_token: aadhaarToken,
          consent_id: consentId
        })
      });

      const data = await response.json();

      if (data.success && data.data.linked) {
        setBankDetails(data.data);
        setVerificationStatus(prev => ({ ...prev, bank: 'verified' }));
        return data.data;
      } else {
        setVerificationStatus(prev => ({ ...prev, bank: 'failed' }));
        throw new Error(data.error || 'Bank verification failed');
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [aadhaarToken, consentId]);

  /**
   * Get PM-KISAN status
   */
  const getPmKisanStatus = useCallback(async () => {
    if (!aadhaarToken || !consentId) {
      setError('Aadhaar verification required first');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/verify/pm-kisan-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhaar_token: aadhaarToken,
          consent_id: consentId
        })
      });

      const data = await response.json();

      if (data.success) {
        setPmKisanStatus(data.data);
        setVerificationStatus(prev => ({
          ...prev,
          pmKisan: data.data.enrolled ? 'verified' : 'not_enrolled'
        }));
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch PM-KISAN status');
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [aadhaarToken, consentId]);

  /**
   * Get unified farmer profile
   */
  const getFarmerProfile = useCallback(async () => {
    if (!aadhaarToken || !consentId) {
      setError('Aadhaar verification required first');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/farmer/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhaar_token: aadhaarToken,
          consent_id: consentId
        })
      });

      const data = await response.json();

      if (data.success) {
        setFarmerProfile(data.data);

        // Update individual states from profile
        if (data.data.land_records) {
          setLandRecords(data.data.land_records);
          setVerificationStatus(prev => ({ ...prev, land: 'verified' }));
        }
        if (data.data.bank_details) {
          setBankDetails(data.data.bank_details);
          setVerificationStatus(prev => ({ ...prev, bank: 'verified' }));
        }
        if (data.data.pm_kisan_status) {
          setPmKisanStatus(data.data.pm_kisan_status);
          setVerificationStatus(prev => ({ ...prev, pmKisan: 'verified' }));
        }

        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch farmer profile');
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [aadhaarToken, consentId]);

  /**
   * Run all verifications in sequence
   */
  const runFullVerification = useCallback(async (aadhaarLast4, name = null) => {
    // Step 1: Request and grant consent
    const consentScopes = ['aadhaar_verify', 'land_records', 'bank_verify', 'pm_kisan_status'];
    const consent = await requestConsent('Farmer verification for scheme eligibility', consentScopes);

    if (!consent) return null;

    // Auto-grant for demo (in real app, user would see consent modal)
    const granted = await grantConsent(consent.consent_id);
    if (!granted) return null;

    // Step 2: Verify Aadhaar
    const aadhaarData = await verifyAadhaar(aadhaarLast4, name);
    if (!aadhaarData) return null;

    // Step 3: Get full profile (runs all other verifications)
    const profile = await getFarmerProfile();

    return profile;
  }, [requestConsent, grantConsent, verifyAadhaar, getFarmerProfile]);

  /**
   * Reset all verifications
   */
  const resetVerifications = useCallback(() => {
    setAadhaarResult(null);
    setLandRecords(null);
    setBankDetails(null);
    setPmKisanStatus(null);
    setFarmerProfile(null);
    setVerificationStatus({
      aadhaar: 'pending',
      land: 'pending',
      bank: 'pending',
      pmKisan: 'pending'
    });
  }, []);

  /**
   * Clear all state
   */
  const clearAll = useCallback(() => {
    resetVerifications();
    setConsentId(null);
    setConsentStatus('none');
    setAadhaarToken(null);
    setError(null);
  }, [resetVerifications]);

  return {
    // State
    loading,
    error,
    consentId,
    consentStatus,
    aadhaarToken,
    verificationStatus,

    // Results
    aadhaarResult,
    landRecords,
    bankDetails,
    pmKisanStatus,
    farmerProfile,

    // Computed
    isVerified: verificationStatus.aadhaar === 'verified',
    isFullyVerified: Object.values(verificationStatus).every(s => s === 'verified' || s === 'not_enrolled'),

    // Actions
    requestConsent,
    grantConsent,
    revokeConsent,
    verifyAadhaar,
    verifyLandRecords,
    verifyJanDhan,
    getPmKisanStatus,
    getFarmerProfile,
    runFullVerification,
    resetVerifications,
    clearAll,
    clearError: () => setError(null)
  };
};

export default useJAMTrinity;

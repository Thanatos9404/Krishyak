import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Shield, CheckCircle, XCircle, AlertTriangle,
  MapPin, Building2, Leaf,
  ChevronRight, Loader2, Lock, Eye, EyeOff,
  RefreshCw, User, IndianRupee
} from 'lucide-react';
import useJAMTrinity from '../hooks/useJAMTrinity';
import { useTranslation } from '../i18n';

/**
 * JAM Trinity Verification Component
 * 
 * Provides UI for:
 * - Consent management
 * - Aadhaar verification (tokenized)
 * - Land records verification
 * - Bank account verification
 * - PM-KISAN status check
 */
const JAMTrinityVerification = ({ onVerificationComplete }) => {
  const { t } = useTranslation();
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [step, setStep] = useState(1); // 1: consent, 2: aadhaar, 3: results

  const {
    loading,
    error,
    consentStatus,
    verificationStatus,
    aadhaarResult,
    landRecords,
    bankDetails,
    pmKisanStatus,
    farmerProfile,
    requestConsent,
    grantConsent,
    verifyAadhaar,
    getFarmerProfile,
    clearAll,
    clearError
  } = useJAMTrinity();

  // Start verification process
  const handleStartVerification = async () => {
    const scopes = ['aadhaar_verify', 'land_records', 'bank_verify', 'pm_kisan_status'];
    const result = await requestConsent(
      t('jam.consentMessage') || 'Verify your identity with government databases',
      scopes
    );
    if (result) {
      setShowConsentModal(true);
    }
  };

  // Handle consent grant
  const handleGrantConsent = async () => {
    const success = await grantConsent();
    if (success) {
      setShowConsentModal(false);
      setStep(2);
    }
  };

  // Handle Aadhaar verification
  const handleVerifyAadhaar = async () => {
    if (aadhaarInput.length !== 4) {
      return;
    }

    const result = await verifyAadhaar(aadhaarInput, nameInput || null);
    if (result) {
      // Auto-fetch full profile
      const profile = await getFarmerProfile();
      if (profile) {
        setStep(3);
        onVerificationComplete?.(profile);
      }
    }
  };

  // Reset everything
  const handleReset = () => {
    clearAll();
    setAadhaarInput('');
    setNameInput('');
    setStep(1);
  };

  // Get status icon
  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'not_enrolled':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  // Consent Modal
  const ConsentModal = () => {
    if (!showConsentModal) return null;

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowConsentModal(false)}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {t('jam.consentTitle') || 'Your Consent Required'}
            </h3>
            <p className="text-gray-600 text-sm">
              {t('jam.consentMessage') || 'We need your permission to verify your identity with government databases'}
            </p>
          </div>

          {/* Scopes */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
            <p className="text-xs font-semibold text-gray-700 mb-3">
              We will access:
            </p>
            <div className="flex items-center text-sm text-gray-600">
              <Shield className="w-4 h-4 mr-2 text-blue-500" />
              Aadhaar verification (last 4 digits only)
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2 text-green-500" />
              Land records from state database
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Building2 className="w-4 h-4 mr-2 text-purple-500" />
              Bank account linkage status
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Leaf className="w-4 h-4 mr-2 text-farm-green-500" />
              PM-KISAN enrollment status
            </div>
          </div>

          {/* Privacy note */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-yellow-800">
              <strong>🔒 Privacy:</strong> Your full Aadhaar number is never stored.
              We only use a tokenized reference for verification.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowConsentModal(false)}
              className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium"
            >
              {t('jam.denyConsent') || 'No Thanks'}
            </button>
            <button
              onClick={handleGrantConsent}
              disabled={loading}
              className="flex-1 py-3 px-4 bg-farm-green-500 text-white rounded-xl hover:bg-farm-green-600 transition font-medium flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {t('jam.grantConsent') || 'I Agree'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="card-farm card-glow p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {t('jam.title') || 'Farmer Verification'}
            </h2>
            <p className="text-sm text-gray-500">
              JAM Trinity + Land Records
            </p>
          </div>
        </div>

        {step > 1 && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Reset
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step 1: Start Verification */}
      {step === 1 && (
        <div className="text-center py-8">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Verify Your Identity
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Link your Aadhaar, land records, and bank account to check scheme eligibility
          </p>
          <button
            onClick={handleStartVerification}
            disabled={loading}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition flex items-center mx-auto"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Shield className="w-5 h-5 mr-2" />
            )}
            Start Verification
          </button>
        </div>
      )}

      {/* Step 2: Aadhaar Input */}
      {step === 2 && consentStatus === 'granted' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            <p className="text-sm text-green-700 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Consent granted. Your data is protected.
            </p>
          </div>

          {/* Aadhaar Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Last 4 Digits of Aadhaar
            </label>
            <div className="relative">
              <input
                type={showAadhaar ? 'text' : 'password'}
                value={aadhaarInput}
                onChange={(e) => setAadhaarInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-center text-2xl tracking-widest font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAadhaar(!showAadhaar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showAadhaar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              For demo, try: 1234, 5678, 9012, or 3456
            </p>
          </div>

          {/* Name Input (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name (Optional - for verification)
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="As per Aadhaar"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerifyAadhaar}
            disabled={loading || aadhaarInput.length !== 4}
            className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center transition ${aadhaarInput.length === 4 && !loading
              ? 'bg-farm-green-500 text-white hover:bg-farm-green-600'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              <>
                Verify & Fetch Records
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && farmerProfile && (
        <div className="space-y-4">
          {/* Verification Status Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Aadhaar */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Aadhaar</span>
                <StatusIcon status={verificationStatus.aadhaar} />
              </div>
              <p className="font-semibold text-gray-800">
                {aadhaarResult?.verified ? 'Verified' : 'Pending'}
              </p>
              {aadhaarResult?.name_verified && (
                <p className="text-xs text-green-600">Name matched</p>
              )}
            </div>

            {/* Land Records */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Land Records</span>
                <StatusIcon status={verificationStatus.land} />
              </div>
              {landRecords ? (
                <>
                  <p className="font-semibold text-gray-800">
                    {landRecords.total_area_hectares} ha
                  </p>
                  <p className="text-xs text-gray-600">
                    {landRecords.district}, {landRecords.state}
                  </p>
                </>
              ) : (
                <p className="text-gray-400">Not found</p>
              )}
            </div>

            {/* Bank Account */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Jan Dhan</span>
                <StatusIcon status={verificationStatus.bank} />
              </div>
              {bankDetails ? (
                <>
                  <p className="font-semibold text-gray-800">
                    {bankDetails.account_masked}
                  </p>
                  <p className="text-xs text-gray-600">{bankDetails.bank_name}</p>
                </>
              ) : (
                <p className="text-gray-400">Not linked</p>
              )}
            </div>

            {/* PM-KISAN */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">PM-KISAN</span>
                <StatusIcon status={verificationStatus.pmKisan} />
              </div>
              {pmKisanStatus?.enrolled ? (
                <>
                  <p className="font-semibold text-gray-800">
                    {pmKisanStatus.installments_received} रु
                  </p>
                  <p className="text-xs text-green-600">
                    ₹{pmKisanStatus.installments_received * 2000} received
                  </p>
                </>
              ) : (
                <p className="text-gray-400">Not enrolled</p>
              )}
            </div>
          </div>

          {/* Farmer Category */}
          {farmerProfile.farmer_category && (
            <div className="bg-gradient-to-r from-farm-green-50 to-green-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Farmer Category</p>
                  <p className="font-bold text-lg text-farm-green-700 capitalize">
                    {farmerProfile.farmer_category} Farmer
                  </p>
                </div>
                <div className="w-12 h-12 bg-farm-green-100 rounded-full flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-farm-green-600" />
                </div>
              </div>
            </div>
          )}

          {/* Scheme Eligibility */}
          {farmerProfile.scheme_eligibility && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">
                Scheme Eligibility (Based on Verified Data)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(farmerProfile.scheme_eligibility).map(([scheme, eligible]) => (
                  <div
                    key={scheme}
                    className={`flex items-center text-sm px-3 py-2 rounded-lg ${eligible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                  >
                    {eligible ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    {scheme.replace(/_/g, ' ').toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DBT Status */}
          {farmerProfile.dbt_ready && (
            <div className="bg-green-100 border border-green-300 rounded-xl p-4 flex items-center">
              <IndianRupee className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="font-semibold text-green-800">DBT Ready ✓</p>
                <p className="text-xs text-green-700">
                  Direct Benefit Transfer enabled for your account
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Consent Modal */}
      <ConsentModal />
    </div>
  );
};

export default JAMTrinityVerification;

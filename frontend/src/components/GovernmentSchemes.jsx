import React, { useMemo, useState } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, IndianRupee, FileText, ChevronDown, ChevronUp, Calendar, Info } from 'lucide-react';
import schemesData from '../data/governmentSchemes.json';
import { useTranslation } from '../i18n';

// Individual scheme card with expandable details
const SchemeCard = ({ scheme, index }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card-farm p-5 transition-all duration-300 animate-fade-in ${scheme.isEligible
        ? 'border-l-4 border-farm-green-500 hover:shadow-xl'
        : 'border-l-4 border-gray-300 opacity-70'
        }`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{scheme.icon}</span>
          <div>
            <h3 className="font-bold text-gray-800">{scheme.name}</h3>
            <p className="text-xs text-gray-500">{scheme.fullName}</p>
          </div>
        </div>
        {scheme.isEligible ? (
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full flex items-center">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('schemes.eligible') || 'Eligible'}
          </span>
        ) : (
          <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t('schemes.checkEligibility') || 'Check'}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {scheme.description}
      </p>

      {/* Benefit Amount */}
      {scheme.potentialBenefit > 0 && (
        <div className="bg-farm-green-50 rounded-lg p-3 mb-3">
          <p className="text-xs text-farm-green-700">{t('schemes.benefits') || 'Potential Benefit'}</p>
          <p className="text-lg font-bold text-farm-green-800">
            ₹{scheme.potentialBenefit.toLocaleString()}
            {scheme.benefitFrequency && <span className="text-xs font-normal">/{scheme.benefitFrequency}</span>}
          </p>
        </div>
      )}

      {/* Eligibility Notes */}
      <div className="mb-3">
        {scheme.eligibilityNotes.map((note, i) => (
          <p key={i} className={`text-xs ${scheme.isEligible ? 'text-green-600' : 'text-orange-600'}`}>
            {note}
          </p>
        ))}
      </div>

      {/* Expandable Documents Section */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 px-3 mb-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700"
      >
        <span className="flex items-center">
          <FileText className="w-4 h-4 mr-2 text-gray-500" />
          {t('schemes.documents') || 'Required Documents'} ({scheme.documents?.length || 0})
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mb-3 animate-fade-in">
          {/* Documents List */}
          <div className="bg-blue-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center">
              <FileText className="w-3 h-3 mr-1" />
              {t('schemes.documents') || 'Required Documents'}:
            </p>
            <ul className="grid grid-cols-2 gap-1">
              {scheme.documents?.map((doc, i) => (
                <li key={i} className="text-xs text-blue-600 flex items-center">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                  {doc}
                </li>
              ))}
            </ul>
          </div>

          {/* How to Apply */}
          <div className="bg-purple-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center">
              <Info className="w-3 h-3 mr-1" />
              {t('schemes.howToApply') || 'How to Apply'}:
            </p>
            <ol className="text-xs text-purple-600 space-y-1">
              <li>1. Visit the official portal below</li>
              <li>2. Register/Login with Aadhaar or mobile</li>
              <li>3. Fill in your details and upload documents</li>
              <li>4. Submit and track your application</li>
            </ol>
          </div>

          {/* Deadline if available */}
          {scheme.enrollmentDeadline && (
            <div className="bg-orange-50 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-orange-700 flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                {t('schemes.deadline') || 'Deadline'}: {scheme.enrollmentDeadline}
              </p>
            </div>
          )}

          {/* Last Updated */}
          {scheme.lastUpdated && (
            <p className="text-xs text-gray-500 mb-2">
              Last updated: {scheme.lastUpdated}
            </p>
          )}
        </div>
      )}

      {/* Apply Button */}
      <a
        href={scheme.applicationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full flex items-center justify-center py-2 px-4 rounded-lg text-sm font-semibold transition-all ${scheme.isEligible
          ? 'bg-farm-green-500 text-white hover:bg-farm-green-600'
          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
      >
        {t('schemes.howToApply') || 'Apply Now'}
        <ExternalLink className="w-4 h-4 ml-2" />
      </a>
    </div>
  );
};

const GovernmentSchemes = ({ formData, simulationData }) => {
  const { t } = useTranslation();

  // Calculate eligible schemes based on farmer inputs
  const eligibleSchemes = useMemo(() => {
    if (!formData) return [];

    return schemesData.schemes.map(scheme => {
      let isEligible = true;
      let eligibilityNotes = [];
      let potentialBenefit = 0;

      // Check area requirements
      if (scheme.eligibility.minArea !== undefined) {
        if (formData.area_hectares < scheme.eligibility.minArea) {
          isEligible = false;
          eligibilityNotes.push(`Requires minimum ${scheme.eligibility.minArea} hectare`);
        }
      }

      // Check crop requirements
      if (scheme.eligibility.crops && !scheme.eligibility.allCrops) {
        if (!scheme.eligibility.crops.includes(formData.crop)) {
          isEligible = false;
          eligibilityNotes.push(`Not available for ${formData.crop}`);
        }
      }

      // Calculate potential benefit
      if (scheme.benefitAmount > 0) {
        if (scheme.id === 'organic-farming') {
          potentialBenefit = scheme.benefitAmount * formData.area_hectares;
        } else {
          potentialBenefit = scheme.benefitAmount;
        }
      } else if (scheme.id === 'msp' && scheme.mspRates2025 && scheme.mspRates2025[formData.crop]) {
        // Calculate MSP benefit compared to current market price
        const mspRate = scheme.mspRates2025[formData.crop];
        if (mspRate > formData.current_market_price) {
          potentialBenefit = (mspRate - formData.current_market_price) *
            (simulationData?.yield?.total_production_quintals || formData.area_hectares * 25);
        }
      } else if (scheme.subsidyRate) {
        // Estimate subsidy benefit
        potentialBenefit = 10000 * (scheme.subsidyRate.smallFarmer || scheme.subsidyRate.general || 40) / 100;
      }

      return {
        ...scheme,
        isEligible,
        eligibilityNotes: eligibilityNotes.length > 0 ? eligibilityNotes : ['✓ All criteria met'],
        potentialBenefit
      };
    });
  }, [formData, simulationData]);

  // Calculate total benefits
  const totalBenefits = useMemo(() => {
    return eligibleSchemes
      .filter(s => s.isEligible && s.potentialBenefit > 0)
      .reduce((sum, s) => sum + s.potentialBenefit, 0);
  }, [eligibleSchemes]);

  // Count eligible schemes
  const eligibleCount = eligibleSchemes.filter(s => s.isEligible).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card-farm card-glow p-6 bg-gradient-to-r from-yellow-50 to-orange-50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              💰 {t('schemes.title') || 'Government Benefits Available'}
            </h2>
            <p className="text-gray-600 mt-1">
              {eligibleCount} {t('schemes.eligible') || 'eligible'} {t('common.of') || 'of'} {eligibleSchemes.length} schemes based on your profile
            </p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl shadow-lg">
            <p className="text-xs opacity-80">{t('schemes.benefits') || 'Total Potential Benefits'}</p>
            <p className="text-2xl font-bold flex items-center">
              <IndianRupee className="w-5 h-5 mr-1" />
              {(totalBenefits / 1000).toFixed(1)}k
            </p>
          </div>
        </div>
      </div>

      {/* Quick Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-3 py-1.5 bg-farm-green-100 text-farm-green-700 rounded-full text-sm font-medium">
          All ({eligibleSchemes.length})
        </span>
        <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
          ✓ Eligible ({eligibleCount})
        </span>
        <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
          Check Eligibility ({eligibleSchemes.length - eligibleCount})
        </span>
      </div>

      {/* Schemes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {eligibleSchemes.map((scheme, index) => (
          <SchemeCard key={scheme.id} scheme={scheme} index={index} />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-xs text-yellow-800">
          <strong>⚠️ Disclaimer:</strong> {schemesData.metadata.disclaimer}
          Last updated: {schemesData.metadata.lastUpdated}
        </p>
      </div>
    </div>
  );
};

export default GovernmentSchemes;

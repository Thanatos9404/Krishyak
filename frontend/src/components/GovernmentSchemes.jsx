import React, { useMemo, useState } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, IndianRupee, FileText, ChevronDown, ChevronUp, Info, Landmark, ShieldAlert } from 'lucide-react';
import schemesData from '../data/governmentSchemes.json';
import { useTranslation } from '../i18n';

const MATCH_CATEGORIES = {
  LIKELY_ELIGIBLE: { id: 'likely', labelKey: 'schemes.likelyEligible', color: 'bg-green-100 text-green-800 border-green-500', icon: CheckCircle },
  NEEDS_VERIFICATION: { id: 'verification', labelKey: 'schemes.needsVerification', color: 'bg-blue-100 text-blue-800 border-blue-500', icon: Info },
  MORE_INFO_REQUIRED: { id: 'more_info', labelKey: 'schemes.moreInfo', color: 'bg-yellow-100 text-yellow-800 border-yellow-500', icon: ShieldAlert },
  INELIGIBLE: { id: 'ineligible', labelKey: 'schemes.notMatched', color: 'bg-gray-100 text-gray-500 border-gray-300', icon: AlertCircle }
};

const translateNote = (t, note) => typeof note === 'string' ? note : t(note.key, note.params || {});
const documentKey = (name = '') => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

const SchemeCard = ({ scheme, index }) => {
  const { t, languageInfo } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const CategoryIcon = scheme.categoryDef.icon;

  return (
    <div
      className={`card-farm p-5 transition-all duration-300 animate-fade-in border-l-4 ${scheme.categoryDef.border} ${
        scheme.matchCategory === 'ineligible' ? 'opacity-60' : 'hover:shadow-xl'
      }`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <span className="w-10 h-10 mr-3 rounded-lg bg-farm-green-50 text-farm-green-700 flex items-center justify-center"><Landmark className="w-5 h-5" /></span>
          <div>
            <h3 className="font-bold text-gray-800">{t(`schemes.catalog.${scheme.id}.name`)}</h3>
            <p className="text-xs text-gray-500">{t(`schemes.catalog.${scheme.id}.fullName`)}</p>
          </div>
        </div>
        
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full flex items-center ${scheme.categoryDef.color}`}>
          <CategoryIcon className="w-3 h-3 mr-1" />
          {t(scheme.categoryDef.labelKey)}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {t('schemes.programDescription')}
      </p>

      {/* Benefit Amount */}
      {scheme.potentialBenefit > 0 && scheme.matchCategory !== 'ineligible' && (
        <div className="bg-farm-green-50 rounded-lg p-3 mb-3 border border-farm-green-100">
          <p className="text-xs text-farm-green-700 font-semibold">{t('schemes.benefits') || 'Potential Benefit'}</p>
          <p className="text-lg font-bold text-farm-green-800">
            ₹{scheme.potentialBenefit.toLocaleString(languageInfo.speechCode)}
            {scheme.benefitFrequency && <span className="text-xs font-normal">/{t(`schemes.frequency.${scheme.benefitFrequency}`)}</span>}
          </p>
        </div>
      )}

      {/* Match Insight Blocks */}
      <div className="mb-3 space-y-2">
        <div className="text-[10px] text-gray-500 font-mono uppercase bg-gray-100 p-2 rounded block">
          <span className="font-bold">{t('schemes.basisOfMatch')}:</span> {scheme.basisOfMatch.map((note) => translateNote(t, note)).join(' | ')}
        </div>
        
        {scheme.whyMatched.length > 0 && (
          <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
            <span className="font-bold text-green-700 flex items-center mb-1"><CheckCircle className="w-3 h-3 mr-1"/> {t('schemes.matches')}:</span>
            <ul className="list-disc pl-4 opacity-90">
              {scheme.whyMatched.map((note, i) => <li key={i}>{translateNote(t, note)}</li>)}
            </ul>
          </div>
        )}
        
        {scheme.missingInfo.length > 0 && scheme.matchCategory !== 'ineligible' && (
          <div className="text-xs text-gray-700 bg-orange-50 p-2 rounded">
            <span className="font-bold text-orange-700 flex items-center mb-1"><ShieldAlert className="w-3 h-3 mr-1"/> {t('schemes.missing')}:</span>
            <ul className="list-disc pl-4 opacity-90">
              {scheme.missingInfo.map((note, i) => <li key={i}>{translateNote(t, note)}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Expandable Documents Section */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-2 px-3 mb-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700 border border-gray-200"
      >
        <span className="flex items-center font-semibold">
          <FileText className="w-4 h-4 mr-2 text-gray-500" />
          {t('schemes.documents') || 'Official Source & Documents'}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mb-3 animate-fade-in">
          {/* Official Verification Notice */}
          <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center">
              <ExternalLink className="w-3 h-3 mr-1" /> {t('schemes.officialSource')}:
            </p>
            <p className="text-[11px] text-blue-700 mb-2 leading-tight">
              {t('schemes.verifyNotice')}
            </p>
            <a href={scheme.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center bg-white px-2 py-1 rounded inline-flex border border-blue-200">
              {scheme.applicationUrl.replace('https://', '')} <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>

          {/* Documents List */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
              <FileText className="w-3 h-3 mr-1" /> {t('schemes.documents')}:
            </p>
            <ul className="grid grid-cols-2 gap-1">
              {scheme.documents?.map((doc, i) => (
                <li key={i} className="text-[11px] text-gray-600 flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                  {t(`schemes.documentNames.${documentKey(doc)}`) || doc}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Apply Button */}
      <a
        href={scheme.applicationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`min-h-11 w-full flex items-center justify-center py-2 px-4 rounded-lg text-sm font-bold transition-all ${
          scheme.matchCategory === 'ineligible' 
          ? 'bg-gray-200 text-gray-500 hover:bg-gray-300' 
          : 'bg-gradient-to-r from-farm-green-600 to-farm-green-700 text-white shadow-md hover:shadow-lg'
        }`}
      >
        {t('schemes.howToApply') || 'Go to Official Portal'}
        <ExternalLink className="w-4 h-4 ml-2" />
      </a>
    </div>
  );
};

const GovernmentSchemes = ({ formData }) => {
  const { t, languageInfo } = useTranslation();
  const evaluatedSchemes = useMemo(() => {
    if (!formData) return [];
    
    // Safety check - If user hasn't put in basic land details, they need more info broadly
    const hasBasicData = !!(formData.area_hectares && formData.crop);

    return schemesData.schemes.map(scheme => {
      let whyMatched = [];
      let missingInfo = [];
      let basisOfMatch = [];
      let matchCategory = hasBasicData ? MATCH_CATEGORIES.LIKELY_ELIGIBLE.id : MATCH_CATEGORIES.MORE_INFO_REQUIRED.id;
      let potentialBenefit = 0;

      if (!hasBasicData) {
        missingInfo.push({ key: 'schemes.notes.enterFarmData' });
        basisOfMatch.push({ key: 'schemes.notes.noData' });
      } else {
        basisOfMatch.push({ key: 'schemes.notes.area', params: { area: formData.area_hectares } });
        const translatedCrop = t(`crops.${formData.crop.toLowerCase()}`) || formData.crop;
        basisOfMatch.push({ key: 'schemes.notes.crop', params: { crop: translatedCrop } });
        
        // 1. Evaluate Area Matches
        if (scheme.eligibility.minArea !== undefined) {
          if (formData.area_hectares < scheme.eligibility.minArea) {
            matchCategory = MATCH_CATEGORIES.INELIGIBLE.id;
            missingInfo.push({ key: 'schemes.notes.minimumArea', params: { minimum: scheme.eligibility.minArea, area: formData.area_hectares } });
          } else {
            whyMatched.push({ key: 'schemes.notes.areaMatches', params: { area: formData.area_hectares } });
          }
        }
        
        if (scheme.eligibility.requiresLand) {
          if (formData.area_hectares <= 0) {
            matchCategory = MATCH_CATEGORIES.INELIGIBLE.id;
            missingInfo.push({ key: 'schemes.notes.landRequired' });
          } else {
            whyMatched.push({ key: 'schemes.notes.landMatches' });
          }
        }
        
        // 2. Evaluate Crop Matches
        if (scheme.eligibility.crops && !scheme.eligibility.allCrops) {
          if (!scheme.eligibility.crops.includes(formData.crop)) {
            matchCategory = MATCH_CATEGORIES.INELIGIBLE.id;
            missingInfo.push({ key: 'schemes.notes.cropNotSupported', params: { crop: translatedCrop } });
          } else {
            whyMatched.push({ key: 'schemes.notes.cropMatches', params: { crop: translatedCrop } });
          }
        } else if (scheme.eligibility.allCrops) {
           whyMatched.push({ key: 'schemes.notes.allCrops' });
        }

        // 3. Evaluate Soft Variables (Flags that trigger "Needs Verification")
        if (matchCategory !== MATCH_CATEGORIES.INELIGIBLE.id) {
          if (scheme.eligibility.requiresCluster) {
            matchCategory = MATCH_CATEGORIES.NEEDS_VERIFICATION.id;
            missingInfo.push({ key: 'schemes.notes.clusterRequired' });
          }
          if (scheme.eligibility.irrigationType) {
            matchCategory = MATCH_CATEGORIES.NEEDS_VERIFICATION.id;
            missingInfo.push({ key: 'schemes.notes.irrigationRequired' });
          }
          if (scheme.eligibility.loanee !== undefined) {
            matchCategory = MATCH_CATEGORIES.NEEDS_VERIFICATION.id;
            missingInfo.push({ key: 'schemes.notes.bankVerification' });
          }
        }

        // 4. Benefit calculations string
        if (matchCategory !== MATCH_CATEGORIES.INELIGIBLE.id && scheme.benefitAmount > 0) {
          if (scheme.id === 'organic-farming') {
            potentialBenefit = scheme.benefitAmount * formData.area_hectares;
          } else {
            potentialBenefit = scheme.benefitAmount;
          }
        }
      }

      const categoryDef = Object.values(MATCH_CATEGORIES).find(c => c.id === matchCategory);

      return {
        ...scheme,
        matchCategory,
        categoryDef,
        basisOfMatch,
        whyMatched,
        missingInfo,
        potentialBenefit
      };
    });
  }, [formData, t]);

  const totalBenefits = useMemo(() => {
    return evaluatedSchemes
      .filter(s => s.matchCategory === MATCH_CATEGORIES.LIKELY_ELIGIBLE.id || s.matchCategory === MATCH_CATEGORIES.NEEDS_VERIFICATION.id)
      .reduce((sum, s) => sum + s.potentialBenefit, 0);
  }, [evaluatedSchemes]);

  const categoryCounts = evaluatedSchemes.reduce((acc, s) => {
    acc[s.matchCategory] = (acc[s.matchCategory] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card-farm card-glow p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Landmark className="h-6 w-6 text-blue-700" aria-hidden="true" />
              {t('schemes.headerTitle')}
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-xl">
              {t('schemes.headerSubtitle')}
            </p>
          </div>
          <div className="bg-white border-2 border-green-500 text-gray-800 px-6 py-3 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-green-600 uppercase">{t('schemes.estimatedSupport')}</p>
            <p className="text-2xl font-black flex items-center">
              <IndianRupee className="w-5 h-5 mr-1 text-green-600" />
              {(totalBenefits / 1000).toLocaleString(languageInfo.speechCode, { maximumFractionDigits: 1 })}k
            </p>
          </div>
        </div>
      </div>

      {/* Honest Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-3 py-1.5 bg-gray-800 text-white rounded-full text-xs font-bold shadow-sm">
          {t('schemes.tracking', { count: evaluatedSchemes.length })}
        </span>
        <span className="px-3 py-1.5 bg-green-100 text-green-800 border border-green-200 rounded-full text-xs font-bold">
          {t('schemes.likelyEligible')} ({categoryCounts[MATCH_CATEGORIES.LIKELY_ELIGIBLE.id] || 0})
        </span>
        <span className="px-3 py-1.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-xs font-bold">
          {t('schemes.needsVerification')} ({categoryCounts[MATCH_CATEGORIES.NEEDS_VERIFICATION.id] || 0})
        </span>
        <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-full text-xs font-bold">
          {t('schemes.moreInfo')} ({categoryCounts[MATCH_CATEGORIES.MORE_INFO_REQUIRED.id] || 0})
        </span>
        <span className="px-3 py-1.5 bg-gray-100 text-gray-800 border border-gray-200 rounded-full text-xs font-bold">
          {t('schemes.notMatched')} ({categoryCounts[MATCH_CATEGORIES.INELIGIBLE.id] || 0})
        </span>
      </div>

      {/* Schemes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evaluatedSchemes.sort((a,b) => {
          // Sort Likely -> Verification -> More Info -> Ineligible
          const sortOrder = { 'likely': 1, 'verification': 2, 'more_info': 3, 'ineligible': 4 };
          return sortOrder[a.matchCategory] - sortOrder[b.matchCategory];
        }).map((scheme, index) => (
          <SchemeCard key={scheme.id} scheme={scheme} index={index} />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3 items-start">
        <ShieldAlert className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-gray-600">
          {t('schemes.transparencyNote')}
        </p>
      </div>
    </div>
  );
};

export default GovernmentSchemes;

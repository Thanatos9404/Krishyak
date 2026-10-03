import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Mic, X, Check, RefreshCw, AlertCircle, Type, MicOff, Square } from 'lucide-react';
import useVoiceRecognition, { parseVoiceCommand, STATUS } from '../hooks/useVoiceRecognition';
import { useTranslation } from '../i18n';
import { trapDialogFocus } from '../utils/dialogFocus';

const CROP_TRANSLATION_KEYS = {
  Rice: 'rice', Wheat: 'wheat', Maize: 'maize', Cotton: 'cotton', Sugarcane: 'sugarcane',
  Soybean: 'soybean', Groundnut: 'groundnut', Mustard: 'mustard', Potato: 'potato',
  Tomato: 'tomato', Onion: 'onion', Chilli: 'chilli', Mango: 'mango', Banana: 'banana',
  Grapes: 'grapes', Bajra: 'bajra', Jowar: 'jowar', Chickpea: 'chickpea', Lentil: 'lentil',
  Moong: 'moong', Turmeric: 'turmeric', Ginger: 'ginger', Garlic: 'garlic', Spinach: 'spinach',
  Cabbage: 'cabbage', Cauliflower: 'cauliflower', Carrot: 'carrot', Okra: 'okra', Brinjal: 'brinjal',
  Watermelon: 'watermelon', Orange: 'orange', Guava: 'guava', Pomegranate: 'pomegranate',
  Apple: 'apple', Papaya: 'papaya', Lemon: 'lemon', Cumin: 'cumin', Coriander: 'coriander',
  Fenugreek: 'fenugreek',
};

const SOIL_TRANSLATION_KEYS = {
  Alluvial: 'alluvial', Black: 'black', Red: 'red', Loamy: 'loamy', Clay: 'clay', Sandy: 'sandy',
  Laterite: 'laterite', Mountain: 'mountain',
};

/**
 * Voice Input Modal with Text Fallback
 * 
 * Features:
 * - Voice input when available
 * - Automatic fallback to text input on errors
 * - Manual text entry option always available
 * - Works offline via text input
 */
const VoiceInputModal = ({ isOpen, onClose, onApply }) => {
  const { t, languageInfo, speechCode, speechCodes } = useTranslation();
  const [parsedData, setParsedData] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [textInput, setTextInput] = useState('');
  const [resultDraft, setResultDraft] = useState('');
  const textInputRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialogRef.current?.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [isOpen]);

  const localizedTerms = useMemo(() => ({
    crops: Object.fromEntries(Object.entries(CROP_TRANSLATION_KEYS).map(([name, key]) => [name, t(`crops.${key}`)])),
    soils: Object.fromEntries(Object.entries(SOIL_TRANSLATION_KEYS).map(([name, key]) => [name, t(`soils.${key}`)])),
    units: { hectare: t('units.hectare'), acre: t('units.acre'), bigha: t('units.bigha') },
    levels: { low: t('sidebar.low'), medium: t('sidebar.medium'), high: t('sidebar.high') },
    pestWord: t('voiceNew.params.pestRisk'),
  }), [t]);

  const phraseHints = useMemo(() => [
    ...Object.values(localizedTerms.crops),
    ...Object.values(localizedTerms.soils),
    ...Object.values(localizedTerms.units),
    ...Object.values(localizedTerms.levels),
    localizedTerms.pestWord,
    'kharif', 'rabi', 'NPK', 'DAP', 'urea', 'bigha', 'beegha',
  ].filter(Boolean), [localizedTerms]);

  const errorMessages = useMemo(() => ({
    limitReached: t('speech.limitReached'),
    microphoneDenied: t('voiceErrors.microphoneDenied') || t('voice.notSupported'),
    noMicrophone: t('voiceErrors.noMicrophone') || t('voice.notSupported'),
    network: t('voiceErrors.network') || t('voice.notSupported'),
    serviceUnavailable: t('voiceErrors.serviceUnavailable') || t('voice.notSupported'),
    languageUnavailable: (t('voiceErrors.languageUnavailable') || t('voice.notSupported')).replace('{{language}}', languageInfo.nativeName),
    notAvailable: t('voiceErrors.notAvailable') || t('voice.notSupported'),
    noMatch: t('voiceErrors.noMatch') || t('voiceNew.noParamsHint'),
  }), [t, languageInfo.nativeName]);

  const {
    isListening, transcript, error, isSupported, status, startListening,
    stopListening, resetTranscript, setManualTranscript, confidence, activeSpeechCode,
  } = useVoiceRecognition({ speechCode, speechCodes, phraseHints, errorMessages });

  useEffect(() => {
    if (!isOpen) resetTranscript();
  }, [isOpen, resetTranscript]);

  // Auto-switch to text mode if voice not supported or error occurs
  useEffect(() => {
    if (!isSupported || status === STATUS.ERROR || status === STATUS.NO_SUPPORT) {
      setInputMode('text');
    }
  }, [isSupported, status]);

  // Parse transcript when we have text and stopped listening
  useEffect(() => {
    if (transcript && status === STATUS.IDLE && !isListening && inputMode === 'voice') {
      const parsed = parseVoiceCommand(transcript, localizedTerms);
      setParsedData(parsed);
      setResultDraft(transcript);
      setShowResults(true);
    }
  }, [transcript, status, isListening, inputMode, localizedTerms]);

  // Focus text input when switching to text mode
  useEffect(() => {
    if (inputMode === 'text' && textInputRef.current && isOpen) {
      textInputRef.current.focus();
    }
  }, [inputMode, isOpen]);

  const handleStart = async () => {
    resetTranscript();
    setParsedData({});
    setShowResults(false);
    setTextInput('');
    setResultDraft('');
    const success = await startListening();
    if (!success) {
      setInputMode('text');
    }
  };

  const handleStop = () => {
    stopListening();
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;

    // Use the text input as transcript
    setManualTranscript(textInput);
    const parsed = parseVoiceCommand(textInput, localizedTerms);
    setParsedData(parsed);
    setResultDraft(textInput);
    setShowResults(true);
  };

  const handleResultEdit = (value) => {
    setResultDraft(value);
    setParsedData(parseVoiceCommand(value, localizedTerms));
  };

  const handleApply = () => {
    if (Object.keys(parsedData).length > 0) {
      onApply(parsedData);
    }
    handleClose();
  };

  const handleRetry = () => {
    resetTranscript();
    setParsedData({});
    setShowResults(false);
    setTextInput('');
    setResultDraft('');

    if (inputMode === 'voice' && isSupported) {
      startListening();
    } else {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }
  };

  const handleClose = () => {
    stopListening();
    resetTranscript();
    setParsedData({});
    setShowResults(false);
    setTextInput('');
    setResultDraft('');
    onClose();
  };

  const toggleInputMode = () => {
    stopListening();
    resetTranscript();
    setParsedData({});
    setShowResults(false);
    setTextInput('');
    setResultDraft('');
    setInputMode(prev => prev === 'voice' ? 'text' : 'voice');
  };

  if (!isOpen) return null;

  const hasResults = Object.keys(parsedData).length > 0;
  const displayTranscript = resultDraft || (inputMode === 'voice' ? transcript : textInput);
  const displayCrop = parsedData.crop
    ? (t(`crops.${CROP_TRANSLATION_KEYS[parsedData.crop]}`) || parsedData.crop)
    : '';
  const displaySoil = parsedData.soil_type
    ? (t(`soils.${SOIL_TRANSLATION_KEYS[parsedData.soil_type]}`) || parsedData.soil_type)
    : '';

  return (
    <dialog ref={dialogRef} className="voice-dialog" aria-label={t('voice.title')} onCancel={handleClose} onKeyDown={trapDialogFocus}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-green-800 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                {inputMode === 'voice' ? <Mic className="w-5 h-5" /> : <Type className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {inputMode === 'voice'
                    ? (t('voice.title') || 'Voice Input')
                    : (t('voiceNew.textInput') || 'Text Input')
                  }
                </h2>
                <p className="text-sm text-white/80">{languageInfo.nativeName} · {t('voice.speakNow')}</p>
              </div>
            </div>
            <button
              autoFocus
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label={t('common.close') || 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showResults ? (
            /* Input Mode */
            <>
              {/* Mode Toggle - Only show if voice is supported */}
              {isSupported && (
                <div className="flex justify-center mb-4">
                  <div className="inline-flex bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => inputMode !== 'voice' && toggleInputMode()}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'voice'
                          ? 'bg-white shadow text-green-800'
                          : 'text-gray-600 hover:text-gray-800'
                        }`}
                    >
                      <Mic className="w-4 h-4" />
                      {t('voiceNew.voiceMode') || 'Voice'}
                    </button>
                    <button
                      onClick={() => inputMode !== 'text' && toggleInputMode()}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'text'
                          ? 'bg-white shadow text-green-800'
                          : 'text-gray-600 hover:text-gray-800'
                        }`}
                    >
                      <Type className="w-4 h-4" />
                      {t('voiceNew.textMode') || 'Type'}
                    </button>
                  </div>
                </div>
              )}

              {inputMode === 'voice' ? (
                /* Voice Input Mode */
                <>
                  {/* Mic Button */}
                  <div className="flex flex-col items-center py-6">
                    <p className="mb-4 max-w-sm text-center text-xs text-gray-600">{t('speech.privacyNotice')}</p>
                    {isListening ? (
                      <button
                        onClick={handleStop}
                        aria-label={t('voice.stopListening')}
                        className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 animate-pulse"
                      >
                        <Square className="h-8 w-8 fill-white text-white" aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        onClick={handleStart}
                        disabled={status === STATUS.PROCESSING}
                        aria-label={t('voice.startListening')}
                      className="w-24 h-24 rounded-full bg-green-700 flex items-center justify-center shadow-lg hover:bg-green-800 transition-colors"
                      >
                        <Mic className="w-10 h-10 text-white" />
                      </button>
                    )}

                    <p className="mt-4 text-sm font-medium text-gray-600">
                      {isListening ? (
                        <span className="text-red-500 flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          {t('voice.stopListening')}
                        </span>
                      ) : (
                        status === STATUS.PROCESSING ? t('common.loading') : t('voice.startListening')
                      )}
                    </p>
                  </div>

                  {/* Live Transcript */}
                  <div className={`bg-gray-50 rounded-xl p-4 min-h-[80px] border-2 ${isListening ? 'border-green-400 bg-green-50/50' : 'border-gray-200'}`}>
                    <p className="text-xs text-gray-500 mb-2 font-medium">
                      {status === STATUS.PROCESSING ? t('common.loading') : isListening ? t('voice.listening') : t('voice.speakNow')}
                    </p>
                    {transcript ? (
                      <p className="text-gray-800 font-medium">{transcript}</p>
                    ) : (
                      <p className="text-gray-400 italic">
                        {t('voice.speakNow')}
                      </p>
                    )}
                    {isListening && activeSpeechCode !== speechCode && (
                      <p className="mt-2 text-xs text-gray-500">
                        {t('voiceNew.recognitionUsing', { code: activeSpeechCode })}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                /* Text Input Mode */
                <>
                  <div className="py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Type className="w-5 h-5 text-green-700" />
                      <span className="text-sm font-medium text-gray-700">
                        {t('voiceNew.typeCommand') || 'Type your farming details'}
                      </span>
                    </div>

                    <textarea
                      ref={textInputRef}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleTextSubmit();
                        }
                      }}
                      placeholder={t('voiceNew.textPlaceholder') || "e.g., Rice 2 hectare black soil Nashik"}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none resize-none transition-all"
                      rows={3}
                    />

                    <button
                      onClick={handleTextSubmit}
                      disabled={!textInput.trim()}
                      className="mt-3 w-full py-3 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('voiceNew.parseText') || 'Parse Text →'}
                    </button>
                  </div>
                </>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 bg-amber-50 text-amber-700 rounded-xl p-4 border border-amber-200">
                  <p className="text-sm flex items-start gap-2">
                    <MicOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {error}
                      {inputMode === 'voice' && (
                        <button
                          onClick={() => setInputMode('text')}
                          className="ml-2 underline font-medium hover:text-amber-800"
                        >
                          {t('voiceNew.useTextInstead') || 'Use text input instead'}
                        </button>
                      )}
                    </span>
                  </p>
                </div>
              )}

              {/* Example Commands */}
              <div className="mt-4 bg-stone-100 rounded-xl p-4">
                <p className="text-xs text-green-800 font-semibold mb-2">{t('voiceNew.trySaying')}</p>
                <p className="text-sm text-stone-700">{t('voice.example')}</p>
              </div>
            </>
          ) : (
            /* Results Mode */
            <>
              {/* Transcript */}
              <div className="bg-gray-100 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-1">
                  {inputMode === 'voice' ? t('voiceNew.youSaid') : (t('voiceNew.youTyped') || 'You typed:')}
                </p>
                <label htmlFor="voice-result-correction" className="sr-only">{t('voiceNew.correctTranscript')}</label>
                <textarea
                  id="voice-result-correction"
                  value={displayTranscript}
                  onChange={(event) => handleResultEdit(event.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-800 font-medium resize-none focus:border-green-600 focus:ring-2 focus:ring-green-100 outline-none"
                  rows={2}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{t('voiceNew.correctTranscript')}</span>
                  {confidence !== null && <span>{t('voiceNew.confidence')}: {Math.round(confidence * 100)}%</span>}
                </div>
              </div>

              {/* Parsed Results */}
              {hasResults ? (
                <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">{t('voice.detected')}</span>
                  </div>
                  <div className="space-y-2">
                    {parsedData.crop && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">{t('sidebar.cropSelection')}</span>
                        <span className="font-bold text-green-700">{displayCrop}</span>
                      </div>
                    )}
                    {parsedData.area_hectares && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">{t('sidebar.farmArea')}</span>
                        <span className="font-bold text-green-700">{parsedData.area_hectares} {t('units.hectares')}</span>
                      </div>
                    )}
                    {parsedData.soil_type && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">{t('sidebar.soilType')}</span>
                        <span className="font-bold text-amber-700">{displaySoil}</span>
                      </div>
                    )}
                    {parsedData.location && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">{t('registration.village')}</span>
                        <span className="font-bold text-blue-700">{parsedData.location}</span>
                      </div>
                    )}
                    {parsedData.expected_rainfall && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">{t('sidebar.rainfall')}</span>
                        <span className="font-bold text-blue-700">{parsedData.expected_rainfall} mm</span>
                      </div>
                    )}
                    {parsedData.pest_probability !== undefined && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">{t('sidebar.pestRisk')}</span>
                        <span className="font-bold text-orange-700">{(parsedData.pest_probability * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {parsedData.seed_quality !== undefined && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">{t('sidebar.seedQuality')}</span>
                        <span className="font-bold text-green-700">{(parsedData.seed_quality * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-xl p-4 mb-6 border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-800">{t('voiceNew.noParams') || "No parameters detected"}</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-2">
                    {t('voiceNew.noParamsHint')}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('voiceNew.tryAgain')}
                </button>
                <button
                  onClick={handleApply}
                  disabled={!hasResults}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  {t('voice.apply')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default VoiceInputModal;

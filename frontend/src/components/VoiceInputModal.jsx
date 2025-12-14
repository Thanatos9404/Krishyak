import React, { useState, useEffect } from 'react';
import { Mic, X, Check, RefreshCw, AlertCircle } from 'lucide-react';
import useVoiceRecognition, { parseVoiceCommand } from '../hooks/useVoiceRecognition';

/**
 * Voice Input Modal - Simple and reliable voice input for farming parameters
 */
const VoiceInputModal = ({ isOpen, onClose, onApply }) => {
  const [parsedData, setParsedData] = useState({});
  const [showResults, setShowResults] = useState(false);

  const {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useVoiceRecognition();

  // Parse transcript when we have text and stopped listening
  useEffect(() => {
    if (transcript && !isListening) {
      const parsed = parseVoiceCommand(transcript);
      setParsedData(parsed);
      setShowResults(true);
    }
  }, [transcript, isListening]);

  const handleStart = () => {
    resetTranscript();
    setParsedData({});
    setShowResults(false);
    startListening();
  };

  const handleStop = () => {
    stopListening();
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
    startListening();
  };

  const handleClose = () => {
    stopListening();
    resetTranscript();
    setParsedData({});
    setShowResults(false);
    onClose();
  };

  if (!isOpen) return null;

  const hasResults = Object.keys(parsedData).length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Voice Input</h2>
                <p className="text-sm text-white/80">Speak in Hindi or English</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isSupported ? (
            /* Browser not supported */
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-600 font-medium">Voice input not supported</p>
              <p className="text-sm text-gray-500 mt-2">Please use Chrome, Edge, or Safari</p>
            </div>
          ) : !showResults ? (
            /* Recording Mode */
            <>
              {/* Mic Button */}
              <div className="flex flex-col items-center py-8">
                {isListening ? (
                  <button
                    onClick={handleStop}
                    className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 animate-pulse"
                  >
                    <div className="w-8 h-8 bg-white rounded-sm" />
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                  >
                    <Mic className="w-10 h-10 text-white" />
                  </button>
                )}

                <p className="mt-4 text-sm font-medium text-gray-600">
                  {isListening ? (
                    <span className="text-red-500 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Listening... Click to stop
                    </span>
                  ) : (
                    'Click to start speaking'
                  )}
                </p>
              </div>

              {/* Live Transcript */}
              <div className={`bg-gray-50 rounded-xl p-4 min-h-[80px] border-2 ${isListening ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200'}`}>
                <p className="text-xs text-gray-500 mb-2 font-medium">
                  {isListening ? '🎙️ Listening...' : '📝 Your speech will appear here'}
                </p>
                {transcript ? (
                  <p className="text-gray-800 font-medium">{transcript}</p>
                ) : (
                  <p className="text-gray-400 italic">
                    {isListening ? 'Speak now...' : 'Press the mic button to start'}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 bg-red-50 text-red-600 rounded-xl p-4 border border-red-200">
                  <p className="text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                </div>
              )}

              {/* Example Commands */}
              <div className="mt-4 bg-indigo-50 rounded-xl p-4">
                <p className="text-xs text-indigo-700 font-semibold mb-2">💡 Try saying:</p>
                <ul className="text-sm text-indigo-600 space-y-1">
                  <li>• "Rice farming 2 hectare in Nashik"</li>
                  <li>• "Dhaan ki kheti do hectare black soil"</li>
                  <li>• "Cotton 5 acres good seed low pest"</li>
                  <li>• "Wheat gehun teen hectare alluvial"</li>
                </ul>
              </div>
            </>
          ) : (
            /* Results Mode */
            <>
              {/* Transcript */}
              <div className="bg-gray-100 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-1">You said:</p>
                <p className="text-gray-800 font-medium">{transcript}</p>
              </div>

              {/* Parsed Results */}
              {hasResults ? (
                <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">Detected Parameters</span>
                  </div>
                  <div className="space-y-2">
                    {parsedData.crop && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">🌾 Crop</span>
                        <span className="font-bold text-green-700">{parsedData.crop}</span>
                      </div>
                    )}
                    {parsedData.area_hectares && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">📐 Area</span>
                        <span className="font-bold text-green-700">{parsedData.area_hectares} hectares</span>
                      </div>
                    )}
                    {parsedData.soil_type && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">🏔️ Soil Type</span>
                        <span className="font-bold text-amber-700">{parsedData.soil_type}</span>
                      </div>
                    )}
                    {parsedData.location && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">📍 Location</span>
                        <span className="font-bold text-blue-700">{parsedData.location}</span>
                      </div>
                    )}
                    {parsedData.expected_rainfall && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">🌧️ Rainfall</span>
                        <span className="font-bold text-blue-700">{parsedData.expected_rainfall} mm</span>
                      </div>
                    )}
                    {parsedData.pest_probability !== undefined && (
                      <div className="flex justify-between py-1 border-b border-green-200">
                        <span className="text-gray-600">🐛 Pest Risk</span>
                        <span className="font-bold text-orange-700">{(parsedData.pest_probability * 100).toFixed(0)}%</span>
                      </div>
                    )}
                    {parsedData.seed_quality !== undefined && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">🌱 Seed Quality</span>
                        <span className="font-bold text-green-700">{(parsedData.seed_quality * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-xl p-4 mb-6 border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-800">No parameters detected</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-2">
                    Try including specific terms like crop names (rice, wheat), area (2 hectare),
                    or soil type (black, alluvial).
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
                  Try Again
                </button>
                <button
                  onClick={handleApply}
                  disabled={!hasResults}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Apply
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceInputModal;

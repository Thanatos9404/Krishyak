/**
 * Multilingual Voice Recognition Hook
 * Enhanced version with support for 12+ Indian languages
 * Uses Web Speech API with language-aware configuration
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { SUPPORTED_LANGUAGES, getSpeechCode } from '../i18n/config';

/**
 * Professional Voice Recognition Hook with Multilingual Support
 * Uses continuous mode with auto-restart for reliable speech capture
 */
const useMultilingualVoiceRecognition = (options = {}) => {
  const {
    language = 'en',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(language);

  const recognitionRef = useRef(null);
  const shouldBeListeningRef = useRef(false);

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Get speech recognition language code
  const getSpeechLanguageCode = useCallback((langCode) => {
    // Map language codes to Web Speech API codes
    const speechCodes = {
      'en': 'en-IN',  // English-India for Hinglish support
      'hi': 'hi-IN',
      'mr': 'mr-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'bn': 'bn-IN',
      'gu': 'gu-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'pa': 'pa-IN',
      'or': 'or-IN',
      'as': 'as-IN',
      'ur': 'ur-IN',
    };
    return speechCodes[langCode] || 'en-IN';
  }, []);

  // Initialize recognition object
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Configuration
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = getSpeechLanguageCode(currentLanguage);
    recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          final += text + ' ';
          // Call onResult callback with final result
          if (onResult) {
            onResult(text, result[0].confidence, currentLanguage);
          }
        } else {
          interim += text;
        }
      }

      // Update transcripts
      if (final) {
        setTranscript(prev => (prev + final).trim());
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.log('Speech error:', event.error);

      // Handle specific errors
      switch (event.error) {
        case 'not-allowed':
          setError('Microphone access denied. Please allow microphone access.');
          shouldBeListeningRef.current = false;
          setIsListening(false);
          break;
        case 'no-speech':
          // No speech detected - this is normal, don't show error
          // Recognition will end and restart automatically
          break;
        case 'audio-capture':
          setError('No microphone found. Please connect a microphone.');
          shouldBeListeningRef.current = false;
          setIsListening(false);
          break;
        case 'network':
          // Network error - try to restart
          console.log('Network error, will try to restart...');
          break;
        case 'language-not-supported':
          setError(`Language ${currentLanguage} is not supported on this device.`);
          // Fallback to English
          recognition.lang = 'en-IN';
          break;
        default:
          if (onError) onError(event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we should still be listening
      if (shouldBeListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.log('Could not restart recognition:', e);
          setIsListening(false);
          shouldBeListeningRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [isSupported, currentLanguage, continuous, interimResults, getSpeechLanguageCode, onResult, onError]);

  // Update language when prop changes
  useEffect(() => {
    if (language !== currentLanguage) {
      setCurrentLanguage(language);

      // Update recognition language if it exists
      if (recognitionRef.current) {
        recognitionRef.current.lang = getSpeechLanguageCode(language);
      }
    }
  }, [language, currentLanguage, getSpeechLanguageCode]);

  const startListening = useCallback((langOverride) => {
    if (!recognitionRef.current) {
      setError('Speech recognition not available');
      return;
    }

    // Update language if override provided
    if (langOverride && langOverride !== currentLanguage) {
      setCurrentLanguage(langOverride);
      recognitionRef.current.lang = getSpeechLanguageCode(langOverride);
    }

    setError(null);
    setTranscript('');
    setInterimTranscript('');
    shouldBeListeningRef.current = true;

    try {
      recognitionRef.current.start();
    } catch (e) {
      // If already started, stop and restart
      if (e.name === 'InvalidStateError') {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            if (shouldBeListeningRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          }, 100);
        } catch (e2) {
          console.error('Failed to restart:', e2);
          setError('Could not start voice recognition. Please refresh.');
          shouldBeListeningRef.current = false;
        }
      } else {
        console.error('Start error:', e);
        setError('Could not start voice recognition.');
        shouldBeListeningRef.current = false;
      }
    }
  }, [currentLanguage, getSpeechLanguageCode]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  // Change language on the fly
  const changeLanguage = useCallback((langCode) => {
    const wasListening = isListening;

    if (wasListening) {
      stopListening();
    }

    setCurrentLanguage(langCode);

    if (recognitionRef.current) {
      recognitionRef.current.lang = getSpeechLanguageCode(langCode);
    }

    // Restart if was listening
    if (wasListening) {
      setTimeout(() => startListening(langCode), 100);
    }
  }, [isListening, stopListening, startListening, getSpeechLanguageCode]);

  return {
    // State
    isListening,
    transcript,
    interimTranscript,
    fullTranscript: transcript + (interimTranscript ? ` ${interimTranscript}` : ''),
    error,
    isSupported,
    currentLanguage,

    // Actions
    startListening,
    stopListening,
    resetTranscript,
    changeLanguage,

    // Available languages for voice
    supportedLanguages: Object.keys(SUPPORTED_LANGUAGES).filter(lang => {
      // All Indian languages should work with Web Speech API
      return true;
    }),
  };
};

/**
 * Parse multilingual voice command to extract farming parameters
 * Enhanced with support for more Indian languages
 */
export const parseMultilingualVoiceCommand = (transcript, language = 'en') => {
  if (!transcript || typeof transcript !== 'string') {
    return {};
  }

  const params = {};
  const text = transcript.toLowerCase().trim();

  // ========== CROP DETECTION ==========
  const crops = {
    'Rice': ['rice', 'paddy', 'dhan', 'dhaan', 'chawal', 'chaval', 'धान', 'चावल',
      'भात', 'तांदूळ', 'நெல்', 'వరి', 'ধান'],
    'Wheat': ['wheat', 'gehun', 'gehu', 'gehoon', 'gahu', 'गेहूं', 'गेहुं',
      'गहू', 'கோதுமை', 'గోధుమ', 'গম'],
    'Maize': ['maize', 'corn', 'makka', 'makkai', 'bhutta', 'मक्का', 'मकई',
      'मका', 'சோளம்', 'మొక్కజొన్న', 'ভুট্টা'],
    'Cotton': ['cotton', 'kapas', 'kapaas', 'कपास', 'रुई', 'कापूस',
      'பருத்தி', 'పత్తి', 'তুলা'],
    'Sugarcane': ['sugarcane', 'ganna', 'ganne', 'sugar cane', 'गन्ना',
      'ऊस', 'கரும்பு', 'చెరకు', 'আখ'],
    'Soybean': ['soybean', 'soya', 'soyabean', 'सोयाबीन', 'सोयाबीन'],
    'Groundnut': ['groundnut', 'peanut', 'moongfali', 'mungfali', 'मूंगफली',
      'शेंगदाणे', 'நிலக்கடலை', 'వేరుశెనగ', 'চিনাবাদাম'],
    'Potato': ['potato', 'aloo', 'aalu', 'aaloo', 'आलू', 'बटाटा',
      'உருளைக்கிழங்கு', 'బంగాళాదుంప', 'আলু'],
    'Tomato': ['tomato', 'tamatar', 'टमाटर', 'தக்காளி', 'టమాటో', 'টমেটো'],
    'Onion': ['onion', 'pyaz', 'pyaaz', 'kanda', 'प्याज', 'कांदा',
      'வெங்காயம்', 'ఉల్లిపాయ', 'পেঁয়াজ'],
    'Chilli': ['chilli', 'chili', 'mirch', 'mirchi', 'मिर्च', 'मिरची',
      'மிளகாய்', 'మిరపకాయ', 'মরিচ'],
  };

  for (const [cropName, keywords] of Object.entries(crops)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        params.crop = cropName;
        break;
      }
    }
    if (params.crop) break;
  }

  // ========== AREA DETECTION (Multilingual numbers) ==========
  const numberWords = {
    // English
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10, 'half': 0.5,
    // Hindi
    'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5, 'panch': 5,
    'chhe': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
    'aadha': 0.5, 'dedh': 1.5, 'dhai': 2.5,
    // Devanagari
    'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5,
    'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
    'आधा': 0.5, 'डेढ़': 1.5, 'ढाई': 2.5,
  };

  // Try word numbers
  for (const [word, value] of Object.entries(numberWords)) {
    const patterns = [
      new RegExp(`\\b${word}\\s*(hectare|hector|hect|हेक्टेयर|हेक्टर)s?\\b`, 'i'),
      new RegExp(`\\b${word}\\s*(acre|एकड़)s?\\b`, 'i'),
      new RegExp(`\\b${word}\\s*(bigha|बीघा)s?\\b`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        let area = value;
        if (text.match(/acre|एकड़/i)) {
          area = value * 0.4047;
        } else if (text.match(/bigha|बीघा/i)) {
          area = value * 0.25;
        }
        params.area_hectares = parseFloat(area.toFixed(2));
        break;
      }
    }
    if (params.area_hectares) break;
  }

  // Try numeric
  if (!params.area_hectares) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(hectare|hector|hect|acre|bigha|हेक्टेयर|एकड़|बीघा)s?/i);
    if (numMatch) {
      let area = parseFloat(numMatch[1]);
      const unit = numMatch[2].toLowerCase();
      if (unit.includes('acre') || unit.includes('एकड़')) {
        area = area * 0.4047;
      } else if (unit.includes('bigha') || unit.includes('बीघा')) {
        area = area * 0.25;
      }
      params.area_hectares = parseFloat(area.toFixed(2));
    }
  }

  // ========== SOIL TYPE DETECTION ==========
  const soils = {
    'Alluvial': ['alluvial', 'jalodh', 'river soil', 'जलोढ़', 'गाळाची'],
    'Black': ['black soil', 'black', 'kali mitti', 'kaali', 'regur', 'काली', 'काळी'],
    'Red': ['red soil', 'red', 'lal mitti', 'laal', 'लाल', 'तांबडी'],
    'Loamy': ['loamy', 'loam', 'domat', 'दोमट'],
    'Clay': ['clay', 'clayey', 'chikni', 'matiyar', 'चिकनी', 'चिकणी'],
    'Sandy': ['sandy', 'desert', 'retili', 'balu', 'रेतीली', 'वाळूट'],
  };

  for (const [soilName, keywords] of Object.entries(soils)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        params.soil_type = soilName;
        break;
      }
    }
    if (params.soil_type) break;
  }

  // ========== RAINFALL DETECTION ==========
  const rainMatch = text.match(/(\d+)\s*(mm|millimeter|मिमी)/i);
  if (rainMatch) {
    params.expected_rainfall = parseInt(rainMatch[1]);
  }

  return params;
};

export { useMultilingualVoiceRecognition };
export default useMultilingualVoiceRecognition;

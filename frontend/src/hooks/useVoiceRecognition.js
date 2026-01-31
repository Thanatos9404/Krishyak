import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Production-Grade Voice Recognition Hook
 * 
 * Features:
 * - Graceful degradation when speech recognition unavailable
 * - Automatic fallback to manual text input
 * - Network error handling with limited retries
 * - Support for manual text entry as alternative
 * - Works offline via text input mode
 */

// Status constants for clearer state management
const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  ERROR: 'error',
  NO_SUPPORT: 'no_support'
};

const useVoiceRecognition = () => {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isVoiceAvailable, setIsVoiceAvailable] = useState(false);

  const recognitionRef = useRef(null);
  const shouldBeListeningRef = useRef(false);
  const retryCountRef = useRef(0);
  const timeoutRef = useRef(null);

  const MAX_RETRIES = 2; // Quick fail for network issues
  const LISTEN_TIMEOUT = 30000; // Auto-stop after 30 seconds

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = () => {
      if (typeof window === 'undefined') return false;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.log('Speech Recognition API not supported');
        return false;
      }

      // Check if we're in a secure context (HTTPS or localhost)
      const isSecure = window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        console.log('Speech Recognition requires HTTPS');
        return false;
      }

      return true;
    };

    const supported = checkSupport();
    setIsVoiceAvailable(supported);

    if (!supported) {
      setStatus(STATUS.NO_SUPPORT);
    }
  }, []);

  // Initialize recognition lazily (only when starting to listen)
  const initRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();

    // Configuration for best results
    recognition.continuous = false; // Single utterance mode - more reliable
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // English-India for Hinglish support
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus(STATUS.LISTENING);
      setError(null);
      retryCountRef.current = 0;
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Update transcript with combined results
      const newTranscript = finalTranscript || interimTranscript;
      if (newTranscript) {
        setTranscript(prev => {
          // Append final results, replace with interim
          if (finalTranscript) {
            return (prev + ' ' + finalTranscript).trim();
          }
          return prev || interimTranscript;
        });
      }
    };

    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error);

      switch (event.error) {
        case 'not-allowed':
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
          setStatus(STATUS.ERROR);
          shouldBeListeningRef.current = false;
          break;

        case 'no-speech':
          // Not an error - just no speech detected, will restart
          break;

        case 'audio-capture':
          setError('No microphone found. Please connect a microphone or use text input below.');
          setStatus(STATUS.ERROR);
          shouldBeListeningRef.current = false;
          break;

        case 'network':
          retryCountRef.current += 1;
          if (retryCountRef.current >= MAX_RETRIES) {
            setError('Voice recognition unavailable. Please use text input below instead.');
            setStatus(STATUS.ERROR);
            shouldBeListeningRef.current = false;
            setIsVoiceAvailable(false); // Disable voice for this session
          }
          break;

        case 'aborted':
          // User or system stopped - not an error
          break;

        case 'service-not-allowed':
          setError('Speech recognition service not available. Please use text input.');
          setStatus(STATUS.ERROR);
          shouldBeListeningRef.current = false;
          setIsVoiceAvailable(false);
          break;

        default:
          console.log('Unhandled speech error:', event.error);
      }
    };

    recognition.onend = () => {
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Only restart if we should still be listening and no fatal errors
      if (shouldBeListeningRef.current && retryCountRef.current < MAX_RETRIES) {
        try {
          // Small delay before restart to prevent rapid fire
          setTimeout(() => {
            if (shouldBeListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Already stopped or other issue
                setStatus(STATUS.IDLE);
                shouldBeListeningRef.current = false;
              }
            }
          }, 100);
        } catch (e) {
          setStatus(STATUS.IDLE);
        }
      } else {
        setStatus(STATUS.IDLE);
        shouldBeListeningRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    // Clear any previous state
    setError(null);
    setTranscript('');
    retryCountRef.current = 0;

    if (!isVoiceAvailable) {
      setError('Voice input not available. Please use text input.');
      setStatus(STATUS.ERROR);
      return false;
    }

    const recognition = initRecognition();
    if (!recognition) {
      setError('Could not initialize speech recognition. Please use text input.');
      setStatus(STATUS.ERROR);
      setIsVoiceAvailable(false);
      return false;
    }

    shouldBeListeningRef.current = true;

    try {
      recognition.start();

      // Set timeout to auto-stop
      timeoutRef.current = setTimeout(() => {
        if (shouldBeListeningRef.current) {
          stopListening();
        }
      }, LISTEN_TIMEOUT);

      return true;
    } catch (e) {
      console.error('Start error:', e);

      if (e.name === 'InvalidStateError') {
        // Already running, try to restart
        try {
          recognition.stop();
          setTimeout(() => {
            if (shouldBeListeningRef.current) {
              recognition.start();
            }
          }, 100);
          return true;
        } catch (e2) {
          console.error('Restart error:', e2);
        }
      }

      setError('Could not start voice recognition. Please use text input.');
      setStatus(STATUS.ERROR);
      shouldBeListeningRef.current = false;
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceAvailable, initRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }

    setStatus(STATUS.IDLE);
  }, []);

  // Reset state
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
    retryCountRef.current = 0;
    if (status === STATUS.ERROR) {
      setStatus(STATUS.IDLE);
    }
  }, [status]);

  // Set transcript manually (for text input fallback)
  const setManualTranscript = useCallback((text) => {
    setTranscript(text);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  return {
    // State
    isListening: status === STATUS.LISTENING,
    transcript,
    error,
    isSupported: isVoiceAvailable,
    status,

    // Actions
    startListening,
    stopListening,
    resetTranscript,
    setManualTranscript,

    // Constants for UI
    STATUS
  };
};

/**
 * Parse voice/text command to extract farming parameters
 * Works with both voice transcripts and manually typed text
 */
export const parseVoiceCommand = (transcript) => {
  if (!transcript || typeof transcript !== 'string') {
    return {};
  }

  const params = {};
  const text = transcript.toLowerCase().trim();

  // ========== CROP DETECTION ==========
  const crops = {
    'Rice': ['rice', 'paddy', 'dhan', 'dhaan', 'chawal', 'chaval', 'धान', 'चावल'],
    'Wheat': ['wheat', 'gehun', 'gehu', 'gehoon', 'gahu', 'गेहूं', 'गेहुं'],
    'Maize': ['maize', 'corn', 'makka', 'makkai', 'bhutta', 'मक्का', 'मकई'],
    'Cotton': ['cotton', 'kapas', 'kapaas', 'कपास', 'रुई'],
    'Sugarcane': ['sugarcane', 'ganna', 'ganne', 'sugar cane', 'गन्ना'],
    'Soybean': ['soybean', 'soya', 'soyabean', 'सोयाबीन'],
    'Groundnut': ['groundnut', 'peanut', 'moongfali', 'mungfali', 'मूंगफली'],
    'Mustard': ['mustard', 'sarson', 'sarso', 'सरसों'],
    'Potato': ['potato', 'aloo', 'aalu', 'aaloo', 'आलू'],
    'Tomato': ['tomato', 'tamatar', 'टमाटर'],
    'Onion': ['onion', 'pyaz', 'pyaaz', 'kanda', 'प्याज'],
    'Chilli': ['chilli', 'chili', 'mirch', 'mirchi', 'मिर्च'],
    'Mango': ['mango', 'aam', 'आम'],
    'Banana': ['banana', 'kela', 'kele', 'केला'],
    'Grapes': ['grapes', 'angoor', 'angur', 'अंगूर'],
    'Bajra': ['bajra', 'bajara', 'baajra', 'pearl millet', 'बाजरा'],
    'Jowar': ['jowar', 'jwar', 'sorghum', 'ज्वार'],
    'Chickpea': ['chickpea', 'chana', 'channa', 'gram', 'chole', 'चना'],
    'Lentil': ['lentil', 'masoor', 'dal', 'daal', 'मसूर', 'दाल'],
    'Moong': ['moong', 'mung', 'green gram', 'मूंग'],
    'Turmeric': ['turmeric', 'haldi', 'हल्दी'],
    'Ginger': ['ginger', 'adrak', 'अदरक'],
    'Garlic': ['garlic', 'lahsun', 'लहसुन'],
    'Spinach': ['spinach', 'palak', 'पालक'],
    'Cabbage': ['cabbage', 'gobhi', 'patta gobhi', 'गोभी'],
    'Cauliflower': ['cauliflower', 'phool gobhi', 'gobi', 'फूल गोभी'],
    'Carrot': ['carrot', 'gajar', 'गाजर'],
    'Okra': ['okra', 'bhindi', 'lady finger', 'भिंडी'],
    'Brinjal': ['brinjal', 'eggplant', 'baingan', 'baigan', 'बैंगन'],
    'Watermelon': ['watermelon', 'tarbooj', 'tarbuj', 'तरबूज'],
    'Orange': ['orange', 'santra', 'santara', 'narangi', 'संतरा'],
    'Guava': ['guava', 'amrood', 'amrud', 'अमरूद'],
    'Pomegranate': ['pomegranate', 'anar', 'anaar', 'अनार'],
    'Apple': ['apple', 'seb', 'saib', 'सेब'],
    'Papaya': ['papaya', 'papita', 'पपीता'],
    'Lemon': ['lemon', 'lime', 'nimbu', 'neembu', 'नींबू'],
    'Cumin': ['cumin', 'jeera', 'zeera', 'jira', 'जीरा'],
    'Coriander': ['coriander', 'dhaniya', 'dhania', 'धनिया'],
    'Fenugreek': ['fenugreek', 'methi', 'मेथी'],
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

  // ========== AREA DETECTION ==========
  const numberWords = {
    'one': 1, 'ek': 1, 'एक': 1,
    'two': 2, 'do': 2, 'दो': 2, 'to': 2,
    'three': 3, 'teen': 3, 'तीन': 3,
    'four': 4, 'char': 4, 'चार': 4,
    'five': 5, 'paanch': 5, 'panch': 5, 'पांच': 5,
    'six': 6, 'chhe': 6, 'छह': 6,
    'seven': 7, 'saat': 7, 'सात': 7,
    'eight': 8, 'aath': 8, 'आठ': 8,
    'nine': 9, 'nau': 9, 'नौ': 9,
    'ten': 10, 'das': 10, 'दस': 10,
    'half': 0.5, 'aadha': 0.5, 'आधा': 0.5,
    'dedh': 1.5, 'डेढ़': 1.5,
    'dhai': 2.5, 'ढाई': 2.5,
  };

  // Try word numbers: "two hectare", "do hector"
  for (const [word, value] of Object.entries(numberWords)) {
    const patterns = [
      new RegExp(`\\b${word}\\s*(hectare|hector|hect)s?\\b`, 'i'),
      new RegExp(`\\b${word}\\s*(acre)s?\\b`, 'i'),
      new RegExp(`\\b${word}\\s*(bigha)s?\\b`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        let area = value;
        if (text.match(/acre/i)) {
          area = value * 0.4047;
        } else if (text.match(/bigha/i)) {
          area = value * 0.25;
        }
        params.area_hectares = parseFloat(area.toFixed(2));
        break;
      }
    }
    if (params.area_hectares) break;
  }

  // Try numeric: "2 hectare", "5.5 acres"
  if (!params.area_hectares) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(hectare|hector|hect|acre|bigha)s?/i);
    if (numMatch) {
      let area = parseFloat(numMatch[1]);
      const unit = numMatch[2].toLowerCase();
      if (unit.includes('acre')) {
        area = area * 0.4047;
      } else if (unit.includes('bigha')) {
        area = area * 0.25;
      }
      params.area_hectares = parseFloat(area.toFixed(2));
    }
  }

  // ========== SOIL TYPE DETECTION ==========
  const soils = {
    'Alluvial': ['alluvial', 'jalodh', 'river soil', 'जलोढ़'],
    'Black': ['black soil', 'black', 'kali mitti', 'kaali', 'regur', 'काली'],
    'Red': ['red soil', 'red', 'lal mitti', 'laal', 'लाल'],
    'Loamy': ['loamy', 'loam', 'domat', 'दोमट'],
    'Clay': ['clay', 'clayey', 'chikni', 'matiyar', 'चिकनी'],
    'Sandy': ['sandy', 'desert', 'retili', 'balu', 'रेतीली'],
    'Laterite': ['laterite', 'lateritic'],
    'Mountain': ['mountain', 'hill', 'pahadi', 'पहाड़ी'],
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

  // ========== LOCATION DETECTION ==========
  const cities = [
    'nashik', 'pune', 'mumbai', 'nagpur', 'aurangabad', 'kolhapur', 'solapur',
    'lucknow', 'varanasi', 'kanpur', 'agra', 'allahabad', 'prayagraj',
    'ludhiana', 'amritsar', 'chandigarh', 'karnal', 'hisar',
    'bhopal', 'indore', 'jabalpur', 'gwalior',
    'jaipur', 'jodhpur', 'udaipur', 'kota',
    'ahmedabad', 'surat', 'vadodara', 'rajkot',
    'patna', 'gaya', 'muzaffarpur',
    'kolkata', 'bengaluru', 'bangalore', 'chennai', 'hyderabad', 'coimbatore',
    'delhi', 'gurugram', 'noida', 'ghaziabad',
  ];

  for (const city of cities) {
    if (text.includes(city)) {
      params.location = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }

  // ========== RAINFALL DETECTION ==========
  const rainMatch = text.match(/(\d+)\s*(mm|millimeter)/i);
  if (rainMatch) {
    params.expected_rainfall = parseInt(rainMatch[1]);
  }

  // Descriptive rainfall
  if (!params.expected_rainfall) {
    if (text.includes('heavy rain') || text.includes('bahut baarish') || text.includes('zyada baarish')) {
      params.expected_rainfall = 1200;
    } else if (text.includes('moderate rain') || text.includes('normal baarish')) {
      params.expected_rainfall = 800;
    } else if (text.includes('low rain') || text.includes('kam baarish') || text.includes('less rain')) {
      params.expected_rainfall = 400;
    }
  }

  // ========== PEST RISK DETECTION ==========
  if (text.match(/high pest|bahut keede|zyada keede|pest problem/i)) {
    params.pest_probability = 0.7;
  } else if (text.match(/some pest|medium pest|thode keede/i)) {
    params.pest_probability = 0.4;
  } else if (text.match(/no pest|low pest|keede nahi|kam keede/i)) {
    params.pest_probability = 0.1;
  }

  // ========== SEED QUALITY DETECTION ==========
  if (text.match(/excellent seed|premium|bahut accha beej|certified/i)) {
    params.seed_quality = 0.95;
  } else if (text.match(/good seed|accha beej|quality seed/i)) {
    params.seed_quality = 0.8;
  } else if (text.match(/average seed|normal seed|theek thaak/i)) {
    params.seed_quality = 0.6;
  } else if (text.match(/poor seed|kharab beej|bad seed/i)) {
    params.seed_quality = 0.4;
  }

  return params;
};

export { useVoiceRecognition, STATUS };
export default useVoiceRecognition;

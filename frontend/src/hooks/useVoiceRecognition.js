import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Professional Voice Recognition Hook
 * Uses continuous mode with auto-restart for reliable speech capture
 */
const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const shouldBeListeningRef = useRef(false);

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Initialize recognition object
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Configuration
    recognition.continuous = true; // Keep listening
    recognition.interimResults = true; // Show results as user speaks
    recognition.lang = 'en-IN'; // English-India works well for Hinglish
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Update transcript - combine final with interim
      setTranscript(prev => {
        const combined = (prev + finalTranscript).trim();
        return combined || interimTranscript;
      });
    };

    recognition.onerror = (event) => {
      console.log('Speech error:', event.error);

      // Handle specific errors
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
        shouldBeListeningRef.current = false;
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // No speech detected - this is normal, don't show error
        // Recognition will end and restart automatically
      } else if (event.error === 'audio-capture') {
        setError('No microphone found. Please connect a microphone.');
        shouldBeListeningRef.current = false;
        setIsListening(false);
      } else if (event.error === 'network') {
        // Network error - try to restart
        console.log('Network error, will try to restart...');
      }
      // For 'aborted' - this is expected when stopping manually
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
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not available');
      return;
    }

    setError(null);
    setTranscript('');
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
  }, []);

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
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
};

/**
 * Parse voice command to extract farming parameters
 * Uses simple keyword matching for reliability
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

export { useVoiceRecognition };
export default useVoiceRecognition;

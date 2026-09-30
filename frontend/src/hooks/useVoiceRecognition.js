import useVoiceRecognition, { STATUS } from './useSarvamRecognition';

/**
 * Sarvam recording hook plus the existing reviewable farm-command parser.
 * 
 * Features:
 * - Graceful degradation when speech recognition unavailable
 * - Automatic fallback to manual text input
 * - Provider failures fall back to manual input without automatic paid retries
 * - Support for manual text entry as alternative
 * - Works offline via text input mode
 */

const normalizeForSpeechScore = (value = '') => value
  .normalize('NFKC')
  .toLocaleLowerCase('en-IN')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const selectBestAlternative = (result, phraseHints = []) => {
  const hints = phraseHints.map(normalizeForSpeechScore).filter((hint) => hint.length > 1);
  const alternatives = Array.from(result || []).map((alternative) => {
    const normalized = normalizeForSpeechScore(alternative.transcript);
    const phraseMatches = hints.reduce((count, hint) => count + (normalized.includes(hint) ? 1 : 0), 0);
    const confidence = Number.isFinite(alternative.confidence) ? alternative.confidence : 0;
    return { transcript: alternative.transcript.trim(), confidence, score: confidence + phraseMatches * 0.22 };
  });
  alternatives.sort((a, b) => b.score - a.score);
  return alternatives[0] || { transcript: '', confidence: 0, score: 0 };
};

/**
 * Parse voice/text command to extract farming parameters
 * Works with both voice transcripts and manually typed text
 */
export const parseVoiceCommand = (transcript, localizedTerms = {}) => {
  if (!transcript || typeof transcript !== 'string') {
    return {};
  }

  const params = {};
  const nativeDigitZeroes = [0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66];
  const normalizeDigits = (value) => Array.from(value).map((char) => {
    const code = char.codePointAt(0);
    const zero = nativeDigitZeroes.find((candidate) => code >= candidate && code <= candidate + 9);
    return zero === undefined ? char : String(code - zero);
  }).join('');
  const text = normalizeDigits(transcript)
    .normalize('NFKC')
    .toLocaleLowerCase('en-IN')
    .replace(/[،,]/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ========== CROP DETECTION ==========
  const crops = {
    'Rice': ['rice', 'paddy', 'dhan', 'dhaan', 'dhanwa', 'chawal', 'chaval', 'धान', 'धानवा', 'चावल'],
    'Wheat': ['wheat', 'gehun', 'gehu', 'gehoon', 'gehuwa', 'gahu', 'गेहूं', 'गेहुं', 'गेहुआ'],
    'Maize': ['maize', 'corn', 'makka', 'makkai', 'makaiya', 'bhutta', 'मक्का', 'मकई', 'मकइया'],
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

  for (const [cropName, localizedName] of Object.entries(localizedTerms.crops || {})) {
    if (localizedName && crops[cropName]) crops[cropName].push(String(localizedName).toLowerCase());
  }

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
    'one': 1, 'ek': 1, 'एक': 1, 'एक्के': 1,
    'two': 2, 'do': 2, 'दो': 2, 'dui': 2, 'दुई': 2,
    'three': 3, 'teen': 3, 'तीन': 3, 'tin': 3,
    'four': 4, 'char': 4, 'chaar': 4, 'चार': 4,
    'five': 5, 'paanch': 5, 'panch': 5, 'पांच': 5, 'पाँच': 5,
    'six': 6, 'chhe': 6, 'छह': 6,
    'seven': 7, 'saat': 7, 'सात': 7,
    'eight': 8, 'aath': 8, 'आठ': 8,
    'nine': 9, 'nau': 9, 'नौ': 9,
    'ten': 10, 'das': 10, 'दस': 10,
    'half': 0.5, 'aadha': 0.5, 'आधा': 0.5,
    'dedh': 1.5, 'डेढ़': 1.5,
    'dhai': 2.5, 'ढाई': 2.5,
  };

  const unitMap = {
    hectare: ['hectare', 'hector', 'hect', 'हेक्टेयर', 'हेक्टर', localizedTerms.units?.hectare].filter(Boolean),
    acre: ['acre', 'एकड़', 'एकर', localizedTerms.units?.acre].filter(Boolean),
    bigha: ['bigha', 'beegha', 'बीघा', 'बिघा', localizedTerms.units?.bigha].filter(Boolean),
  };
  const allUnitWords = Object.values(unitMap).flat().map(escape).sort((a, b) => b.length - a.length).join('|');

  // Try word numbers: "two hectare", "do hector", "दुई बीघा"
  for (const [word, value] of Object.entries(numberWords)) {
    const match = text.match(new RegExp(`(?:^|\\s)${escape(word)}\\s*(${allUnitWords})(?:s)?(?:$|\\s)`, 'iu'));
    if (match) {
        let area = value;
        const matchedUnit = match[1].toLocaleLowerCase('en-IN');
        if (unitMap.acre.some((unit) => matchedUnit === String(unit).toLocaleLowerCase('en-IN'))) {
          area = value * 0.4047;
        } else if (unitMap.bigha.some((unit) => matchedUnit === String(unit).toLocaleLowerCase('en-IN'))) {
          area = value * 0.25;
        }
        params.area_hectares = parseFloat(area.toFixed(2));
    }
    if (params.area_hectares) break;
  }

  // Try numeric: "2 hectare", "5.5 acres"
  if (!params.area_hectares) {
    const unitPattern = Object.values(unitMap).flat().map(escape).sort((a, b) => b.length - a.length).join('|');
    const numMatch = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})`, 'iu'));
    if (numMatch) {
      let area = parseFloat(numMatch[1]);
      const unit = numMatch[2].toLowerCase();
      if (unitMap.acre.some((value) => unit === String(value).toLowerCase())) {
        area = area * 0.4047;
      } else if (unitMap.bigha.some((value) => unit === String(value).toLowerCase())) {
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

  for (const [soilName, localizedName] of Object.entries(localizedTerms.soils || {})) {
    if (localizedName && soils[soilName]) soils[soilName].push(String(localizedName).toLowerCase());
  }

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
  const highWord = localizedTerms.levels?.high?.toLowerCase();
  const mediumWord = localizedTerms.levels?.medium?.toLowerCase();
  const lowWord = localizedTerms.levels?.low?.toLowerCase();
  if (text.match(/high pest|bahut keede|zyada keede|pest problem/i) || (highWord && text.includes(highWord) && text.includes(localizedTerms.pestWord?.toLowerCase() || 'pest'))) {
    params.pest_probability = 0.7;
  } else if (text.match(/some pest|medium pest|thode keede/i) || (mediumWord && text.includes(mediumWord) && text.includes(localizedTerms.pestWord?.toLowerCase() || 'pest'))) {
    params.pest_probability = 0.4;
  } else if (text.match(/no pest|low pest|keede nahi|kam keede/i) || (lowWord && text.includes(lowWord) && text.includes(localizedTerms.pestWord?.toLowerCase() || 'pest'))) {
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

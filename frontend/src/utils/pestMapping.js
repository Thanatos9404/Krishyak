/**
 * Crop → Pest mapping for client-side filtering.
 * When backend is unavailable or returns cross-crop data, this ensures
 * only relevant pests are shown for the selected crop.
 */

export const CROP_PEST_MAP = {
  // Cereals
  'Rice':       ['Brown Plant Hopper', 'Blast', 'Sheath Blight', 'Stem Borer', 'Leaf Folder', 'Gall Midge', 'Bacterial Leaf Blight'],
  'Wheat':      ['Yellow Rust', 'Brown Rust', 'Aphids', 'Loose Smut', 'Karnal Bunt', 'Termites', 'Pink Borer'],
  'Maize':      ['Fall Armyworm', 'Stem Borer', 'Shoot Fly', 'Aphids', 'Common Rust', 'Downy Mildew'],
  'Barley':     ['Yellow Rust', 'Aphids', 'Covered Smut', 'Stripe Disease'],
  'Bajra':      ['Downy Mildew', 'Shoot Fly', 'Stem Borer', 'Ergot'],
  'Jowar':      ['Shoot Fly', 'Stem Borer', 'Grain Mold', 'Aphids', 'Downy Mildew'],
  'Ragi':       ['Blast', 'Aphids', 'Stem Borer'],

  // Pulses
  'Gram':       ['Pod Borer', 'Wilt', 'Aphids', 'Root Rot'],
  'Chickpea':   ['Pod Borer', 'Wilt', 'Aphids', 'Root Rot', 'Ascochyta Blight'],
  'Tur':        ['Pod Borer', 'Pod Fly', 'Wilt', 'Sterility Mosaic'],
  'Urad':       ['Whitefly', 'Yellow Mosaic', 'Pod Borer', 'Aphids'],
  'Moong':      ['Whitefly', 'Yellow Mosaic', 'Pod Borer', 'Thrips'],
  'Lentil':     ['Aphids', 'Wilt', 'Pod Borer', 'Rust'],

  // Oilseeds
  'Groundnut':  ['Leaf Miner', 'Aphids', 'Tikka Disease', 'White Grub', 'Spodoptera'],
  'Soybean':    ['Girdle Beetle', 'Stem Fly', 'Semilooper', 'Whitefly', 'Yellow Mosaic'],
  'Mustard':    ['Aphids', 'Sawfly', 'Painted Bug', 'White Rust', 'Alternaria Blight'],
  'Sunflower':  ['Head Borer', 'Jassids', 'Whitefly', 'Alternaria', 'Downy Mildew'],
  'Sesame':     ['Gall Fly', 'Hawk Moth', 'Leaf Webber', 'Phyllody'],

  // Cash crops
  'Cotton':     ['Pink Bollworm', 'Whitefly', 'American Bollworm', 'Jassids', 'Thrips', 'Mealybug'],
  'Sugarcane':  ['Woolly Aphid', 'Top Borer', 'Red Rot', 'Early Shoot Borer', 'Pyrilla', 'Scale Insect'],
  'Jute':       ['Yellow Mite', 'Stem Weevil', 'Bihar Hairy Caterpillar', 'Semilooper'],
  'Tobacco':    ['Aphids', 'Budworm', 'Whitefly', 'Leaf Curl'],

  // Vegetables
  'Potato':     ['Late Blight', 'Early Blight', 'Aphids', 'Whitefly', 'Tuber Moth'],
  'Onion':      ['Thrips', 'Purple Blotch', 'Stemphylium Blight', 'Root Rot'],
  'Tomato':     ['Fruit Borer', 'Whitefly', 'Leaf Curl', 'Early Blight', 'Late Blight', 'Leaf Miner'],
  'Brinjal':    ['Brinjal Shoot Borer', 'Jassids', 'Aphids', 'Whitefly', 'Phomopsis Blight'],
  'Cabbage':    ['Diamond Back Moth', 'Aphids', 'Head Borer', 'Black Rot'],
  'Cauliflower':['Diamond Back Moth', 'Aphids', 'Head Borer', 'Black Rot', 'Downy Mildew'],
  'Okra':       ['Shoot and Fruit Borer', 'Jassids', 'Whitefly', 'Yellow Vein Mosaic'],
  'Chilli':     ['Thrips', 'Mites', 'Fruit Borer', 'Leaf Curl', 'Anthracnose', 'Die Back'],
  'Green Peas': ['Pod Borer', 'Aphids', 'Powdery Mildew', 'Rust'],

  // Fruits
  'Mango':      ['Mango Hopper', 'Fruit Fly', 'Stem Borer', 'Anthracnose', 'Powdery Mildew'],
  'Banana':     ['Banana Weevil', 'Thrips', 'Sigatoka', 'Panama Wilt', 'Bunchy Top'],
  'Grapes':     ['Downy Mildew', 'Powdery Mildew', 'Thrips', 'Anthracnose', 'Mealybug'],
  'Pomegranate':['Fruit Borer', 'Aphids', 'Thrips', 'Bacterial Blight', 'Wilt'],
  'Orange':     ['Citrus Psylla', 'Leaf Miner', 'Canker', 'Greening', 'Mites'],
  'Guava':      ['Fruit Fly', 'Mealybug', 'Scale Insect', 'Anthracnose', 'Wilt'],
  'Apple':      ['Codling Moth', 'San Jose Scale', 'Woolly Aphid', 'Apple Scab', 'Fire Blight'],
  'Coconut':    ['Rhinoceros Beetle', 'Red Palm Weevil', 'Eriophyid Mite', 'Bud Rot'],

  // Spices
  'Turmeric':   ['Shoot Borer', 'Rhizome Fly', 'Scale Insect', 'Leaf Blotch', 'Rhizome Rot'],
  'Ginger':     ['Shoot Borer', 'Rhizome Fly', 'Soft Rot', 'Bacterial Wilt'],
  'Cumin':      ['Aphids', 'Wilt', 'Blight', 'Powdery Mildew'],
  'Cardamom':   ['Thrips', 'Root Grub', 'Capsule Borer', 'Katte Disease'],
  'Black Pepper':['Pollu Beetle', 'Pepper Weevil', 'Quick Wilt', 'Phytophthora'],
};

/**
 * Filter alerts to only include pests relevant to the given crop.
 * @param {Array} alerts - Raw pest alerts
 * @param {string} crop - Current crop name
 * @returns {Array} Filtered alerts
 */
export function filterAlertsByCrop(alerts, crop) {
  if (!crop || !alerts || alerts.length === 0) return alerts || [];
  
  // Case-insensitive key lookup
  const cropKey = Object.keys(CROP_PEST_MAP).find(k => k.toLowerCase() === crop.toLowerCase());
  const relevantPests = cropKey ? CROP_PEST_MAP[cropKey] : null;
  
  if (!relevantPests) return alerts; // Unknown crop — don't filter
  
  // Case-insensitive partial match
  const lowerPests = relevantPests.map(p => p.toLowerCase());
  
  return alerts.filter(alert => {
    const pestName = (alert.pest_name || alert.name || '').toLowerCase();
    const cropMatch = (alert.crop || '').toLowerCase() === crop.toLowerCase();
    const pestMatch = lowerPests.some(p => pestName.includes(p) || p.includes(pestName));
    return cropMatch || pestMatch;
  });
}

/**
 * Generate offline fallback alerts for a crop when backend is down.
 */
export function generateFallbackAlerts(crop, state) {
  const pests = CROP_PEST_MAP[crop];
  if (!pests || pests.length === 0) return [];
  // Pick 1-2 seasonal pests
  const count = Math.min(2, pests.length);
  const selected = pests.slice(0, count);

  return selected.map((pest, idx) => ({
    id: `fallback-${idx}`,
    pest_name: pest,
    crop: crop,
    severity: idx === 0 ? 'medium' : 'low',
    region: state || 'India',
    district: '',
    description: `${pest} is commonly observed in ${crop} during this season. Monitor your field regularly.`,
    recommendations: [
      'Scout your field weekly for early signs',
      'Consult your local KVK for recommended pesticides',
      'Use integrated pest management (IPM) practices',
    ],
    isFallback: true,
  }));
}

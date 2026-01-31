/**
 * Government API Service
 * Handles API calls to backend for MSP prices, mandi prices, and location data
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://krishyak-backend.onrender.com';

/**
 * Fetch MSP prices from backend API
 * @returns {Promise<Object>} MSP data with all crops
 */
export async function fetchMSPPrices() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/msp/prices`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch MSP prices: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching MSP prices:', error);
    // Return null to trigger fallback to static data
    return null;
  }
}

/**
 * Fetch MSP for a specific crop
 * @param {string} crop - Crop name
 * @returns {Promise<Object|null>} MSP data for the crop
 */
export async function fetchMSPForCrop(crop) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/msp/prices/${encodeURIComponent(crop)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch MSP for ${crop}: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error(`Error fetching MSP for ${crop}:`, error);
    return null;
  }
}

/**
 * Fetch live mandi prices from backend API
 * @param {Object} filters - Filter options
 * @param {string} [filters.commodity] - Filter by commodity
 * @param {string} [filters.state] - Filter by state
 * @param {string} [filters.district] - Filter by district
 * @param {number} [filters.limit=50] - Maximum results
 * @returns {Promise<Object>} Mandi prices data
 */
export async function fetchMandiPrices({ commodity, state, district, limit = 50 } = {}) {
  try {
    const params = new URLSearchParams();
    if (commodity) params.append('commodity', commodity);
    if (state) params.append('state', state);
    if (district) params.append('district', district);
    params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/api/mandi/prices?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch mandi prices: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching mandi prices:', error);
    return {
      success: false,
      error: 'Could not fetch mandi prices. Please try again later.',
      prices: []
    };
  }
}

/**
 * Fetch list of Indian states from backend
 * @returns {Promise<Array>} List of states
 */
export async function fetchStates() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/locations/states`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch states: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.states : [];
  } catch (error) {
    console.error('Error fetching states:', error);
    return [];
  }
}

/**
 * Format price for display (Indian number system)
 * @param {number} price - Price value
 * @returns {string} Formatted price string
 */
export function formatIndianPrice(price) {
  if (typeof price !== 'number' || isNaN(price)) return '₹--';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Get translated crop name
 * @param {string} cropName - English crop name
 * @param {string} language - Target language code ('hi' for Hindi)
 * @returns {string} Translated crop name
 */
const CROP_TRANSLATIONS = {
  'Rice': 'चावल',
  'Wheat': 'गेहूं',
  'Maize': 'मक्का',
  'Barley': 'जौ',
  'Bajra': 'बाजरा',
  'Jowar': 'ज्वार',
  'Ragi': 'रागी',
  'Tur': 'अरहर',
  'Gram': 'चना',
  'Urad': 'उड़द',
  'Moong': 'मूंग',
  'Lentil': 'मसूर',
  'Groundnut': 'मूंगफली',
  'Soybean': 'सोयाबीन',
  'Sunflower': 'सूरजमुखी',
  'Mustard': 'सरसों',
  'Safflower': 'कुसुम',
  'Sesame': 'तिल',
  'Cotton': 'कपास',
  'Sugarcane': 'गन्ना',
  'Jute': 'जूट',
  'Copra': 'खोपरा',
};

export function getTranslatedCropName(cropName, language = 'en') {
  if (language === 'hi' && CROP_TRANSLATIONS[cropName]) {
    return CROP_TRANSLATIONS[cropName];
  }
  return cropName;
}

export default {
  fetchMSPPrices,
  fetchMSPForCrop,
  fetchMandiPrices,
  fetchStates,
  formatIndianPrice,
  getTranslatedCropName,
};

import axios from 'axios';

const OPENWEATHER_API_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY;

// Indian district/region to soil type mapping based on geography
const regionSoilMapping = {
  // Maharashtra
  'Nashik': { soil: 'Black', rainfall: 650, zone: 'Deccan' },
  'Pune': { soil: 'Red', rainfall: 700, zone: 'Western Ghats' },
  'Mumbai': { soil: 'Laterite', rainfall: 2200, zone: 'Coastal' },
  'Nagpur': { soil: 'Black', rainfall: 1000, zone: 'Vidarbha' },
  'Aurangabad': { soil: 'Black', rainfall: 700, zone: 'Marathwada' },
  'Kolhapur': { soil: 'Laterite', rainfall: 1200, zone: 'Western Maharashtra' },
  'Solapur': { soil: 'Black', rainfall: 500, zone: 'Drought-prone' },
  'Satara': { soil: 'Red', rainfall: 900, zone: 'Western Ghats' },

  // Uttar Pradesh - Indo-Gangetic Plain
  'Lucknow': { soil: 'Alluvial', rainfall: 900, zone: 'Central UP' },
  'Varanasi': { soil: 'Alluvial', rainfall: 1000, zone: 'Eastern UP' },
  'Kanpur': { soil: 'Alluvial', rainfall: 800, zone: 'Central UP' },
  'Agra': { soil: 'Alluvial', rainfall: 650, zone: 'Western UP' },
  'Allahabad': { soil: 'Alluvial', rainfall: 950, zone: 'Central UP' },
  'Meerut': { soil: 'Alluvial', rainfall: 850, zone: 'Western UP' },
  'Gorakhpur': { soil: 'Alluvial', rainfall: 1200, zone: 'Eastern UP' },

  // Punjab & Haryana
  'Ludhiana': { soil: 'Alluvial', rainfall: 700, zone: 'Central Punjab' },
  'Amritsar': { soil: 'Alluvial', rainfall: 600, zone: 'Majha' },
  'Chandigarh': { soil: 'Alluvial', rainfall: 1100, zone: 'Foothills' },
  'Karnal': { soil: 'Alluvial', rainfall: 700, zone: 'Haryana' },
  'Hisar': { soil: 'Desert', rainfall: 400, zone: 'Southern Haryana' },
  'Rohtak': { soil: 'Alluvial', rainfall: 550, zone: 'Central Haryana' },

  // Madhya Pradesh
  'Bhopal': { soil: 'Black', rainfall: 1150, zone: 'Central MP' },
  'Indore': { soil: 'Black', rainfall: 950, zone: 'Malwa' },
  'Jabalpur': { soil: 'Black', rainfall: 1350, zone: 'Eastern MP' },
  'Gwalior': { soil: 'Alluvial', rainfall: 800, zone: 'Northern MP' },

  // Rajasthan
  'Jaipur': { soil: 'Desert', rainfall: 500, zone: 'Eastern Rajasthan' },
  'Jodhpur': { soil: 'Desert', rainfall: 350, zone: 'Thar Desert' },
  'Udaipur': { soil: 'Red', rainfall: 600, zone: 'Mewar' },
  'Bikaner': { soil: 'Desert', rainfall: 250, zone: 'Thar Desert' },
  'Kota': { soil: 'Black', rainfall: 700, zone: 'Hadoti' },

  // Gujarat
  'Ahmedabad': { soil: 'Alluvial', rainfall: 800, zone: 'Central Gujarat' },
  'Surat': { soil: 'Alluvial', rainfall: 1200, zone: 'South Gujarat' },
  'Vadodara': { soil: 'Black', rainfall: 900, zone: 'Central Gujarat' },
  'Rajkot': { soil: 'Black', rainfall: 550, zone: 'Saurashtra' },
  'Bhuj': { soil: 'Desert', rainfall: 350, zone: 'Kutch' },

  // Bihar
  'Patna': { soil: 'Alluvial', rainfall: 1100, zone: 'Central Bihar' },
  'Gaya': { soil: 'Alluvial', rainfall: 1000, zone: 'Magadh' },
  'Muzaffarpur': { soil: 'Alluvial', rainfall: 1200, zone: 'North Bihar' },
  'Bhagalpur': { soil: 'Alluvial', rainfall: 1100, zone: 'Eastern Bihar' },

  // West Bengal
  'Kolkata': { soil: 'Alluvial', rainfall: 1600, zone: 'Gangetic Delta' },
  'Siliguri': { soil: 'Alluvial', rainfall: 3000, zone: 'Terai' },
  'Malda': { soil: 'Alluvial', rainfall: 1400, zone: 'North Bengal' },

  // Karnataka
  'Bangalore': { soil: 'Red', rainfall: 900, zone: 'Southern Plateau' },
  'Mysore': { soil: 'Red', rainfall: 800, zone: 'Old Mysore' },
  'Belgaum': { soil: 'Black', rainfall: 1000, zone: 'North Karnataka' },
  'Mangalore': { soil: 'Laterite', rainfall: 3500, zone: 'Coastal' },
  'Hubli': { soil: 'Black', rainfall: 800, zone: 'Dharwad' },

  // Tamil Nadu
  'Chennai': { soil: 'Alluvial', rainfall: 1400, zone: 'Coastal' },
  'Coimbatore': { soil: 'Black', rainfall: 700, zone: 'Western TN' },
  'Madurai': { soil: 'Red', rainfall: 850, zone: 'Southern TN' },
  'Trichy': { soil: 'Alluvial', rainfall: 800, zone: 'Central TN' },
  'Salem': { soil: 'Red', rainfall: 900, zone: 'Northwestern TN' },

  // Andhra Pradesh & Telangana
  'Hyderabad': { soil: 'Red', rainfall: 800, zone: 'Deccan' },
  'Vijayawada': { soil: 'Black', rainfall: 1000, zone: 'Coastal AP' },
  'Visakhapatnam': { soil: 'Red', rainfall: 1100, zone: 'North Coastal' },
  'Guntur': { soil: 'Black', rainfall: 850, zone: 'Coastal AP' },
  'Tirupati': { soil: 'Red', rainfall: 950, zone: 'Rayalaseema' },

  // Kerala
  'Thiruvananthapuram': { soil: 'Laterite', rainfall: 1800, zone: 'Travancore' },
  'Kochi': { soil: 'Laterite', rainfall: 3000, zone: 'Coastal Kerala' },
  'Kozhikode': { soil: 'Laterite', rainfall: 3100, zone: 'Malabar' },

  // Odisha
  'Bhubaneswar': { soil: 'Red', rainfall: 1500, zone: 'Coastal Odisha' },
  'Cuttack': { soil: 'Alluvial', rainfall: 1400, zone: 'Mahanadi Delta' },

  // Northeast
  'Guwahati': { soil: 'Alluvial', rainfall: 1700, zone: 'Brahmaputra Valley' },
  'Shillong': { soil: 'Red', rainfall: 2300, zone: 'Meghalaya Hills' },
  'Imphal': { soil: 'Alluvial', rainfall: 1400, zone: 'Manipur Valley' },

  // Himalayan
  'Dehradun': { soil: 'Mountain', rainfall: 2100, zone: 'Doon Valley' },
  'Shimla': { soil: 'Mountain', rainfall: 1500, zone: 'Himachal' },
  'Srinagar': { soil: 'Mountain', rainfall: 700, zone: 'Kashmir Valley' },
  'Jammu': { soil: 'Alluvial', rainfall: 1100, zone: 'Jammu Region' }
};

// Get location from browser with timeout protection
export const getCurrentLocation = () => {
  const locationPromise = new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  // Race against a timeout to prevent infinite hang if user ignores permission dialog
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Location detection timed out. Please enter your location manually.')), 12000);
  });

  return Promise.race([locationPromise, timeoutPromise]);
};

// Reverse geocode to get city/district name
export const getLocationName = async (lat, lon) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );

    const address = response.data.address;
    return {
      city: address.city || address.town || address.village || address.county,
      district: address.state_district || address.county,
      state: address.state,
      country: address.country
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

// Get soil type based on location
export const getSoilTypeForLocation = (locationName) => {
  if (!locationName) return null;

  // Try to find exact match first
  const cityName = locationName.city || locationName.district;

  for (const [region, data] of Object.entries(regionSoilMapping)) {
    if (cityName && cityName.toLowerCase().includes(region.toLowerCase())) {
      return data;
    }
  }

  // Try district match
  for (const [region, data] of Object.entries(regionSoilMapping)) {
    if (locationName.district && locationName.district.toLowerCase().includes(region.toLowerCase())) {
      return data;
    }
  }

  // Default based on state
  const stateDefaults = {
    'Maharashtra': { soil: 'Black', rainfall: 800 },
    'Uttar Pradesh': { soil: 'Alluvial', rainfall: 900 },
    'Punjab': { soil: 'Alluvial', rainfall: 650 },
    'Haryana': { soil: 'Alluvial', rainfall: 550 },
    'Madhya Pradesh': { soil: 'Black', rainfall: 1100 },
    'Rajasthan': { soil: 'Arid / Sandy', rainfall: 500 },
    'Gujarat': { soil: 'Black', rainfall: 800 },
    'Bihar': { soil: 'Alluvial', rainfall: 1100 },
    'West Bengal': { soil: 'Alluvial', rainfall: 1600 },
    'Karnataka': { soil: 'Red', rainfall: 900 },
    'Tamil Nadu': { soil: 'Red', rainfall: 900 },
    'Andhra Pradesh': { soil: 'Black', rainfall: 900 },
    'Telangana': { soil: 'Red', rainfall: 800 },
    'Kerala': { soil: 'Laterite', rainfall: 2700 },
    'Odisha': { soil: 'Red', rainfall: 1400 },
    'Assam': { soil: 'Alluvial', rainfall: 1800 },
    'Jharkhand': { soil: 'Red', rainfall: 1300 },
    'Chhattisgarh': { soil: 'Red', rainfall: 1300 },
    'Uttarakhand': { soil: 'Mountain', rainfall: 1500 },
    'Himachal Pradesh': { soil: 'Mountain', rainfall: 1200 }
  };

  if (locationName.state) {
    for (const [state, data] of Object.entries(stateDefaults)) {
      if (locationName.state.toLowerCase().includes(state.toLowerCase())) {
        return data;
      }
    }
  }

  return null;
};

// Get weather forecast using Open-Meteo (Free, No API Key required)
export const getWeatherForecast = async (lat, lon) => {
  try {
    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto`
    );

    const data = response.data;
    const current = data.current;
    
    const getWeatherDescription = (code) => {
      if (code <= 3) return 'Partly cloudy';
      if (code < 50) return 'Foggy';
      if (code < 70) return 'Rainy';
      if (code >= 80) return 'Stormy';
      return 'Clear';
    };

    const forecasts = [];
    for (let i = 0; i < 8; i++) {
        forecasts.push({
            time: data.hourly.time[i],
            temp: data.hourly.temperature_2m[i],
            humidity: data.hourly.relative_humidity_2m[i],
            rain: data.hourly.precipitation[i] || 0
        });
    }

    return {
      current: {
        temp: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        description: getWeatherDescription(current.weather_code),
        icon: current.weather_code > 50 ? '09d' : '02d' 
      },
      location: 'Local Region',
      forecast: forecasts,
      isMock: false,
      source: "Open-Meteo (Estimate)"
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return getMockWeatherData(lat, lon);
  }
};

// Mock weather data for demo (location-aware)
const getMockWeatherData = (lat, lon) => {
  // December weather approximation based on latitude
  const isNorth = lat > 23; // North of Tropic of Cancer
  const baseTemp = isNorth ? 15 + Math.random() * 10 : 25 + Math.random() * 5;
  const humidity = 40 + Math.random() * 30;

  return {
    current: {
      temp: Math.round(baseTemp),
      humidity: Math.round(humidity),
      description: 'Partly cloudy',
      icon: '02d'
    },
    location: 'Your Location',
    forecast: [],
    isMock: true,
    source: "Static Default (No Location)"
  };
};

// Estimate seasonal rainfall based on location data
export const estimateSeasonalRainfall = (locationData) => {
  if (locationData?.rainfall) {
    return locationData.rainfall;
  }

  // Default average for India
  return 800;
};

// Calculate monsoon delay based on current date and region
export const estimateMonsoonDelay = (lat) => {
  const now = new Date();
  const month = now.getMonth() + 1;

  // Monsoon typically arrives June-July
  // South India gets monsoon earlier
  if (month >= 6 && month <= 9) {
    // During monsoon season
    const isSouth = lat < 20;
    return isSouth ? 0 : Math.floor(Math.random() * 10);
  }

  return 0;
};

// Main function to get all location-based data
export const getLocationBasedData = async () => {
  try {
    const coords = await getCurrentLocation();
    const locationName = await getLocationName(coords.lat, coords.lon);
    const soilData = getSoilTypeForLocation(locationName);
    const weather = await getWeatherForecast(coords.lat, coords.lon);
    const monsoonDelay = estimateMonsoonDelay(coords.lat);

    return {
      location: locationName,
      coordinates: coords,
      soil_type: soilData?.soil || 'Alluvial',
      soil_source: soilData ? 'Estimated based on location (Regional Map)' : 'Static Fallback Default',
      expected_rainfall: soilData?.rainfall || estimateSeasonalRainfall(null),
      rainfall_delay: monsoonDelay,
      weather: weather,
      zone: soilData?.zone || 'Unknown'
    };
  } catch (error) {
    console.error('Location data error:', error);
    throw error;
  }
};

// Named export for eslint compliance
const weatherApi = {
  getCurrentLocation,
  getLocationName,
  getSoilTypeForLocation,
  getWeatherForecast,
  estimateSeasonalRainfall,
  estimateMonsoonDelay,
  getLocationBasedData
};

export default weatherApi;

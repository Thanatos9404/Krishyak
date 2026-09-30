import axios from 'axios';

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
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Location detection timed out. Please enter your location manually.')), 12000);
  });

  return Promise.race([locationPromise, timeoutPromise]).finally(() => clearTimeout(timeout));
};

// Reverse geocode to get city/district name
export const getLocationName = async (lat, lon) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { 'Accept-Language': 'en' }, timeout: 15000 }
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

// Coordinates or place names cannot establish a farm's soil type without a verified soil source.
export const getSoilTypeForLocation = () => null;

const inRange = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const utcTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
  ? Date.parse(`${value}Z`) : NaN;
const weatherDescriptions = {
  0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',
  51:'Drizzle',53:'Drizzle',55:'Drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
  61:'Rain',63:'Rain',65:'Rain',66:'Freezing rain',67:'Freezing rain',
  71:'Snow',73:'Snow',75:'Snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Rain showers',
  85:'Snow showers',86:'Snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with hail',
};

// UTC timestamps make freshness independent of the browser's timezone.
export const getWeatherForecast = async (lat, lon) => {
  if (!inRange(lat,-90,90) || !inRange(lon,-180,180)) return getUnavailableWeatherData();
  try {
    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&hourly=temperature_2m,relative_humidity_2m,precipitation&timezone=UTC`,
      {timeout:15000}
    );
    const data = response.data;
    const current = data?.current;
    const observed = utcTime(current?.time);
    const age = Date.now() - observed;
    if (data?.utc_offset_seconds !== 0 || !Number.isFinite(age) || age < -300000 || age > 5400000
      || !inRange(current?.temperature_2m,-90,60) || !inRange(current?.relative_humidity_2m,0,100)
      || !Number.isInteger(current?.weather_code) || !Object.hasOwn(weatherDescriptions,current.weather_code)) {
      return getUnavailableWeatherData();
    }
    const hourly = data.hourly;
    const start = Math.ceil(Date.now()/3600000)*3600000;
    let forecasts = [];
    if (Array.isArray(hourly?.time)) {
      const index = hourly.time.findIndex(time => utcTime(time) === start);
      if (index >= 0) {
        for (let offset = 0; offset < 8; offset++) {
          const i = index + offset;
          const time = utcTime(hourly.time[i]);
          const temp = hourly.temperature_2m?.[i];
          const humidity = hourly.relative_humidity_2m?.[i];
          const rain = hourly.precipitation?.[i];
          if (time !== start + offset*3600000 || !inRange(temp,-90,60)
            || !inRange(humidity,0,100) || !inRange(rain,0,1000)) { forecasts = []; break; }
          forecasts.push({time:new Date(time).toISOString(),temp,humidity,rain});
        }
      }
    }
    return {
      current:{temp:current.temperature_2m,humidity:current.relative_humidity_2m,
        description:weatherDescriptions[current.weather_code],weather_code:current.weather_code,
        observed_at:new Date(observed).toISOString()},
      location:'Local Region',forecast:forecasts,forecast_available:forecasts.length === 8,
      isMock:false,source:'Open-Meteo model estimate',
    };
  } catch {
    return getUnavailableWeatherData();
  }
};

// Explicit unavailable weather state
const getUnavailableWeatherData = () => {

  return {
    current: {
      temp: null,
      humidity: null,
      description: 'Weather unavailable',
      icon: '02d'
    },
    location: 'Your Location',
    forecast: [],
    isMock: true,
    source: "Unavailable"
  };
};

// No seasonal forecast or observed monsoon-onset dataset is configured.
export const estimateSeasonalRainfall = () => null;
export const estimateMonsoonDelay = () => null;

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
      soil_type: soilData?.soil ?? null,
      soil_source: 'unavailable',
      expected_rainfall: estimateSeasonalRainfall(null),
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

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const farmingApi = {
  // Get available crops
  getCrops: async () => {
    const response = await api.get('/crops');
    return response.data;
  },

  // Get soil types
  getSoilTypes: async () => {
    const response = await api.get('/soils');
    return response.data;
  },

  // Get fertilizers
  getFertilizers: async () => {
    const response = await api.get('/fertilizers');
    return response.data;
  },

  // Run simulation
  simulate: async (farmingInput, numSimulations = 500) => {
    const response = await api.post('/simulate', {
      farming_input: farmingInput,
      num_simulations: numSimulations,
    });
    return response.data;
  },

  // Forecast prices
  forecastPrices: async (commodity, currentPrice, forecastDays = 60) => {
    const response = await api.post('/forecast_prices', {
      commodity,
      current_price: currentPrice,
      forecast_days: forecastDays,
    });
    return response.data;
  },

  // Compare scenarios
  compareScenarios: async (farmingInput, numSimulations = 500) => {
    const response = await api.post('/compare_scenarios', {
      farming_input: farmingInput,
      num_simulations: numSimulations,
    });
    return response.data;
  },

  // Get recommendations
  getRecommendations: async (farmingInput) => {
    const response = await api.post('/recommend', {
      farming_input: farmingInput,
      num_simulations: 300,
    });
    return response.data;
  },

  // Register farmer and save to CSV
  registerFarmer: async (farmerData) => {
    try {
      const response = await api.post('/register-farmer', farmerData);
      return response.data;
    } catch (error) {
      console.error('Failed to register farmer on backend:', error);
      // Return success anyway - registration is primarily client-side
      // Backend CSV storage is a secondary feature
      return { success: false, error: error.message };
    }
  },
};

export default farmingApi;

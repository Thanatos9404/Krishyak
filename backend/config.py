"""Configuration settings for Krishyak backend"""
import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "datasets"
MODELS_DIR = BASE_DIR / "models"

# API Configuration
API_KEY = os.getenv("API_KEY", "579b464db66ec23bdd0000019e4dba64f69842d1547080c5536593c7")

# Crop configurations - Comprehensive list including vegetables and fruits
CROPS = [
    # Cereals
    "Rice", "Wheat", "Maize", "Barley", "Bajra", "Jowar", "Ragi",
    # Pulses
    "Tur", "Gram", "Urad", "Moong", "Lentil", "Chickpea", "Arhar",
    # Oilseeds
    "Groundnut", "Soybean", "Sunflower", "Mustard", "Sesame",
    # Cash Crops
    "Cotton", "Sugarcane", "Jute", "Tobacco",
    # Vegetables
    "Potato", "Onion", "Tomato", "Brinjal", "Cabbage", "Cauliflower",
    "Okra", "Carrot", "Green Peas", "Spinach", "Chilli", "Garlic",
    "Ginger", "Coriander", "Capsicum", "Cucumber", "Pumpkin", "Radish",
    # Fruits
    "Mango", "Banana", "Grapes", "Pomegranate", "Orange", "Guava",
    "Papaya", "Apple", "Watermelon", "Lemon", "Coconut", "Litchi",
    # Spices
    "Turmeric", "Cumin", "Fenugreek", "Black Pepper", "Cardamom"
]

SOIL_TYPES = [
    "Alluvial", "Black", "Red", "Laterite", "Desert", "Mountain", "Loamy", "Clay", "Sandy"
]

SEASONS = ["Kharif", "Rabi", "Summer", "Perennial"]

# Crop-Soil compatibility matrix (0-1 scale)
CROP_SOIL_COMPATIBILITY = {
    # Cereals
    "Rice": {"Alluvial": 0.95, "Black": 0.7, "Red": 0.6, "Laterite": 0.5, "Desert": 0.2, "Mountain": 0.4, "Loamy": 0.85, "Clay": 0.9, "Sandy": 0.3},
    "Wheat": {"Alluvial": 0.9, "Black": 0.85, "Red": 0.7, "Laterite": 0.5, "Desert": 0.3, "Mountain": 0.6, "Loamy": 0.9, "Clay": 0.8, "Sandy": 0.4},
    "Maize": {"Alluvial": 0.85, "Black": 0.9, "Red": 0.8, "Laterite": 0.6, "Desert": 0.4, "Mountain": 0.7, "Loamy": 0.9, "Clay": 0.75, "Sandy": 0.5},
    "Barley": {"Alluvial": 0.85, "Black": 0.8, "Red": 0.7, "Laterite": 0.5, "Desert": 0.4, "Mountain": 0.7, "Loamy": 0.85, "Clay": 0.75, "Sandy": 0.5},
    "Bajra": {"Alluvial": 0.7, "Black": 0.75, "Red": 0.8, "Laterite": 0.6, "Desert": 0.85, "Mountain": 0.5, "Loamy": 0.8, "Clay": 0.6, "Sandy": 0.9},
    "Jowar": {"Alluvial": 0.75, "Black": 0.9, "Red": 0.8, "Laterite": 0.6, "Desert": 0.7, "Mountain": 0.5, "Loamy": 0.85, "Clay": 0.75, "Sandy": 0.6},
    
    # Pulses
    "Gram": {"Alluvial": 0.8, "Black": 0.9, "Red": 0.75, "Laterite": 0.5, "Desert": 0.4, "Mountain": 0.55, "Loamy": 0.9, "Clay": 0.7, "Sandy": 0.4},
    "Lentil": {"Alluvial": 0.85, "Black": 0.8, "Red": 0.7, "Laterite": 0.5, "Desert": 0.35, "Mountain": 0.5, "Loamy": 0.9, "Clay": 0.7, "Sandy": 0.4},
    "Moong": {"Alluvial": 0.85, "Black": 0.8, "Red": 0.75, "Laterite": 0.55, "Desert": 0.4, "Mountain": 0.5, "Loamy": 0.9, "Clay": 0.65, "Sandy": 0.5},
    "Urad": {"Alluvial": 0.85, "Black": 0.85, "Red": 0.75, "Laterite": 0.55, "Desert": 0.35, "Mountain": 0.5, "Loamy": 0.9, "Clay": 0.7, "Sandy": 0.45},
    
    # Cash Crops
    "Cotton": {"Alluvial": 0.8, "Black": 0.95, "Red": 0.75, "Laterite": 0.6, "Desert": 0.5, "Mountain": 0.5, "Loamy": 0.8, "Clay": 0.85, "Sandy": 0.6},
    "Sugarcane": {"Alluvial": 0.9, "Black": 0.85, "Red": 0.7, "Laterite": 0.6, "Desert": 0.3, "Mountain": 0.5, "Loamy": 0.9, "Clay": 0.8, "Sandy": 0.4},
    
    # Vegetables
    "Potato": {"Alluvial": 0.9, "Black": 0.7, "Red": 0.85, "Laterite": 0.6, "Desert": 0.4, "Mountain": 0.8, "Loamy": 0.95, "Clay": 0.6, "Sandy": 0.75},
    "Onion": {"Alluvial": 0.85, "Black": 0.75, "Red": 0.9, "Laterite": 0.6, "Desert": 0.5, "Mountain": 0.6, "Loamy": 0.95, "Clay": 0.6, "Sandy": 0.7},
    "Tomato": {"Alluvial": 0.85, "Black": 0.8, "Red": 0.9, "Laterite": 0.65, "Desert": 0.45, "Mountain": 0.7, "Loamy": 0.95, "Clay": 0.65, "Sandy": 0.7},
    "Brinjal": {"Alluvial": 0.85, "Black": 0.8, "Red": 0.85, "Laterite": 0.6, "Desert": 0.4, "Mountain": 0.6, "Loamy": 0.9, "Clay": 0.7, "Sandy": 0.6},
    "Cabbage": {"Alluvial": 0.85, "Black": 0.75, "Red": 0.8, "Laterite": 0.6, "Desert": 0.35, "Mountain": 0.85, "Loamy": 0.95, "Clay": 0.7, "Sandy": 0.55},
    "Cauliflower": {"Alluvial": 0.85, "Black": 0.75, "Red": 0.8, "Laterite": 0.6, "Desert": 0.35, "Mountain": 0.85, "Loamy": 0.95, "Clay": 0.7, "Sandy": 0.55},
    "Okra": {"Alluvial": 0.85, "Black": 0.85, "Red": 0.8, "Laterite": 0.6, "Desert": 0.45, "Mountain": 0.55, "Loamy": 0.9, "Clay": 0.7, "Sandy": 0.65},
    "Chilli": {"Alluvial": 0.8, "Black": 0.85, "Red": 0.85, "Laterite": 0.65, "Desert": 0.45, "Mountain": 0.6, "Loamy": 0.9, "Clay": 0.7, "Sandy": 0.6},
    "Carrot": {"Alluvial": 0.8, "Black": 0.65, "Red": 0.75, "Laterite": 0.5, "Desert": 0.4, "Mountain": 0.75, "Loamy": 0.95, "Clay": 0.5, "Sandy": 0.85},
    "Green Peas": {"Alluvial": 0.85, "Black": 0.75, "Red": 0.7, "Laterite": 0.55, "Desert": 0.35, "Mountain": 0.8, "Loamy": 0.95, "Clay": 0.65, "Sandy": 0.5},
    "Spinach": {"Alluvial": 0.85, "Black": 0.8, "Red": 0.75, "Laterite": 0.6, "Desert": 0.35, "Mountain": 0.7, "Loamy": 0.9, "Clay": 0.75, "Sandy": 0.55},
    "Garlic": {"Alluvial": 0.85, "Black": 0.75, "Red": 0.8, "Laterite": 0.55, "Desert": 0.45, "Mountain": 0.65, "Loamy": 0.95, "Clay": 0.6, "Sandy": 0.75},
    "Ginger": {"Alluvial": 0.8, "Black": 0.7, "Red": 0.85, "Laterite": 0.75, "Desert": 0.3, "Mountain": 0.8, "Loamy": 0.95, "Clay": 0.55, "Sandy": 0.7},
    
    # Fruits
    "Mango": {"Alluvial": 0.85, "Black": 0.75, "Red": 0.9, "Laterite": 0.8, "Desert": 0.4, "Mountain": 0.5, "Loamy": 0.9, "Clay": 0.6, "Sandy": 0.7},
    "Banana": {"Alluvial": 0.9, "Black": 0.8, "Red": 0.75, "Laterite": 0.7, "Desert": 0.3, "Mountain": 0.4, "Loamy": 0.95, "Clay": 0.75, "Sandy": 0.55},
    "Grapes": {"Alluvial": 0.75, "Black": 0.9, "Red": 0.85, "Laterite": 0.6, "Desert": 0.5, "Mountain": 0.55, "Loamy": 0.85, "Clay": 0.6, "Sandy": 0.75},
    "Pomegranate": {"Alluvial": 0.7, "Black": 0.85, "Red": 0.9, "Laterite": 0.65, "Desert": 0.7, "Mountain": 0.55, "Loamy": 0.85, "Clay": 0.55, "Sandy": 0.8},
    "Orange": {"Alluvial": 0.8, "Black": 0.75, "Red": 0.85, "Laterite": 0.7, "Desert": 0.4, "Mountain": 0.65, "Loamy": 0.9, "Clay": 0.6, "Sandy": 0.7},
    "Guava": {"Alluvial": 0.85, "Black": 0.8, "Red": 0.8, "Laterite": 0.65, "Desert": 0.5, "Mountain": 0.55, "Loamy": 0.9, "Clay": 0.7, "Sandy": 0.65},
    "Papaya": {"Alluvial": 0.85, "Black": 0.75, "Red": 0.8, "Laterite": 0.65, "Desert": 0.4, "Mountain": 0.45, "Loamy": 0.9, "Clay": 0.6, "Sandy": 0.75},
    "Watermelon": {"Alluvial": 0.8, "Black": 0.7, "Red": 0.75, "Laterite": 0.55, "Desert": 0.65, "Mountain": 0.4, "Loamy": 0.85, "Clay": 0.55, "Sandy": 0.9},
    "Lemon": {"Alluvial": 0.8, "Black": 0.75, "Red": 0.85, "Laterite": 0.7, "Desert": 0.45, "Mountain": 0.6, "Loamy": 0.9, "Clay": 0.6, "Sandy": 0.7},
    
    # Spices
    "Turmeric": {"Alluvial": 0.8, "Black": 0.7, "Red": 0.9, "Laterite": 0.75, "Desert": 0.3, "Mountain": 0.6, "Loamy": 0.95, "Clay": 0.6, "Sandy": 0.55},
    "Cumin": {"Alluvial": 0.75, "Black": 0.8, "Red": 0.75, "Laterite": 0.5, "Desert": 0.7, "Mountain": 0.5, "Loamy": 0.85, "Clay": 0.55, "Sandy": 0.8},
}

# Default crop parameters (kg/hectare for yield)
DEFAULT_YIELDS = {
    # Cereals
    "Rice": 2899, "Wheat": 3587, "Maize": 3518, "Barley": 3049,
    "Bajra": 1507, "Jowar": 1225, "Ragi": 1492,
    # Pulses
    "Tur": 823, "Gram": 1180, "Urad": 697, "Moong": 685, "Lentil": 1038,
    "Chickpea": 1100, "Arhar": 850,
    # Oilseeds
    "Groundnut": 1800, "Soybean": 1200, "Sunflower": 800, "Mustard": 1200, "Sesame": 400,
    # Cash Crops
    "Cotton": 500, "Sugarcane": 75000, "Jute": 2500, "Tobacco": 1800,
    # Vegetables
    "Potato": 22000, "Onion": 18000, "Tomato": 25000, "Brinjal": 30000,
    "Cabbage": 25000, "Cauliflower": 20000, "Okra": 10000, "Carrot": 20000,
    "Green Peas": 8000, "Spinach": 15000, "Chilli": 5000, "Garlic": 8000,
    "Ginger": 15000, "Coriander": 2000, "Capsicum": 15000, "Cucumber": 20000,
    "Pumpkin": 25000, "Radish": 18000,
    # Fruits (per hectare/year for perennials)
    "Mango": 8000, "Banana": 35000, "Grapes": 20000, "Pomegranate": 12000,
    "Orange": 15000, "Guava": 20000, "Papaya": 40000, "Apple": 10000,
    "Watermelon": 30000, "Lemon": 15000, "Coconut": 12000, "Litchi": 6000,
    # Spices
    "Turmeric": 5000, "Cumin": 600, "Fenugreek": 1200, "Black Pepper": 500, "Cardamom": 250,
}

# MSP 2025-26 (INR per quintal)
MSP_RATES_2025 = {
    "Rice": 2369, "Wheat": 2425, "Maize": 2400, "Barley": 1980,
    "Bajra": 2625, "Jowar": 3371, "Ragi": 4290,
    "Tur": 7550, "Gram": 5725, "Urad": 7400, "Moong": 8682, "Lentil": 6700,
    "Cotton": 7521, "Groundnut": 6783, "Soybean": 4892, "Sunflower": 7280,
    "Mustard": 5950, "Sesame": 9267,
    "Sugarcane": 340,  # per quintal FRP
}

# Fertilizer types and their NPK ratios
FERTILIZERS = {
    "Urea": {"N": 46, "P": 0, "K": 0, "cost_per_kg": 6},
    "DAP": {"N": 18, "P": 46, "K": 0, "cost_per_kg": 27},
    "MOP": {"N": 0, "P": 0, "K": 60, "cost_per_kg": 17},
    "NPK": {"N": 12, "P": 32, "K": 16, "cost_per_kg": 22},
    "Organic": {"N": 5, "P": 3, "K": 2, "cost_per_kg": 8},
}

# Cost parameters (INR)
COST_PARAMS = {
    "seed_cost_per_kg": {
        "Rice": 40, "Wheat": 25, "Maize": 35, "Cotton": 800,
        "Potato": 35, "Tomato": 2500, "Onion": 150, "Chilli": 3000,
        "Mango": 500, "Banana": 25, "Grapes": 100,
        "default": 50
    },
    "irrigation_cost_per_mm": 15,
    "labour_cost_per_day": 400,
    "pesticide_cost_base": 2500,
    "market_fee_percent": 2.5,
    "logistics_cost_per_quintal": 50,
}

# Risk weights
RISK_WEIGHTS = {
    "weather_uncertainty": 0.30,
    "price_volatility": 0.25,
    "pest_severity": 0.25,
    "soil_mismatch": 0.20,
}

# Simulation parameters
SIMULATION_PARAMS = {
    "num_simulations": 500,
    "rainfall_variance": 0.20,
    "temperature_variance": 0.10,
    "pest_prob_range": (0, 0.30),
    "fertilizer_variance": 0.15,
}

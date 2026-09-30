"""
Pest & Disease Intelligence Module
Provides:
1. Pest data collection from multiple sources (government APIs, farmer reports)
2. Pest pattern analysis and correlation with weather/geography
3. Outbreak prediction based on historical data and current conditions
"""

import os
import json
import math
import hashlib
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from enum import Enum
from pathlib import Path

# ============================================================================
# DATA MODELS
# ============================================================================

class PestSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AlertSource(str, Enum):
    GOVERNMENT = "government"
    FARMER = "farmer"
    PREDICTION = "prediction"
    HISTORICAL = "historical"

@dataclass
class PestAlert:
    """Active pest alert"""
    id: str
    pest_name: str
    scientific_name: str
    crop: str
    severity: PestSeverity
    region: str
    district: str
    source: AlertSource
    description: str
    recommendations: List[str]
    timestamp: datetime
    expires: Optional[datetime] = None
    
    def to_dict(self) -> dict:
        return {
            **asdict(self),
            "severity": self.severity.value,
            "source": self.source.value,
            "timestamp": self.timestamp.isoformat(),
            "expires": self.expires.isoformat() if self.expires else None
        }

@dataclass
class FarmerReport:
    """Farmer-submitted pest sighting"""
    id: str
    farmer_id: str  # Anonymous ID
    pest_type: str
    crop: str
    severity: PestSeverity
    location: Dict[str, float]  # lat, lng
    district: str
    state: str
    description: str
    photo_url: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    verified: bool = False
    
    def to_dict(self) -> dict:
        return {
            **asdict(self),
            "severity": self.severity.value,
            "timestamp": self.timestamp.isoformat()
        }

@dataclass
class OutbreakPrediction:
    """Predicted pest outbreak"""
    pest_name: str
    crop: str
    probability: float  # 0-1
    risk_level: PestSeverity
    factors: List[str]
    recommended_actions: List[str]
    confidence: Optional[float]
    valid_until: datetime
    
    def to_dict(self) -> dict:
        return {
            **asdict(self),
            "risk_level": self.risk_level.value,
            "score_kind": "heuristic_suitability_index_not_calibrated_probability",
            "regional_data_available": False,
            "method_version": "weather_season_v2",
            "valid_until": self.valid_until.isoformat()
        }

# ============================================================================
# PEST DATABASE - Common pests in India by crop
# ============================================================================

PEST_DATABASE = {
    "rice": {
        "brown_planthopper": {
            "scientific_name": "Nilaparvata lugens",
            "common_name": "Brown Planthopper (BPH)",
            "favorable_conditions": {"temp_min": 25, "temp_max": 30, "humidity_min": 80},
            "peak_months": [7, 8, 9],  # July-Sept
            "damage_symptoms": ["Hopper burn", "Yellowing of leaves", "Wilting"],
            "control_measures": [
                "Drain water from field for 3-4 days",
                "Apply Imidacloprid 17.8 SL @ 0.3ml/L",
                "Use light traps (1 per acre)",
                "Avoid excess nitrogen fertilizer"
            ]
        },
        "stem_borer": {
            "scientific_name": "Scirpophaga incertulas",
            "common_name": "Yellow Stem Borer",
            "favorable_conditions": {"temp_min": 28, "temp_max": 35, "humidity_min": 70},
            "peak_months": [6, 7, 8, 9, 10],
            "damage_symptoms": ["Dead hearts in vegetative stage", "White ear heads"],
            "control_measures": [
                "Install pheromone traps (5/acre)",
                "Release Trichogramma japonicum",
                "Apply Chlorantraniliprole 0.4G @ 10kg/ha",
                "Remove and destroy stubbles"
            ]
        },
        "leaf_folder": {
            "scientific_name": "Cnaphalocrocis medinalis",
            "common_name": "Rice Leaf Folder",
            "favorable_conditions": {"temp_min": 25, "temp_max": 32, "humidity_min": 85},
            "peak_months": [7, 8, 9],
            "damage_symptoms": ["Longitudinal folding of leaves", "Scraping of green tissue"],
            "control_measures": [
                "Spray Flubendiamide 480 SC @ 0.1ml/L",
                "Apply Neem oil @ 3ml/L",
                "Maintain optimum spacing",
                "Avoid excess nitrogen"
            ]
        }
    },
    "wheat": {
        "aphid": {
            "scientific_name": "Sitobion avenae",
            "common_name": "Wheat Aphid",
            "favorable_conditions": {"temp_min": 15, "temp_max": 25, "humidity_min": 60},
            "peak_months": [1, 2, 3],  # Jan-March
            "damage_symptoms": ["Yellowing of leaves", "Stunted growth", "Honeydew secretion"],
            "control_measures": [
                "Spray Dimethoate 30 EC @ 1ml/L",
                "Apply Neem seed kernel extract @ 5%",
                "Encourage natural predators (ladybird beetles)",
                "Avoid late sowing"
            ]
        },
        "termite": {
            "scientific_name": "Odontotermes obesus",
            "common_name": "Termite",
            "favorable_conditions": {"temp_min": 20, "temp_max": 35, "humidity_min": 40},
            "peak_months": [11, 12, 1, 2],
            "damage_symptoms": ["Drying of plants in patches", "Hollow stems", "Mud galleries"],
            "control_measures": [
                "Apply Chlorpyrifos 20 EC @ 4L/ha with irrigation",
                "Use well-decomposed FYM only",
                "Avoid moisture stress",
                "Seed treatment with Imidacloprid"
            ]
        }
    },
    "cotton": {
        "bollworm": {
            "scientific_name": "Helicoverpa armigera",
            "common_name": "American Bollworm",
            "favorable_conditions": {"temp_min": 25, "temp_max": 35, "humidity_min": 50},
            "peak_months": [7, 8, 9, 10],
            "damage_symptoms": ["Bore holes in bolls", "Damaged squares", "Shedding of flowers"],
            "control_measures": [
                "Install pheromone traps (5/acre)",
                "Spray Emamectin benzoate 5 SG @ 0.4g/L",
                "Release Trichogramma chilonis",
                "Grow trap crops (marigold, castor)"
            ]
        },
        "whitefly": {
            "scientific_name": "Bemisia tabaci",
            "common_name": "Cotton Whitefly",
            "favorable_conditions": {"temp_min": 28, "temp_max": 38, "humidity_min": 60},
            "peak_months": [8, 9, 10],
            "damage_symptoms": ["Yellowing of leaves", "Sticky honeydew", "Sooty mold", "Leaf curl"],
            "control_measures": [
                "Spray Diafenthiuron 50 WP @ 1g/L",
                "Apply Neem oil @ 5ml/L",
                "Install yellow sticky traps",
                "Remove alternate host weeds"
            ]
        },
        "pink_bollworm": {
            "scientific_name": "Pectinophora gossypiella",
            "common_name": "Pink Bollworm",
            "favorable_conditions": {"temp_min": 25, "temp_max": 32, "humidity_min": 50},
            "peak_months": [9, 10, 11],
            "damage_symptoms": ["Rosetted flowers", "Pink larvae in bolls", "Damaged seeds"],
            "control_measures": [
                "Use Bt cotton varieties",
                "Install pheromone traps",
                "Deep summer ploughing",
                "Destroy crop residues after harvest"
            ]
        }
    },
    "sugarcane": {
        "early_shoot_borer": {
            "scientific_name": "Chilo infuscatellus",
            "common_name": "Early Shoot Borer",
            "favorable_conditions": {"temp_min": 28, "temp_max": 38, "humidity_min": 70},
            "peak_months": [3, 4, 5, 6],
            "damage_symptoms": ["Dead hearts", "Bore holes in shoots", "Frass in shoots"],
            "control_measures": [
                "Release Trichogramma chilonis @ 50000/ha",
                "Install pheromone traps",
                "Apply Chlorantraniliprole 0.4G @ 20kg/ha",
                "Maintain proper spacing"
            ]
        },
        "top_borer": {
            "scientific_name": "Scirpophaga excerptalis",
            "common_name": "Top Shoot Borer",
            "favorable_conditions": {"temp_min": 25, "temp_max": 35, "humidity_min": 80},
            "peak_months": [5, 6, 7, 8],
            "damage_symptoms": ["Bunchy top", "Dead heart", "Side shoots"],
            "control_measures": [
                "Detrash leaves up to 3rd internode",
                "Release Cotesia flavipes",
                "Apply Fipronil 5 SC @ 1.5ml/L",
                "Collect and destroy egg masses"
            ]
        },
        "woolly_aphid": {
            "scientific_name": "Ceratovacuna lanigera",
            "common_name": "Sugarcane Woolly Aphid",
            "favorable_conditions": {"temp_min": 25, "temp_max": 30, "humidity_min": 85},
            "peak_months": [8, 9, 10, 11],
            "damage_symptoms": ["White waxy coating", "Yellowing", "Stunted growth", "Sooty mold"],
            "control_measures": [
                "Spray Dimethoate 30 EC @ 2ml/L",
                "Release Dipha aphidivora predator",
                "Detrash affected leaves",
                "Avoid water stress"
            ]
        }
    }
}

# State-wise pest hotspots (mock data simulating government data)
STATE_PEST_HOTSPOTS = {
    "Punjab": ["wheat_aphid", "rice_stem_borer", "cotton_whitefly"],
    "Haryana": ["wheat_termite", "rice_bph", "cotton_bollworm"],
    "Uttar Pradesh": ["sugarcane_shoot_borer", "rice_leaf_folder", "wheat_aphid"],
    "Maharashtra": ["cotton_pink_bollworm", "sugarcane_woolly_aphid", "soybean_girdle_beetle"],
    "Gujarat": ["cotton_bollworm", "groundnut_leaf_miner", "castor_semilooper"],
    "Andhra Pradesh": ["rice_bph", "cotton_whitefly", "chilli_thrips"],
    "Tamil Nadu": ["rice_stem_borer", "groundnut_red_hairy_caterpillar", "sugarcane_top_borer"],
    "Karnataka": ["rice_gall_midge", "cotton_bollworm", "ragi_aphid"],
    "West Bengal": ["rice_bph", "jute_semilooper", "potato_tuber_moth"],
    "Madhya Pradesh": ["soybean_girdle_beetle", "wheat_aphid", "cotton_bollworm"]
}


# ============================================================================
# PEST DATA COLLECTOR
# ============================================================================

class PestDataCollector:
    """Collect pest data from multiple sources"""
    
    def __init__(self):
        self.govt_api_url = os.getenv("GOVT_PEST_API_URL", "")
        self.icar_api_key = os.getenv("ICAR_API_KEY", "")
    
    def get_government_alerts(self, state: str, district: str = None) -> List[PestAlert]:
        """No verified government feed is integrated. An empty list means unavailable."""
        return []

    def get_historical_outbreaks(self, crop: str, state: str, years: int = 3) -> List[Dict]:
        """Do not manufacture historical outbreaks from seasonal rules."""
        return []


# ============================================================================
# PEST ANALYZER
# ============================================================================

class PestAnalyzer:
    """Analyze pest patterns and correlations"""
    
    def correlate_with_weather(self, crop: str, pest_name: str, 
                               temperature: float, humidity: float) -> float:
        """
        Calculate pest risk based on current weather conditions.
        Returns risk score 0-1.
        """
        crop_lower = crop.lower()
        if crop_lower not in PEST_DATABASE:
            return 0.3  # Default moderate risk
        
        for pest_id, pest_info in PEST_DATABASE[crop_lower].items():
            if pest_name.lower() in pest_info["common_name"].lower():
                conditions = pest_info.get("favorable_conditions", {})
                
                # Check temperature fit
                temp_min = conditions.get("temp_min", 20)
                temp_max = conditions.get("temp_max", 35)
                humidity_min = conditions.get("humidity_min", 50)
                
                temp_risk = 0.0
                if temp_min <= temperature <= temp_max:
                    # Temperature is in favorable range
                    temp_risk = 0.8
                elif temperature < temp_min:
                    temp_risk = max(0, 0.8 - (temp_min - temperature) * 0.1)
                else:
                    temp_risk = max(0, 0.8 - (temperature - temp_max) * 0.1)
                
                # Check humidity fit
                humidity_risk = 0.0
                if humidity >= humidity_min:
                    humidity_risk = min(1.0, 0.5 + (humidity - humidity_min) * 0.01)
                else:
                    humidity_risk = max(0, 0.5 - (humidity_min - humidity) * 0.02)
                
                # Combined risk
                return min(1.0, (temp_risk * 0.6 + humidity_risk * 0.4))
        
        return 0.3
    
    def get_seasonal_risk(self, crop: str) -> Dict[str, Any]:
        """
        Get overall pest risk for crop based on current season.
        """
        current_month = datetime.now().month
        crop_lower = crop.lower()
        
        if crop_lower not in PEST_DATABASE:
            return {"crop": crop, "available": False, "risk_level": None, "active_pests": []}
        
        active_pests = []
        max_risk = "low"
        
        for pest_id, pest_info in PEST_DATABASE[crop_lower].items():
            if current_month in pest_info.get("peak_months", []):
                active_pests.append({
                    "name": pest_info["common_name"],
                    "scientific_name": pest_info["scientific_name"],
                    "symptoms": pest_info["damage_symptoms"],
                    "controls": pest_info["control_measures"][:2]
                })
                max_risk = "high"
            elif any(min(abs(current_month - m), 12 - abs(current_month - m)) <= 1 for m in pest_info.get("peak_months", [])):
                # Near peak season
                if max_risk != "high":
                    max_risk = "medium"
        
        return {
            "crop": crop,
            "month": current_month,
            "risk_level": max_risk,
            "active_pests": active_pests
        }
    
    def get_risk_by_location(self, lat: float, lng: float, crop: str) -> Dict[str, Any]:
        """
        Get pest risk based on geographic location.
        Uses approximate state detection from coordinates.
        """
        return {
            "state": None, "crop": crop, "available": False,
            "location_risk": None, "regional_threats": [],
            "coordinates": {"lat": lat, "lng": lng},
            "reason": "Verified regional outbreak observations are not integrated."
        }

    def _detect_state(self, lat: float, lng: float) -> Optional[str]:
        """No state assertion without an administrative boundary/geocoding source."""
        return None


# ============================================================================
# OUTBREAK PREDICTOR
# ============================================================================

class OutbreakPredictor:
    """Predict pest outbreak probability based on multiple factors"""
    
    def __init__(self):
        self.collector = PestDataCollector()
        self.analyzer = PestAnalyzer()
    
    def predict_outbreak(self, crop: str, weather: Dict[str, float], 
                         lat: float, lng: float) -> List[OutbreakPrediction]:
        """
        Predict pest outbreak probability for given crop and conditions.
        """
        predictions = []
        crop_lower = crop.lower()
        
        if crop_lower not in PEST_DATABASE:
            return predictions
        
        for key, lower, upper in [('temperature', -10, 60), ('humidity', 0, 100), ('rainfall', 0, 10000)]:
            value = weather.get(key)
            if (isinstance(value, bool) or not isinstance(value, (int, float))
                    or not math.isfinite(value) or not lower <= value <= upper):
                raise ValueError(f"A valid observed {key} is required")
        temperature = weather['temperature']
        humidity = weather['humidity']
        rainfall = weather['rainfall']
        
        current_month = datetime.now().month
        
        for pest_id, pest_info in PEST_DATABASE[crop_lower].items():
            # Factor 1: Seasonal risk
            seasonal_risk = 0.3
            if current_month in pest_info.get("peak_months", []):
                seasonal_risk = 0.8
            elif any(min(abs(current_month - m), 12 - abs(current_month - m)) <= 1 for m in pest_info.get("peak_months", [])):
                seasonal_risk = 0.5
            
            # Factor 2: Weather correlation
            weather_risk = self.analyzer.correlate_with_weather(
                crop, pest_info["common_name"], temperature, humidity
            )
            
            # Factor 4: Recent rainfall impact
            rain_risk = 0.3
            if rainfall > 50:
                rain_risk = 0.7 if pest_info.get("favorable_conditions", {}).get("humidity_min", 50) > 70 else 0.4
            
            # Weather/season suitability only; normalized after removing mock regional risk.
            probability = (
                seasonal_risk * 0.35 +
                weather_risk * 0.30 +
                rain_risk * 0.15
            ) / 0.80
            
            # Determine risk level
            if probability >= 0.7:
                risk_level = PestSeverity.HIGH
            elif probability >= 0.5:
                risk_level = PestSeverity.MEDIUM
            else:
                risk_level = PestSeverity.LOW
            
            # Generate factors list
            factors = []
            if seasonal_risk >= 0.5:
                factors.append(f"Peak season for {pest_info['common_name']}")
            if weather_risk >= 0.6:
                factors.append(f"Favorable weather conditions (Temp: {temperature}°C, Humidity: {humidity}%)")
            if rain_risk >= 0.5:
                factors.append(f"Recent rainfall ({rainfall}mm) increases pest activity")
            
            if not factors:
                factors.append("No significant risk factors detected")
            
            prediction = OutbreakPrediction(
                pest_name=pest_info["common_name"],
                crop=crop.title(),
                probability=round(probability, 2),
                risk_level=risk_level,
                factors=factors,
                recommended_actions=pest_info["control_measures"][:3],
                confidence=None,  # No empirical calibration data
                valid_until=datetime.now() + timedelta(days=3)
            )
            predictions.append(prediction)
        
        # Sort by probability descending
        predictions.sort(key=lambda x: x.probability, reverse=True)
        return predictions


# ============================================================================
# MAIN SERVICE CLASS
# ============================================================================

class PestIntelligenceService:
    """Main service class combining all pest intelligence functionality"""
    
    def __init__(self):
        self.collector = PestDataCollector()
        self.analyzer = PestAnalyzer()
        self.predictor = OutbreakPredictor()
    
    def get_alerts(self, state: str, district: str = None, crop: str = None) -> List[Dict]:
        """Get active pest alerts for a region"""
        alerts = self.collector.get_government_alerts(state, district)
        
        # Filter by crop if specified
        if crop:
            alerts = [a for a in alerts if a.crop.lower() == crop.lower()]
        
        return [a.to_dict() for a in alerts]
    
    def get_predictions(self, crop: str, weather: Dict, lat: float, lng: float) -> List[Dict]:
        """Get outbreak predictions"""
        predictions = self.predictor.predict_outbreak(crop, weather, lat, lng)
        return [p.to_dict() for p in predictions]
    
    def get_seasonal_risk(self, crop: str) -> Dict:
        """Get current seasonal pest risk"""
        return self.analyzer.get_seasonal_risk(crop)
    
    def get_history(self, crop: str, state: str, years: int = 3) -> List[Dict]:
        """Get historical outbreak data"""
        return self.collector.get_historical_outbreaks(crop, state, years)


# Singleton instance
pest_service = PestIntelligenceService()

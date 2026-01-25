"""
Pest & Disease Intelligence Module
Provides:
1. Pest data collection from multiple sources (government APIs, farmer reports)
2. Pest pattern analysis and correlation with weather/geography
3. Outbreak prediction based on historical data and current conditions
"""

import os
import json
import random
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
    confidence: float
    valid_until: datetime
    
    def to_dict(self) -> dict:
        return {
            **asdict(self),
            "risk_level": self.risk_level.value,
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
        """
        Get pest alerts from government sources.
        In production: Call ICAR/NCIPM/Krishi Portal APIs
        For hackathon: Return mock data based on state hotspots
        """
        alerts = []
        current_month = datetime.now().month
        
        # Get hotspot pests for the state
        hotspot_pests = STATE_PEST_HOTSPOTS.get(state, [])
        
        for pest_key in hotspot_pests[:2]:  # Limit to 2 active alerts
            # Parse pest key
            parts = pest_key.split("_", 1)
            if len(parts) != 2:
                continue
                
            crop, pest_short = parts
            
            # Find pest in database
            if crop in PEST_DATABASE:
                for pest_id, pest_info in PEST_DATABASE[crop].items():
                    if pest_short in pest_id:
                        # Check if pest is active this month
                        if current_month in pest_info.get("peak_months", []):
                            severity = PestSeverity.HIGH if random.random() > 0.5 else PestSeverity.MEDIUM
                        else:
                            severity = PestSeverity.LOW
                        
                        alert = PestAlert(
                            id=hashlib.md5(f"{pest_key}_{state}_{datetime.now().date()}".encode()).hexdigest()[:12],
                            pest_name=pest_info["common_name"],
                            scientific_name=pest_info["scientific_name"],
                            crop=crop.title(),
                            severity=severity,
                            region=state,
                            district=district or "All Districts",
                            source=AlertSource.GOVERNMENT,
                            description=f"Active {pest_info['common_name']} infestation reported. Symptoms: {', '.join(pest_info['damage_symptoms'][:2])}",
                            recommendations=pest_info["control_measures"][:3],
                            timestamp=datetime.now() - timedelta(hours=random.randint(1, 48)),
                            expires=datetime.now() + timedelta(days=7)
                        )
                        alerts.append(alert)
                        break
        
        return alerts
    
    def get_historical_outbreaks(self, crop: str, state: str, years: int = 3) -> List[Dict]:
        """
        Get historical outbreak data for trend analysis.
        Returns mock data simulating historical records.
        """
        outbreaks = []
        current_year = datetime.now().year
        
        crop_lower = crop.lower()
        if crop_lower not in PEST_DATABASE:
            return outbreaks
        
        for pest_id, pest_info in PEST_DATABASE[crop_lower].items():
            for year_offset in range(years):
                year = current_year - year_offset
                for month in pest_info.get("peak_months", []):
                    # Generate mock historical data
                    outbreak = {
                        "pest_name": pest_info["common_name"],
                        "crop": crop,
                        "year": year,
                        "month": month,
                        "severity": random.choice(["low", "medium", "high"]),
                        "affected_area_hectares": random.randint(100, 5000),
                        "state": state,
                        "yield_loss_percent": random.uniform(5, 25)
                    }
                    outbreaks.append(outbreak)
        
        return outbreaks


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
            return {"risk_level": "low", "active_pests": []}
        
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
            elif any(abs(current_month - m) <= 1 for m in pest_info.get("peak_months", [])):
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
        # Simplified state detection based on coordinates (India-centric)
        state = self._detect_state(lat, lng)
        
        hotspot_pests = STATE_PEST_HOTSPOTS.get(state, [])
        crop_lower = crop.lower()
        
        relevant_pests = [p for p in hotspot_pests if crop_lower in p]
        
        risk_level = "low"
        if len(relevant_pests) >= 2:
            risk_level = "high"
        elif len(relevant_pests) == 1:
            risk_level = "medium"
        
        return {
            "state": state,
            "crop": crop,
            "location_risk": risk_level,
            "regional_threats": relevant_pests,
            "coordinates": {"lat": lat, "lng": lng}
        }
    
    def _detect_state(self, lat: float, lng: float) -> str:
        """
        Approximate state detection from coordinates.
        Simplified for hackathon - uses bounding boxes.
        """
        # Simplified state detection
        if 28 <= lat <= 32 and 74 <= lng <= 77:
            return "Punjab"
        elif 28 <= lat <= 30 and 74 <= lng <= 77:
            return "Haryana"
        elif 24 <= lat <= 31 and 77 <= lng <= 85:
            return "Uttar Pradesh"
        elif 18 <= lat <= 22 and 72 <= lng <= 80:
            return "Maharashtra"
        elif 20 <= lat <= 24 and 68 <= lng <= 75:
            return "Gujarat"
        elif 12 <= lat <= 19 and 77 <= lng <= 84:
            return "Andhra Pradesh"
        elif 8 <= lat <= 13 and 76 <= lng <= 80:
            return "Tamil Nadu"
        elif 11 <= lat <= 18 and 74 <= lng <= 78:
            return "Karnataka"
        elif 20 <= lat <= 27 and 85 <= lng <= 90:
            return "West Bengal"
        elif 21 <= lat <= 27 and 74 <= lng <= 82:
            return "Madhya Pradesh"
        else:
            return "Other"


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
        
        temperature = weather.get("temperature", 25)
        humidity = weather.get("humidity", 60)
        rainfall = weather.get("rainfall", 0)
        
        current_month = datetime.now().month
        location_risk = self.analyzer.get_risk_by_location(lat, lng, crop)
        
        for pest_id, pest_info in PEST_DATABASE[crop_lower].items():
            # Factor 1: Seasonal risk
            seasonal_risk = 0.3
            if current_month in pest_info.get("peak_months", []):
                seasonal_risk = 0.8
            elif any(abs(current_month - m) <= 1 for m in pest_info.get("peak_months", [])):
                seasonal_risk = 0.5
            
            # Factor 2: Weather correlation
            weather_risk = self.analyzer.correlate_with_weather(
                crop, pest_info["common_name"], temperature, humidity
            )
            
            # Factor 3: Location risk
            geo_risk = 0.3
            if location_risk["location_risk"] == "high":
                geo_risk = 0.7
            elif location_risk["location_risk"] == "medium":
                geo_risk = 0.5
            
            # Factor 4: Recent rainfall impact
            rain_risk = 0.3
            if rainfall > 50:
                rain_risk = 0.7 if pest_info.get("favorable_conditions", {}).get("humidity_min", 50) > 70 else 0.4
            
            # Combined probability (weighted average)
            probability = (
                seasonal_risk * 0.35 +
                weather_risk * 0.30 +
                geo_risk * 0.20 +
                rain_risk * 0.15
            )
            
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
            if geo_risk >= 0.5:
                factors.append(f"High regional risk in {location_risk['state']}")
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
                confidence=0.75 + random.uniform(-0.1, 0.15),  # 65-90% confidence
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

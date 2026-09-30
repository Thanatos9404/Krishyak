"""Yield estimation engine with multi-factor modeling"""
import numpy as np
from typing import Dict, Tuple
import config
from data_loader import DataLoader

class YieldEstimator:
    """Estimate crop yield based on multiple agricultural factors"""
    
    def __init__(self):
        self.data_loader = DataLoader()
    
    def estimate_yield(
        self,
        crop: str,
        soil_type: str,
        seed_quality: float,  # 0-1 scale
        expected_rainfall: float,  # mm
        rainfall_delay: int,  # days
        irrigation_frequency: int,  # times per month
        fertilizer_mix: Dict[str, float],  # kg per hectare
        pest_probability: float,  # 0-1 scale
        area_hectares: float = 1.0,
        *, baseline_record=None
    ) -> Dict:
        """
        Estimate crop yield with all modifying factors
        Returns: yield (kg/hectare), confidence, breakdown
        """
        # Get base yield for the crop
        baseline_metadata = dict(baseline_record) if baseline_record is not None else self.data_loader.get_crop_yield_record(crop)
        base_yield = baseline_metadata['value']
        
        # Apply modifiers
        soil_modifier = self._calculate_soil_modifier(crop, soil_type)
        rainfall_modifier = self._calculate_rainfall_modifier(crop, expected_rainfall, rainfall_delay)
        irrigation_modifier = self._calculate_irrigation_modifier(irrigation_frequency, expected_rainfall)
        fertilizer_modifier = self._calculate_fertilizer_modifier(crop, fertilizer_mix)
        seed_modifier = self._calculate_seed_modifier(seed_quality)
        pest_modifier = self._calculate_pest_modifier(pest_probability)
        
        # Combine all modifiers (multiplicative model)
        total_modifier = (
            soil_modifier * 
            rainfall_modifier * 
            irrigation_modifier * 
            fertilizer_modifier * 
            seed_modifier * 
            pest_modifier
        )
        
        # Calculate final yield
        estimated_yield = base_yield * total_modifier
        
        # Calculate confidence (based on input quality and variability)
        confidence = self._calculate_confidence(
            seed_quality, pest_probability, soil_modifier, rainfall_modifier
        )
        
        # Total production
        total_production = estimated_yield * area_hectares
        
        return {
            "yield_per_hectare": round(estimated_yield, 2),
            "total_production_kg": round(total_production, 2),
            "total_production_quintals": round(total_production / 100, 2),
            "base_yield": base_yield,
            "baseline_metadata": baseline_metadata,
            "confidence": round(confidence, 2),
            "confidence_kind": "uncalibrated_input_suitability_score",
            "method": "multiplicative_agronomic_heuristic",
            "modifiers": {
                "soil": round(soil_modifier, 3),
                "rainfall": round(rainfall_modifier, 3),
                "irrigation": round(irrigation_modifier, 3),
                "fertilizer": round(fertilizer_modifier, 3),
                "seed_quality": round(seed_modifier, 3),
                "pest_impact": round(pest_modifier, 3),
                "total": round(total_modifier, 3)
            }
        }
    
    def _calculate_soil_modifier(self, crop: str, soil_type: str) -> float:
        """Calculate yield modifier based on soil compatibility"""
        if crop in config.CROP_SOIL_COMPATIBILITY and soil_type in config.CROP_SOIL_COMPATIBILITY[crop]:
            return config.CROP_SOIL_COMPATIBILITY[crop][soil_type]
        
        # Default compatibility for unknown combinations
        default_compat = {
            "Alluvial": 0.8, "Black": 0.75, "Red": 0.7, 
            "Laterite": 0.6, "Desert": 0.4, "Mountain": 0.6,
            "Clay": 0.75, "Sandy": 0.5
        }
        return default_compat.get(soil_type, 0.7)
    
    def _calculate_rainfall_modifier(self, crop: str, rainfall: float, delay: int) -> float:
        """Calculate yield impact of rainfall amount and timing"""
        # Optimal rainfall ranges by crop type (mm)
        optimal_ranges = {
            "Rice": (1000, 1500),
            "Wheat": (400, 600),
            "Maize": (600, 900),
            "Cotton": (600, 1000),
            "Sugarcane": (1200, 1800),
        }
        
        optimal = optimal_ranges.get(crop, (500, 800))
        optimal_mid = (optimal[0] + optimal[1]) / 2
        
        # Deviation from optimal
        if optimal[0] <= rainfall <= optimal[1]:
            rainfall_factor = 1.0
        elif rainfall < optimal[0]:
            deficit = (optimal[0] - rainfall) / optimal[0]
            rainfall_factor = max(0.4, 1.0 - deficit * 0.6)
        else:
            excess = (rainfall - optimal[1]) / optimal[1]
            rainfall_factor = max(0.5, 1.0 - excess * 0.4)
        
        # Delay penalty (monsoon delay impact)
        delay_penalty = max(0, delay) * 0.015  # 1.5% per day delay
        delay_factor = max(0.6, 1.0 - delay_penalty)
        
        return rainfall_factor * delay_factor
    
    def _calculate_irrigation_modifier(self, frequency: int, rainfall: float) -> float:
        """Calculate benefit of irrigation"""
        # If rainfall is adequate, irrigation has diminishing returns
        if rainfall > 800:
            base_benefit = 1.0 + (frequency * 0.01)  # 1% per irrigation
        else:
            # Low rainfall: irrigation is critical
            deficit_factor = max(0, (800 - rainfall) / 800)
            base_benefit = 1.0 + (frequency * 0.03 * (1 + deficit_factor))
        
        return min(1.3, base_benefit)  # Cap at 30% boost
    
    def _calculate_fertilizer_modifier(self, crop: str, fertilizer_mix: Dict[str, float]) -> float:
        """Calculate yield impact of fertilizer application"""
        if not fertilizer_mix:
            return 0.7  # No fertilizer penalty
        
        # Calculate total NPK applied
        total_n = sum(
            qty * config.FERTILIZERS.get(fert, {}).get("N", 0) / 100 
            for fert, qty in fertilizer_mix.items()
            if fert in config.FERTILIZERS
        )
        total_p = sum(
            qty * config.FERTILIZERS.get(fert, {}).get("P", 0) / 100
            for fert, qty in fertilizer_mix.items()
            if fert in config.FERTILIZERS
        )
        total_k = sum(
            qty * config.FERTILIZERS.get(fert, {}).get("K", 0) / 100
            for fert, qty in fertilizer_mix.items()
            if fert in config.FERTILIZERS
        )
        
        # Optimal NPK ranges (kg/hectare)
        optimal_npk = {
            "Rice": (80, 40, 40),
            "Wheat": (120, 60, 40),
            "Maize": (100, 50, 50),
            "Cotton": (100, 50, 50),
        }
        
        target = optimal_npk.get(crop, (80, 40, 40))
        
        # Calculate NPK balance score (0-1)
        n_score = max(0.0, 1.0 - abs(total_n - target[0]) / target[0])
        p_score = max(0.0, 1.0 - abs(total_p - target[1]) / target[1])
        k_score = max(0.0, 1.0 - abs(total_k - target[2]) / target[2])
        
        avg_score = (n_score + p_score + k_score) / 3
        
        # Fertilizer benefit: 0.7 to 1.2
        return 0.7 + (avg_score * 0.5)
    
    def _calculate_seed_modifier(self, quality: float) -> float:
        """Calculate yield impact of seed quality"""
        # Quality ranges from 0 (poor) to 1 (excellent)
        # Yield impact: 0.6 (poor seeds) to 1.1 (excellent seeds)
        return 0.6 + (quality * 0.5)
    
    def _calculate_pest_modifier(self, pest_probability: float) -> float:
        """Calculate yield loss due to pests"""
        # Pest probability 0-1
        # Maximum loss: 40% at probability 1.0
        loss = pest_probability * 0.4
        return 1.0 - loss
    
    def _calculate_confidence(
        self, 
        seed_quality: float, 
        pest_prob: float,
        soil_mod: float,
        rainfall_mod: float
    ) -> float:
        """Calculate confidence score for the estimate"""
        # High seed quality and good soil/rainfall = high confidence
        # High pest risk = lower confidence
        
        quality_factor = seed_quality
        soil_factor = soil_mod
        rainfall_factor = rainfall_mod
        pest_uncertainty = pest_prob  # Higher pest prob = more uncertainty
        
        base_confidence = (quality_factor + soil_factor + rainfall_factor) / 3
        confidence = base_confidence * (1.0 - pest_uncertainty * 0.3)
        
        return min(0.95, max(0.4, confidence))

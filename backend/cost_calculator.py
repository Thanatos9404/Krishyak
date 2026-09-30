"""Cultivation cost calculation engine"""
from typing import Dict
import config

class CostCalculator:
    """Calculate total cost of cultivation"""
    
    def calculate_cultivation_cost(
        self,
        crop: str,
        area_hectares: float,
        seed_quantity_kg: float,
        fertilizer_mix: Dict[str, float],  # kg per hectare
        irrigation_frequency: int,
        expected_rainfall: float,
        labour_days: float,
        pest_control_intensity: float,  # 0-1 scale
        total_production_quintals: float,
        selling_price_per_quintal: float = 0.0,
        season_months: float = 1.0
    ) -> Dict:
        """
        Calculate comprehensive cultivation costs
        Returns breakdown of all costs
        """
        # Seed cost
        seed_cost = self._calculate_seed_cost(crop, seed_quantity_kg)
        
        # Fertilizer cost
        fertilizer_cost = self._calculate_fertilizer_cost(fertilizer_mix, area_hectares)
        
        # Irrigation cost
        irrigation_cost = self._calculate_irrigation_cost(
            irrigation_frequency * season_months, area_hectares, expected_rainfall
        )
        
        # Labour cost
        labour_cost = self._calculate_labour_cost(labour_days)
        
        # Pesticide cost
        pesticide_cost = self._calculate_pesticide_cost(
            area_hectares, pest_control_intensity
        )
        
        # Land preparation cost (standard)
        land_prep_cost = area_hectares * 3500
        
        # Harvesting cost
        harvesting_cost = area_hectares * 4000
        
        # Market fees and logistics
        market_fees = total_production_quintals * selling_price_per_quintal * config.COST_PARAMS["market_fee_percent"] / 100
        logistics_cost = total_production_quintals * config.COST_PARAMS["logistics_cost_per_quintal"]
        
        # Miscellaneous (10% of direct costs)
        direct_costs = (
            seed_cost + fertilizer_cost + irrigation_cost + 
            labour_cost + pesticide_cost + land_prep_cost + harvesting_cost
        )
        miscellaneous = direct_costs * 0.10
        
        # Total cost
        total_cost = (
            direct_costs + market_fees + logistics_cost + miscellaneous
        )
        
        # Cost per quintal
        cost_per_quintal = total_cost / total_production_quintals if total_production_quintals > 0 else 0
        
        return {
            "total_cost": round(total_cost, 2),
            "cost_per_quintal": round(cost_per_quintal, 2),
            "cost_per_hectare": round(total_cost / area_hectares, 2) if area_hectares > 0 else 0,
            "breakdown": {
                "seed_cost": round(seed_cost, 2),
                "fertilizer_cost": round(fertilizer_cost, 2),
                "irrigation_cost": round(irrigation_cost, 2),
                "labour_cost": round(labour_cost, 2),
                "pesticide_cost": round(pesticide_cost, 2),
                "land_preparation": round(land_prep_cost, 2),
                "harvesting_cost": round(harvesting_cost, 2),
                "market_fees": round(market_fees, 2),
                "logistics_cost": round(logistics_cost, 2),
                "miscellaneous": round(miscellaneous, 2)
            }
        }
    
    def _calculate_seed_cost(self, crop: str, quantity_kg: float) -> float:
        """Calculate seed cost"""
        cost_per_kg = config.COST_PARAMS["seed_cost_per_kg"].get(
            crop, 
            config.COST_PARAMS["seed_cost_per_kg"]["default"]
        )
        return quantity_kg * cost_per_kg
    
    def _calculate_fertilizer_cost(self, fertilizer_mix: Dict[str, float], area: float) -> float:
        """Calculate total fertilizer cost"""
        total_cost = 0
        for fertilizer, qty_per_hectare in fertilizer_mix.items():
            if fertilizer in config.FERTILIZERS:
                cost_per_kg = config.FERTILIZERS[fertilizer]["cost_per_kg"]
                total_cost += qty_per_hectare * area * cost_per_kg
        return total_cost
    
    def _calculate_irrigation_cost(self, frequency: int, area: float, rainfall: float) -> float:
        """Calculate irrigation costs"""
        # Assume each irrigation provides 50mm water equivalent
        water_per_irrigation = 50
        total_water_mm = frequency * water_per_irrigation
        
        # Cost per mm per hectare
        cost = total_water_mm * area * config.COST_PARAMS["irrigation_cost_per_mm"]
        
        # Reduce cost if rainfall is high
        if rainfall > 800:
            cost *= 0.7
        
        return cost
    
    def _calculate_labour_cost(self, labour_days: float) -> float:
        """Calculate labour costs"""
        return labour_days * config.COST_PARAMS["labour_cost_per_day"]
    
    def _calculate_pesticide_cost(self, area: float, intensity: float) -> float:
        """Calculate pesticide/pest control costs"""
        base_cost = config.COST_PARAMS["pesticide_cost_base"] * area
        # Intensity multiplier (0-1 scale to 0.5-1.5 multiplier)
        multiplier = 0.5 + intensity
        return base_cost * multiplier

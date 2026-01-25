"""
Fertilizer Analyzer Engine
Smart NPK recommendation based on soil sensor data, crop requirements, and growth stage.

Features:
- Calculate required NPK based on soil readings
- Adjust for crop type, soil type, and growth stage
- Provide dosage in kg/hectare with application schedule
- Include environmental safety notes and organic alternatives
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# ==============================================================================
# DATA STRUCTURES
# ==============================================================================

class GrowthStage(Enum):
    """Crop growth stages for fertilizer timing"""
    BASAL = "basal"                    # Before/during sowing
    EARLY_VEGETATIVE = "early_vegetative"  # 15-25 days after sowing
    LATE_VEGETATIVE = "late_vegetative"    # 30-45 days after sowing
    FLOWERING = "flowering"            # Flowering/panicle initiation
    GRAIN_FILLING = "grain_filling"    # Grain/fruit development
    MATURITY = "maturity"              # Near harvest


@dataclass
class FertilizerDose:
    """Individual fertilizer dose recommendation"""
    fertilizer_name: str
    quantity_kg_per_hectare: float
    npk_contribution: Dict[str, float]  # {"N": x, "P": y, "K": z}
    cost_per_hectare: float
    application_method: str
    
    def to_dict(self) -> Dict:
        return {
            "name": self.fertilizer_name,
            "quantity_kg_ha": round(self.quantity_kg_per_hectare, 1),
            "npk_contribution": {k: round(v, 1) for k, v in self.npk_contribution.items()},
            "cost_inr": round(self.cost_per_hectare, 2),
            "method": self.application_method
        }


@dataclass
class ScheduleEntry:
    """Application schedule entry"""
    stage: str
    days_after_sowing: str
    fertilizers: List[Dict]
    notes: str
    
    def to_dict(self) -> Dict:
        return {
            "stage": self.stage,
            "timing": self.days_after_sowing,
            "fertilizers": self.fertilizers,
            "notes": self.notes
        }


# ==============================================================================
# CROP NPK REQUIREMENTS DATABASE (kg/hectare)
# ==============================================================================

CROP_NPK_REQUIREMENTS = {
    # Cereals
    "Rice": {
        "N": 120, "P": 60, "K": 60,
        "stage_split": {
            "basal": {"N": 0.25, "P": 1.0, "K": 0.5},
            "early_vegetative": {"N": 0.25, "P": 0, "K": 0},
            "late_vegetative": {"N": 0.25, "P": 0, "K": 0.25},
            "flowering": {"N": 0.25, "P": 0, "K": 0.25},
        }
    },
    "Wheat": {
        "N": 120, "P": 60, "K": 40,
        "stage_split": {
            "basal": {"N": 0.5, "P": 1.0, "K": 1.0},
            "early_vegetative": {"N": 0.25, "P": 0, "K": 0},
            "flowering": {"N": 0.25, "P": 0, "K": 0},
        }
    },
    "Maize": {
        "N": 150, "P": 75, "K": 60,
        "stage_split": {
            "basal": {"N": 0.33, "P": 1.0, "K": 1.0},
            "early_vegetative": {"N": 0.33, "P": 0, "K": 0},
            "flowering": {"N": 0.34, "P": 0, "K": 0},
        }
    },
    
    # Pulses (lower N due to nitrogen fixation)
    "Gram": {
        "N": 20, "P": 60, "K": 20,
        "stage_split": {
            "basal": {"N": 1.0, "P": 1.0, "K": 1.0},
        }
    },
    "Moong": {
        "N": 20, "P": 40, "K": 20,
        "stage_split": {
            "basal": {"N": 1.0, "P": 1.0, "K": 1.0},
        }
    },
    "Urad": {
        "N": 20, "P": 50, "K": 25,
        "stage_split": {
            "basal": {"N": 1.0, "P": 1.0, "K": 1.0},
        }
    },
    
    # Cash Crops
    "Cotton": {
        "N": 150, "P": 75, "K": 75,
        "stage_split": {
            "basal": {"N": 0.25, "P": 1.0, "K": 0.5},
            "early_vegetative": {"N": 0.25, "P": 0, "K": 0},
            "flowering": {"N": 0.25, "P": 0, "K": 0.25},
            "grain_filling": {"N": 0.25, "P": 0, "K": 0.25},
        }
    },
    "Sugarcane": {
        "N": 300, "P": 100, "K": 150,
        "stage_split": {
            "basal": {"N": 0.20, "P": 1.0, "K": 0.5},
            "early_vegetative": {"N": 0.30, "P": 0, "K": 0.25},
            "late_vegetative": {"N": 0.30, "P": 0, "K": 0.25},
            "flowering": {"N": 0.20, "P": 0, "K": 0},
        }
    },
    
    # Vegetables
    "Potato": {
        "N": 180, "P": 100, "K": 150,
        "stage_split": {
            "basal": {"N": 0.5, "P": 1.0, "K": 0.75},
            "early_vegetative": {"N": 0.25, "P": 0, "K": 0.25},
            "late_vegetative": {"N": 0.25, "P": 0, "K": 0},
        }
    },
    "Tomato": {
        "N": 150, "P": 80, "K": 100,
        "stage_split": {
            "basal": {"N": 0.33, "P": 1.0, "K": 0.5},
            "early_vegetative": {"N": 0.33, "P": 0, "K": 0.25},
            "flowering": {"N": 0.34, "P": 0, "K": 0.25},
        }
    },
    "Onion": {
        "N": 100, "P": 50, "K": 80,
        "stage_split": {
            "basal": {"N": 0.5, "P": 1.0, "K": 1.0},
            "early_vegetative": {"N": 0.25, "P": 0, "K": 0},
            "late_vegetative": {"N": 0.25, "P": 0, "K": 0},
        }
    },
    "Chilli": {
        "N": 120, "P": 60, "K": 80,
        "stage_split": {
            "basal": {"N": 0.33, "P": 1.0, "K": 0.5},
            "early_vegetative": {"N": 0.33, "P": 0, "K": 0.25},
            "flowering": {"N": 0.34, "P": 0, "K": 0.25},
        }
    },
    
    # Fruits
    "Mango": {
        "N": 100, "P": 50, "K": 100,
        "stage_split": {
            "basal": {"N": 0.5, "P": 1.0, "K": 0.5},
            "flowering": {"N": 0.25, "P": 0, "K": 0.25},
            "grain_filling": {"N": 0.25, "P": 0, "K": 0.25},
        }
    },
    "Banana": {
        "N": 200, "P": 60, "K": 300,
        "stage_split": {
            "basal": {"N": 0.33, "P": 1.0, "K": 0.33},
            "early_vegetative": {"N": 0.33, "P": 0, "K": 0.33},
            "flowering": {"N": 0.34, "P": 0, "K": 0.34},
        }
    },
}

# Default for crops not in database
DEFAULT_NPK = {
    "N": 100, "P": 50, "K": 50,
    "stage_split": {
        "basal": {"N": 0.5, "P": 1.0, "K": 1.0},
        "early_vegetative": {"N": 0.25, "P": 0, "K": 0},
        "flowering": {"N": 0.25, "P": 0, "K": 0},
    }
}


# ==============================================================================
# FERTILIZER DATABASE
# ==============================================================================

FERTILIZERS = {
    "Urea": {"N": 46, "P": 0, "K": 0, "cost_per_kg": 6, "type": "chemical"},
    "DAP": {"N": 18, "P": 46, "K": 0, "cost_per_kg": 27, "type": "chemical"},
    "MOP": {"N": 0, "P": 0, "K": 60, "cost_per_kg": 17, "type": "chemical"},
    "NPK_10_26_26": {"N": 10, "P": 26, "K": 26, "cost_per_kg": 22, "type": "chemical"},
    "NPK_12_32_16": {"N": 12, "P": 32, "K": 16, "cost_per_kg": 22, "type": "chemical"},
    "SSP": {"N": 0, "P": 16, "K": 0, "cost_per_kg": 8, "type": "chemical"},
    "Ammonium_Sulphate": {"N": 21, "P": 0, "K": 0, "cost_per_kg": 10, "type": "chemical"},
}

# Organic alternatives
ORGANIC_ALTERNATIVES = {
    "Vermicompost": {"N": 1.5, "P": 0.8, "K": 0.9, "cost_per_kg": 8, "rate_kg_ha": 5000},
    "FYM": {"N": 0.5, "P": 0.25, "K": 0.5, "cost_per_kg": 2, "rate_kg_ha": 10000},
    "Neem_Cake": {"N": 5, "P": 1, "K": 1.5, "cost_per_kg": 25, "rate_kg_ha": 200},
    "Bone_Meal": {"N": 3, "P": 20, "K": 0, "cost_per_kg": 30, "rate_kg_ha": 150},
    "Wood_Ash": {"N": 0, "P": 1, "K": 5, "cost_per_kg": 5, "rate_kg_ha": 500},
    "Green_Manure": {"N": 2, "P": 0.5, "K": 1.5, "cost_per_kg": 0, "rate_kg_ha": 0},
}


# ==============================================================================
# ENVIRONMENTAL SAFETY NOTES
# ==============================================================================

SAFETY_NOTES = {
    "general": [
        "Apply fertilizers during cool hours (early morning or evening) to reduce volatilization losses",
        "Avoid application before heavy rainfall to prevent runoff and groundwater contamination",
        "Use protective gear (gloves, mask) when handling chemical fertilizers",
        "Store fertilizers away from water sources and in dry conditions",
    ],
    "urea": [
        "Apply Urea when soil has adequate moisture for better absorption",
        "Do not mix Urea with lime or wood ash - causes nitrogen loss",
        "Incorporate into soil within 2-3 days to prevent volatilization",
    ],
    "dap": [
        "Apply DAP in root zone for maximum phosphorus uptake",
        "Avoid surface application - phosphorus does not move easily in soil",
        "Best applied as basal dose during sowing",
    ],
    "mop": [
        "Apply MOP 2-3 weeks before sowing for chloride-sensitive crops",
        "Do not apply near seeds - may cause salt injury to germinating seeds",
    ],
    "organic": [
        "Organic manures improve soil structure and water retention",
        "Apply well-decomposed organic matter to avoid nitrogen immobilization",
        "Mix organic and chemical fertilizers for balanced nutrition (INM approach)",
    ],
}


# ==============================================================================
# FERTILIZER ANALYZER ENGINE
# ==============================================================================

class FertilizerAnalyzer:
    """
    Smart fertilizer recommendation engine based on:
    - Soil sensor NPK data
    - Crop type and requirements
    - Growth stage
    - Environmental factors
    """
    
    def __init__(self):
        self.crop_requirements = CROP_NPK_REQUIREMENTS
        self.fertilizers = FERTILIZERS
        self.organic_alternatives = ORGANIC_ALTERNATIVES
    
    def get_recommendation(
        self,
        crop: str,
        soil_data: Optional[Dict] = None,
        area_hectares: float = 1.0,
        growth_stage: str = "basal",
        prefer_organic: bool = False
    ) -> Dict:
        """
        Generate fertilizer recommendation based on crop and soil data
        
        Args:
            crop: Crop type
            soil_data: Soil sensor data {"N": x, "P": y, "K": z, "pH": p}
            area_hectares: Farm area
            growth_stage: Current growth stage
            prefer_organic: If True, recommend organic alternatives
        
        Returns:
            Recommendation with dosages, costs, and safety notes
        """
        # Get crop requirements
        requirements = self.crop_requirements.get(crop, DEFAULT_NPK)
        
        # Calculate nutrient gaps
        gaps = self._calculate_nutrient_gaps(requirements, soil_data)
        
        # Adjust for growth stage
        stage_requirements = self._get_stage_requirements(requirements, growth_stage)
        
        # Generate fertilizer doses
        if prefer_organic:
            doses = self._calculate_organic_doses(stage_requirements, area_hectares)
        else:
            doses = self._calculate_chemical_doses(stage_requirements, area_hectares)
        
        # Calculate totals
        total_cost = sum(d.cost_per_hectare for d in doses) * area_hectares
        total_npk = {"N": 0, "P": 0, "K": 0}
        for d in doses:
            for nutrient, value in d.npk_contribution.items():
                total_npk[nutrient] += value
        
        # Get safety notes
        safety = self._get_safety_notes(doses, prefer_organic)
        
        return {
            "crop": crop,
            "area_hectares": area_hectares,
            "growth_stage": growth_stage,
            "soil_status": self._get_soil_status(soil_data),
            "nutrient_gaps": gaps,
            "requirements": {
                "N": stage_requirements["N"],
                "P": stage_requirements["P"],
                "K": stage_requirements["K"]
            },
            "recommendations": [d.to_dict() for d in doses],
            "total_npk_applied": {k: round(v, 1) for k, v in total_npk.items()},
            "total_cost_inr": round(total_cost, 2),
            "cost_per_hectare": round(total_cost / max(area_hectares, 1), 2),
            "safety_notes": safety,
            "organic_mode": prefer_organic
        }
    
    def get_schedule(self, crop: str, area_hectares: float = 1.0) -> Dict:
        """
        Get complete fertilizer application schedule for the crop
        """
        requirements = self.crop_requirements.get(crop, DEFAULT_NPK)
        stage_split = requirements.get("stage_split", {})
        
        schedule = []
        total_cost = 0
        
        for stage, split in stage_split.items():
            stage_req = {
                "N": requirements["N"] * split.get("N", 0),
                "P": requirements["P"] * split.get("P", 0),
                "K": requirements["K"] * split.get("K", 0)
            }
            
            if sum(stage_req.values()) > 0:
                doses = self._calculate_chemical_doses(stage_req, area_hectares)
                stage_cost = sum(d.cost_per_hectare for d in doses) * area_hectares
                total_cost += stage_cost
                
                schedule.append(ScheduleEntry(
                    stage=stage.replace("_", " ").title(),
                    days_after_sowing=self._get_timing(stage),
                    fertilizers=[d.to_dict() for d in doses],
                    notes=self._get_stage_notes(stage)
                ))
        
        return {
            "crop": crop,
            "area_hectares": area_hectares,
            "total_requirement": {
                "N": requirements["N"],
                "P": requirements["P"],
                "K": requirements["K"]
            },
            "schedule": [s.to_dict() for s in schedule],
            "total_cost_inr": round(total_cost, 2),
            "cost_per_hectare": round(total_cost / max(area_hectares, 1), 2)
        }
    
    def get_organic_alternatives(self, crop: str) -> Dict:
        """
        Get organic alternatives for chemical fertilizers
        """
        requirements = self.crop_requirements.get(crop, DEFAULT_NPK)
        
        alternatives = []
        for name, data in self.organic_alternatives.items():
            contribution = {
                "N": data["N"] * data["rate_kg_ha"] / 100,
                "P": data["P"] * data["rate_kg_ha"] / 100,
                "K": data["K"] * data["rate_kg_ha"] / 100,
            }
            cost = data["cost_per_kg"] * data["rate_kg_ha"]
            
            alternatives.append({
                "name": name.replace("_", " "),
                "rate_kg_per_ha": data["rate_kg_ha"],
                "npk_contribution": {k: round(v, 1) for k, v in contribution.items()},
                "cost_per_hectare": round(cost, 2),
                "benefits": self._get_organic_benefits(name)
            })
        
        return {
            "crop": crop,
            "crop_requirements": {
                "N": requirements["N"],
                "P": requirements["P"],
                "K": requirements["K"]
            },
            "organic_alternatives": alternatives,
            "inm_recommendation": self._get_inm_recommendation(crop, requirements),
            "safety_notes": SAFETY_NOTES["organic"]
        }
    
    # ============== HELPER METHODS ==============
    
    def _calculate_nutrient_gaps(self, requirements: Dict, soil_data: Optional[Dict]) -> Dict:
        """Calculate gap between requirements and soil availability"""
        if not soil_data:
            return {"N": "Unknown", "P": "Unknown", "K": "Unknown", "status": "no_soil_data"}
        
        gaps = {}
        for nutrient in ["N", "P", "K"]:
            soil_val = soil_data.get(nutrient, 0)
            req_val = requirements.get(nutrient, 0)
            
            # Convert soil readings (ppm) to kg/ha estimate (rough conversion)
            soil_available = soil_val * 2.24  # Approximate conversion factor
            gap = max(0, req_val - soil_available)
            
            gaps[nutrient] = {
                "soil_available": round(soil_available, 1),
                "required": req_val,
                "gap": round(gap, 1),
                "status": "deficient" if gap > req_val * 0.3 else "adequate"
            }
        
        return gaps
    
    def _get_stage_requirements(self, requirements: Dict, growth_stage: str) -> Dict:
        """Get requirements for specific growth stage"""
        stage_split = requirements.get("stage_split", {})
        split = stage_split.get(growth_stage, {"N": 0.33, "P": 0.33, "K": 0.33})
        
        return {
            "N": requirements["N"] * split.get("N", 0),
            "P": requirements["P"] * split.get("P", 0),
            "K": requirements["K"] * split.get("K", 0)
        }
    
    def _calculate_chemical_doses(self, requirements: Dict, area: float) -> List[FertilizerDose]:
        """Calculate optimal chemical fertilizer doses"""
        doses = []
        remaining = {"N": requirements["N"], "P": requirements["P"], "K": requirements["K"]}
        
        # Priority: DAP for P (also provides N), then Urea for N, MOP for K
        
        # 1. DAP for phosphorus (primary P source)
        if remaining["P"] > 0:
            dap_kg = remaining["P"] / 0.46  # DAP is 46% P
            dap_kg = min(dap_kg, 150)  # Cap at practical limit
            
            n_from_dap = dap_kg * 0.18
            p_from_dap = dap_kg * 0.46
            
            cost = dap_kg * self.fertilizers["DAP"]["cost_per_kg"]
            
            doses.append(FertilizerDose(
                fertilizer_name="DAP",
                quantity_kg_per_hectare=dap_kg,
                npk_contribution={"N": n_from_dap, "P": p_from_dap, "K": 0},
                cost_per_hectare=cost,
                application_method="Basal application in furrows"
            ))
            
            remaining["P"] -= p_from_dap
            remaining["N"] -= n_from_dap
        
        # 2. Urea for remaining nitrogen
        if remaining["N"] > 0:
            urea_kg = remaining["N"] / 0.46  # Urea is 46% N
            n_from_urea = urea_kg * 0.46
            cost = urea_kg * self.fertilizers["Urea"]["cost_per_kg"]
            
            doses.append(FertilizerDose(
                fertilizer_name="Urea",
                quantity_kg_per_hectare=urea_kg,
                npk_contribution={"N": n_from_urea, "P": 0, "K": 0},
                cost_per_hectare=cost,
                application_method="Top dressing, incorporate into soil"
            ))
        
        # 3. MOP for potassium
        if remaining["K"] > 0:
            mop_kg = remaining["K"] / 0.60  # MOP is 60% K
            k_from_mop = mop_kg * 0.60
            cost = mop_kg * self.fertilizers["MOP"]["cost_per_kg"]
            
            doses.append(FertilizerDose(
                fertilizer_name="MOP",
                quantity_kg_per_hectare=mop_kg,
                npk_contribution={"N": 0, "P": 0, "K": k_from_mop},
                cost_per_hectare=cost,
                application_method="Basal or split application"
            ))
        
        return doses
    
    def _calculate_organic_doses(self, requirements: Dict, area: float) -> List[FertilizerDose]:
        """Calculate organic fertilizer doses"""
        doses = []
        
        # Vermicompost as primary source
        vermi = self.organic_alternatives["Vermicompost"]
        vermi_rate = vermi["rate_kg_ha"]
        
        doses.append(FertilizerDose(
            fertilizer_name="Vermicompost",
            quantity_kg_per_hectare=vermi_rate,
            npk_contribution={
                "N": vermi["N"] * vermi_rate / 100,
                "P": vermi["P"] * vermi_rate / 100,
                "K": vermi["K"] * vermi_rate / 100
            },
            cost_per_hectare=vermi["cost_per_kg"] * vermi_rate,
            application_method="Apply and incorporate 2 weeks before sowing"
        ))
        
        # Neem cake for additional N and pest control
        neem = self.organic_alternatives["Neem_Cake"]
        doses.append(FertilizerDose(
            fertilizer_name="Neem Cake",
            quantity_kg_per_hectare=neem["rate_kg_ha"],
            npk_contribution={
                "N": neem["N"] * neem["rate_kg_ha"] / 100,
                "P": neem["P"] * neem["rate_kg_ha"] / 100,
                "K": neem["K"] * neem["rate_kg_ha"] / 100
            },
            cost_per_hectare=neem["cost_per_kg"] * neem["rate_kg_ha"],
            application_method="Mix with soil at sowing time"
        ))
        
        return doses
    
    def _get_soil_status(self, soil_data: Optional[Dict]) -> Dict:
        """Interpret soil sensor data"""
        if not soil_data:
            return {"status": "no_data", "message": "No soil sensor data available"}
        
        status = {}
        thresholds = {"N": {"low": 150, "high": 280}, "P": {"low": 10, "high": 25}, "K": {"low": 100, "high": 200}}
        
        for nutrient in ["N", "P", "K"]:
            val = soil_data.get(nutrient, 0)
            if val < thresholds[nutrient]["low"]:
                status[nutrient] = "Low"
            elif val > thresholds[nutrient]["high"]:
                status[nutrient] = "High"
            else:
                status[nutrient] = "Medium"
        
        if soil_data.get("pH"):
            ph = soil_data["pH"]
            if ph < 5.5:
                status["pH"] = "Acidic (apply lime)"
            elif ph > 8.0:
                status["pH"] = "Alkaline (apply gypsum)"
            else:
                status["pH"] = "Neutral (optimal)"
        
        return status
    
    def _get_safety_notes(self, doses: List[FertilizerDose], organic: bool) -> List[str]:
        """Get relevant safety notes"""
        notes = SAFETY_NOTES["general"].copy()
        
        if organic:
            notes.extend(SAFETY_NOTES["organic"])
        else:
            for dose in doses:
                name = dose.fertilizer_name.lower()
                if "urea" in name and "urea" in SAFETY_NOTES:
                    notes.extend(SAFETY_NOTES["urea"])
                elif "dap" in name and "dap" in SAFETY_NOTES:
                    notes.extend(SAFETY_NOTES["dap"])
                elif "mop" in name and "mop" in SAFETY_NOTES:
                    notes.extend(SAFETY_NOTES["mop"])
        
        return list(set(notes))[:6]  # Limit to 6 notes
    
    def _get_timing(self, stage: str) -> str:
        """Get timing description for growth stage"""
        timing_map = {
            "basal": "At sowing / before planting",
            "early_vegetative": "15-25 days after sowing",
            "late_vegetative": "30-45 days after sowing",
            "flowering": "At flowering / panicle initiation",
            "grain_filling": "During grain/fruit development",
            "maturity": "Near harvest (if needed)"
        }
        return timing_map.get(stage, "As needed")
    
    def _get_stage_notes(self, stage: str) -> str:
        """Get application notes for growth stage"""
        notes_map = {
            "basal": "Apply in furrows or broadcast and incorporate before sowing",
            "early_vegetative": "Top dress after first weeding, apply when soil has moisture",
            "late_vegetative": "Apply before irrigation for better uptake",
            "flowering": "Foliar spray recommended for quick absorption",
            "grain_filling": "Light application to support grain development",
        }
        return notes_map.get(stage, "Apply as per crop condition")
    
    def _get_organic_benefits(self, name: str) -> List[str]:
        """Get benefits of organic alternatives"""
        benefits_map = {
            "Vermicompost": ["Improves soil structure", "Slow nutrient release", "Enhances microbial activity"],
            "FYM": ["Adds organic matter", "Improves water retention", "Low cost"],
            "Neem_Cake": ["Pest deterrent", "Slow N release", "Soil amendment"],
            "Bone_Meal": ["Rich in phosphorus", "Long-lasting", "Neutral pH"],
            "Wood_Ash": ["High potassium", "Raises pH", "Free resource"],
            "Green_Manure": ["Fixes nitrogen", "Adds organic matter", "Zero cost"],
        }
        return benefits_map.get(name, ["Natural nutrient source"])
    
    def _get_inm_recommendation(self, crop: str, requirements: Dict) -> Dict:
        """Get Integrated Nutrient Management recommendation"""
        return {
            "approach": "50% organic + 50% chemical for balanced nutrition",
            "organic_dose": {
                "Vermicompost": "2500 kg/ha",
                "Neem_Cake": "100 kg/ha"
            },
            "chemical_dose": {
                "Urea": f"{round(requirements['N'] * 0.5 / 0.46)} kg/ha",
                "SSP": f"{round(requirements['P'] * 0.5 / 0.16)} kg/ha",
                "MOP": f"{round(requirements['K'] * 0.5 / 0.60)} kg/ha"
            },
            "benefits": [
                "Reduces chemical fertilizer dependency by 50%",
                "Improves soil health over time",
                "Sustainable and cost-effective"
            ]
        }


# Singleton instance
fertilizer_analyzer = FertilizerAnalyzer()

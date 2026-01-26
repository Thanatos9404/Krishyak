"""
Land Records Integration Service for Krishyak
Provides mock implementations of state land records APIs

Simulates integration with:
- Maharashtra: Bhulekh/7/12 records
- Karnataka: Bhoomi
- Andhra Pradesh: Meebhoomi
- Uttar Pradesh: Bhulekh
- And other state land record systems

IMPORTANT: This is a MOCK implementation for demonstration.
Real integration requires state-level API access agreements.
"""

import logging
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class LandType(Enum):
    IRRIGATED = "irrigated"
    RAINFED = "rainfed"
    BARREN = "barren"
    ORCHARD = "orchard"
    FOREST = "forest"


class OwnershipType(Enum):
    INDIVIDUAL = "individual"
    JOINT = "joint"
    INHERITED = "inherited"
    LEASED = "leased"
    TENANT = "tenant"


@dataclass
class SurveyNumber:
    """Individual survey/plot details"""
    survey_no: str
    sub_division: Optional[str]
    area_hectares: float
    land_type: str
    irrigated: bool
    crop_grown: Optional[str]


@dataclass
class LandHolding:
    """Complete land holding record for a farmer"""
    state: str
    district: str
    taluka: str
    village: str
    survey_numbers: List[SurveyNumber]
    total_area_hectares: float
    irrigated_area_hectares: float
    ownership_type: str
    owner_name: str
    co_owners: List[str]
    encumbrance: bool
    last_mutation_date: Optional[str]
    digital_signed: bool


@dataclass
class StateLandAPI:
    """State-specific land records API configuration"""
    state_name: str
    api_name: str
    record_format: str
    supports_digital_signature: bool


class LandRecordsService:
    """
    Mock land records service simulating state-level integrations
    """
    
    # State-specific API configurations
    STATE_APIS = {
        "Maharashtra": StateLandAPI(
            state_name="Maharashtra",
            api_name="Bhulekh/Mahabhulekh",
            record_format="7/12 Extract",
            supports_digital_signature=True
        ),
        "Karnataka": StateLandAPI(
            state_name="Karnataka",
            api_name="Bhoomi",
            record_format="RTC (Record of Rights)",
            supports_digital_signature=True
        ),
        "Andhra Pradesh": StateLandAPI(
            state_name="Andhra Pradesh",
            api_name="Meebhoomi",
            record_format="Adangal/Pahani",
            supports_digital_signature=True
        ),
        "Telangana": StateLandAPI(
            state_name="Telangana",
            api_name="Dharani",
            record_format="Pahani/1B",
            supports_digital_signature=True
        ),
        "Uttar Pradesh": StateLandAPI(
            state_name="Uttar Pradesh",
            api_name="Bhulekh UP",
            record_format="Khatauni",
            supports_digital_signature=True
        ),
        "Madhya Pradesh": StateLandAPI(
            state_name="Madhya Pradesh",
            api_name="Bhulekh MP",
            record_format="Khasra/B1",
            supports_digital_signature=True
        ),
        "Rajasthan": StateLandAPI(
            state_name="Rajasthan",
            api_name="Apna Khata",
            record_format="Jamabandi",
            supports_digital_signature=True
        ),
        "Gujarat": StateLandAPI(
            state_name="Gujarat",
            api_name="AnyRoR",
            record_format="7/12 Utara",
            supports_digital_signature=True
        ),
        "Tamil Nadu": StateLandAPI(
            state_name="Tamil Nadu",
            api_name="Patta/Chitta",
            record_format="A Register Extract",
            supports_digital_signature=True
        ),
        "Punjab": StateLandAPI(
            state_name="Punjab",
            api_name="PLRS",
            record_format="Fard (Jamabandi)",
            supports_digital_signature=True
        ),
        "Haryana": StateLandAPI(
            state_name="Haryana",
            api_name="Jamabandi",
            record_format="Jamabandi Nakal",
            supports_digital_signature=True
        ),
        "West Bengal": StateLandAPI(
            state_name="West Bengal",
            api_name="Banglarbhumi",
            record_format="Khatian/Plot Info",
            supports_digital_signature=False
        )
    }
    
    # Mock land records database
    MOCK_RECORDS = {
        "MH-NSK-001": LandHolding(
            state="Maharashtra",
            district="Nashik",
            taluka="Dindori",
            village="Wani",
            survey_numbers=[
                SurveyNumber("123/A", "1", 1.5, LandType.IRRIGATED.value, True, "Wheat"),
                SurveyNumber("124/B", None, 1.0, LandType.RAINFED.value, False, "Jowar")
            ],
            total_area_hectares=2.5,
            irrigated_area_hectares=1.5,
            ownership_type=OwnershipType.INDIVIDUAL.value,
            owner_name="Ramesh Kumar",
            co_owners=[],
            encumbrance=False,
            last_mutation_date="2023-05-15",
            digital_signed=True
        ),
        "KA-BLG-001": LandHolding(
            state="Karnataka",
            district="Belgaum",
            taluka="Chikodi",
            village="Nipani",
            survey_numbers=[
                SurveyNumber("45/1", None, 0.8, LandType.RAINFED.value, False, "Sugarcane")
            ],
            total_area_hectares=0.8,
            irrigated_area_hectares=0.3,
            ownership_type=OwnershipType.INHERITED.value,
            owner_name="Suresh Patil",
            co_owners=["Mahesh Patil"],
            encumbrance=False,
            last_mutation_date="2022-11-20",
            digital_signed=True
        ),
        "AP-GNT-001": LandHolding(
            state="Andhra Pradesh",
            district="Guntur",
            taluka="Tenali",
            village="Kolluru",
            survey_numbers=[
                SurveyNumber("78/A", None, 2.0, LandType.IRRIGATED.value, True, "Rice"),
                SurveyNumber("78/B", None, 1.5, LandType.IRRIGATED.value, True, "Cotton"),
                SurveyNumber("79/A", None, 0.7, LandType.ORCHARD.value, True, "Mango")
            ],
            total_area_hectares=4.2,
            irrigated_area_hectares=3.5,
            ownership_type=OwnershipType.INDIVIDUAL.value,
            owner_name="Lakshmi Devi",
            co_owners=[],
            encumbrance=False,
            last_mutation_date="2024-02-10",
            digital_signed=True
        ),
        "UP-LKO-001": LandHolding(
            state="Uttar Pradesh",
            district="Lucknow",
            taluka="Malihabad",
            village="Dewa",
            survey_numbers=[
                SurveyNumber("201/C", None, 1.5, LandType.IRRIGATED.value, True, "Wheat")
            ],
            total_area_hectares=1.5,
            irrigated_area_hectares=1.1,
            ownership_type=OwnershipType.INDIVIDUAL.value,
            owner_name="Mohammad Ismail",
            co_owners=[],
            encumbrance=False,
            last_mutation_date="2023-08-25",
            digital_signed=True
        )
    }
    
    # Mapping from Aadhaar last 4 to land record ID
    AADHAAR_TO_LAND = {
        "1234": "MH-NSK-001",
        "5678": "KA-BLG-001",
        "9012": "AP-GNT-001",
        "3456": "UP-LKO-001"
    }
    
    def __init__(self):
        logger.info("Land Records Service initialized")
    
    def get_supported_states(self) -> List[Dict[str, Any]]:
        """Get list of supported states with their API info"""
        return [
            {
                "state": api.state_name,
                "api_name": api.api_name,
                "record_format": api.record_format,
                "digital_signature": api.supports_digital_signature
            }
            for api in self.STATE_APIS.values()
        ]
    
    def get_land_records_by_aadhaar_token(
        self, 
        aadhaar_last4: str
    ) -> Optional[LandHolding]:
        """
        Fetch land records using Aadhaar reference
        
        In production, this would:
        1. Use Aadhaar token to get demographic data
        2. Query state land records API
        3. Match owner name and return records
        """
        record_id = self.AADHAAR_TO_LAND.get(aadhaar_last4)
        
        if not record_id:
            logger.warning(f"No land records found for Aadhaar ending: {aadhaar_last4}")
            return None
        
        record = self.MOCK_RECORDS.get(record_id)
        logger.info(f"Land records retrieved for: {record_id}")
        
        return record
    
    def get_land_records_by_survey(
        self,
        state: str,
        district: str,
        survey_number: str
    ) -> Optional[LandHolding]:
        """
        Fetch land records by survey number
        
        In production, this would query state API directly
        """
        for record in self.MOCK_RECORDS.values():
            if (record.state.lower() == state.lower() and 
                record.district.lower() == district.lower()):
                for survey in record.survey_numbers:
                    if survey.survey_no == survey_number:
                        return record
        
        return None
    
    def calculate_farmer_category(self, total_area: float) -> str:
        """
        Determine farmer category based on land holding
        
        As per Indian agricultural classification:
        - Marginal: < 1 hectare
        - Small: 1-2 hectares  
        - Semi-Medium: 2-4 hectares
        - Medium: 4-10 hectares
        - Large: > 10 hectares
        """
        if total_area < 1:
            return "marginal"
        elif total_area < 2:
            return "small"
        elif total_area < 4:
            return "semi_medium"
        elif total_area < 10:
            return "medium"
        else:
            return "large"
    
    def verify_ownership(
        self,
        aadhaar_last4: str,
        owner_name: str
    ) -> Dict[str, Any]:
        """
        Verify land ownership against Aadhaar-linked name
        
        Returns verification result with match score
        """
        record = self.get_land_records_by_aadhaar_token(aadhaar_last4)
        
        if not record:
            return {
                "verified": False,
                "error": "No land records found"
            }
        
        # Simple name matching (in production, use fuzzy matching)
        recorded_name = record.owner_name.lower()
        provided_name = owner_name.lower()
        
        # Check if names match
        if recorded_name == provided_name:
            match_score = 1.0
        elif provided_name in recorded_name or recorded_name in provided_name:
            match_score = 0.85
        else:
            # Check for partial match (first name, last name)
            recorded_parts = set(recorded_name.split())
            provided_parts = set(provided_name.split())
            overlap = recorded_parts & provided_parts
            match_score = len(overlap) / max(len(recorded_parts), len(provided_parts))
        
        return {
            "verified": match_score > 0.7,
            "match_score": match_score,
            "ownership_type": record.ownership_type,
            "co_owners": record.co_owners,
            "encumbrance": record.encumbrance,
            "digital_signed": record.digital_signed
        }
    
    def get_7_12_extract(
        self,
        state: str,
        district: str,
        taluka: str,
        village: str,
        survey_number: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get Maharashtra-style 7/12 extract (or equivalent for other states)
        
        This is the primary land ownership document in many states
        """
        # Find matching record
        for record in self.MOCK_RECORDS.values():
            if (record.state.lower() == state.lower() and
                record.district.lower() == district.lower() and
                record.taluka.lower() == taluka.lower() and
                record.village.lower() == village.lower()):
                
                for survey in record.survey_numbers:
                    if survey.survey_no == survey_number:
                        state_api = self.STATE_APIS.get(state)
                        
                        return {
                            "document_type": state_api.record_format if state_api else "Land Record",
                            "state": record.state,
                            "district": record.district,
                            "taluka": record.taluka,
                            "village": record.village,
                            "survey_number": survey.survey_no,
                            "sub_division": survey.sub_division,
                            "area_hectares": survey.area_hectares,
                            "land_type": survey.land_type,
                            "irrigated": survey.irrigated,
                            "current_crop": survey.crop_grown,
                            "owner_name": record.owner_name,
                            "co_owners": record.co_owners,
                            "ownership_type": record.ownership_type,
                            "encumbrance": record.encumbrance,
                            "last_mutation": record.last_mutation_date,
                            "digital_signed": record.digital_signed,
                            "generated_at": datetime.now().isoformat()
                        }
        
        return None
    
    def check_scheme_eligibility(
        self,
        aadhaar_last4: str
    ) -> Dict[str, Any]:
        """
        Check eligibility for various government schemes based on land holding
        """
        record = self.get_land_records_by_aadhaar_token(aadhaar_last4)
        
        if not record:
            return {
                "verified": False,
                "error": "Land records not found"
            }
        
        category = self.calculate_farmer_category(record.total_area_hectares)
        
        eligibility = {
            "verified": True,
            "land_holding_hectares": record.total_area_hectares,
            "farmer_category": category,
            "schemes": {
                "pm_kisan": {
                    "eligible": category in ["marginal", "small"],
                    "reason": "For farmers with < 2 hectares" if category in ["marginal", "small"] else "Land holding exceeds 2 hectares"
                },
                "pmfby": {
                    "eligible": True,
                    "reason": "All land-owning farmers eligible for crop insurance"
                },
                "kcc": {
                    "eligible": True,
                    "reason": "All farmers eligible for Kisan Credit Card"
                },
                "micro_irrigation": {
                    "eligible": record.total_area_hectares >= 0.5,
                    "reason": "Minimum 0.5 hectare required" if record.total_area_hectares < 0.5 else "Eligible for drip/sprinkler subsidy"
                },
                "pkvy_organic": {
                    "eligible": category in ["marginal", "small"],
                    "reason": "Priority for small/marginal farmers"
                },
                "smam_mechanization": {
                    "eligible": record.total_area_hectares >= 1.0,
                    "reason": "Minimum 1 hectare for machinery subsidy"
                }
            }
        }
        
        return eligibility


# Global instance
_land_service: Optional[LandRecordsService] = None


def get_land_service() -> LandRecordsService:
    """Get or create Land Records service instance"""
    global _land_service
    if _land_service is None:
        _land_service = LandRecordsService()
    return _land_service

"""
JAM Trinity Integration Service for Krishyak
Provides mock implementations of:
- Aadhaar eKYC verification
- Jan Dhan bank account verification
- Mobile verification
- PM-KISAN beneficiary status

IMPORTANT: This is a MOCK implementation for demonstration.
Real integration requires UIDAI, NPCI, and bank API access.
"""

import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class VerificationStatus(Enum):
    VERIFIED = "verified"
    PENDING = "pending"
    FAILED = "failed"
    NOT_FOUND = "not_found"
    CONSENT_REQUIRED = "consent_required"


class FarmerCategory(Enum):
    MARGINAL = "marginal"  # < 1 hectare
    SMALL = "small"        # 1-2 hectares
    MEDIUM = "medium"      # 2-4 hectares
    LARGE = "large"        # > 4 hectares


@dataclass
class ConsentRecord:
    """Record of user consent for data access"""
    consent_id: str
    purpose: str
    granted_at: datetime
    expires_at: datetime
    scope: list
    revoked: bool = False
    
    def is_valid(self) -> bool:
        return not self.revoked and datetime.now() < self.expires_at


@dataclass
class AadhaarVerificationResult:
    """Result of Aadhaar verification (tokenized, no PII)"""
    verified: bool
    token: str
    name_verified: bool
    demographic_match: float
    consent_id: str
    error: Optional[str] = None


@dataclass
class LandRecordResult:
    """Result of land records verification"""
    verified: bool
    state: str
    district: str
    total_area_hectares: float
    irrigated_percentage: float
    farmer_category: str
    survey_numbers: list
    ownership_verified: bool
    error: Optional[str] = None


@dataclass
class JanDhanResult:
    """Result of Jan Dhan bank account verification"""
    linked: bool
    bank_name: str
    account_masked: str
    dbt_enabled: bool
    pm_kisan_beneficiary: bool
    last_dbt_date: Optional[str] = None
    error: Optional[str] = None


@dataclass
class PMKisanStatus:
    """PM-KISAN enrollment and payment status"""
    enrolled: bool
    beneficiary_id: Optional[str]
    installments_received: int
    last_installment_date: Optional[str]
    last_installment_amount: float
    next_installment_expected: Optional[str]
    bank_verified: bool


class TokenManager:
    """Manages tokenization and de-tokenization of sensitive identifiers"""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self._tokens: Dict[str, Dict] = {}  # In production, use Redis with TTL
    
    def tokenize_aadhaar(self, aadhaar_last4: str, consent_id: str) -> str:
        """Generate a secure token for Aadhaar reference"""
        # Create a hash-based token
        token_input = f"{aadhaar_last4}:{consent_id}:{datetime.now().isoformat()}"
        token_hash = hashlib.sha256(
            f"{token_input}:{self.secret_key}".encode()
        ).hexdigest()[:24]
        
        token = f"AADH_TKN_{token_hash}"
        
        # Store mapping (in production, use Redis with 15-min TTL)
        self._tokens[token] = {
            "last4": aadhaar_last4,
            "consent_id": consent_id,
            "created": datetime.now(),
            "expires": datetime.now() + timedelta(minutes=15)
        }
        
        return token
    
    def validate_token(self, token: str) -> bool:
        """Check if a token is valid and not expired"""
        if token not in self._tokens:
            return False
        
        token_data = self._tokens[token]
        if datetime.now() > token_data["expires"]:
            del self._tokens[token]
            return False
        
        return True
    
    def get_masked_reference(self, token: str) -> Optional[str]:
        """Get masked reference from token (e.g., XXXX1234)"""
        if not self.validate_token(token):
            return None
        return f"XXXX{self._tokens[token]['last4']}"
    
    def revoke_token(self, token: str) -> bool:
        """Revoke a token"""
        if token in self._tokens:
            del self._tokens[token]
            return True
        return False


class ConsentManager:
    """Manages user consent for data access"""
    
    def __init__(self):
        self._consents: Dict[str, ConsentRecord] = {}  # In production, use database
    
    def create_consent(
        self, 
        purpose: str, 
        scope: list,
        duration_hours: int = 24
    ) -> ConsentRecord:
        """Create a new consent record"""
        consent_id = f"CNS_{datetime.now().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}"
        
        consent = ConsentRecord(
            consent_id=consent_id,
            purpose=purpose,
            granted_at=datetime.now(),
            expires_at=datetime.now() + timedelta(hours=duration_hours),
            scope=scope
        )
        
        self._consents[consent_id] = consent
        logger.info(f"Consent created: {consent_id} for purpose: {purpose}")
        
        return consent
    
    def verify_consent(self, consent_id: str, required_scope: str) -> bool:
        """Verify if consent is valid and covers required scope"""
        if consent_id not in self._consents:
            return False
        
        consent = self._consents[consent_id]
        
        if not consent.is_valid():
            return False
        
        if required_scope not in consent.scope:
            return False
        
        return True
    
    def revoke_consent(self, consent_id: str) -> bool:
        """Revoke a consent"""
        if consent_id in self._consents:
            self._consents[consent_id].revoked = True
            logger.info(f"Consent revoked: {consent_id}")
            return True
        return False
    
    def get_consent(self, consent_id: str) -> Optional[ConsentRecord]:
        """Get consent record by ID"""
        return self._consents.get(consent_id)


class JAMTrinityService:
    """
    Mock JAM Trinity verification service
    
    In production, this would integrate with:
    - UIDAI Aadhaar API
    - NPCI/Bank APIs for Jan Dhan
    - State land records APIs
    - PM-KISAN API
    """
    
    def __init__(self, secret_key: str):
        self.token_manager = TokenManager(secret_key)
        self.consent_manager = ConsentManager()
        
        # Mock data for demo (in production, this comes from actual APIs)
        self._mock_farmers = self._load_mock_farmers()
    
    def _load_mock_farmers(self) -> Dict[str, Dict]:
        """Load mock farmer data for demonstration"""
        return {
            "1234": {
                "name": "Ramesh Kumar",
                "state": "Maharashtra",
                "district": "Nashik",
                "land_hectares": 2.5,
                "irrigated_pct": 60,
                "survey_numbers": ["123/A", "124/B"],
                "bank": "State Bank of India",
                "account_last4": "5678",
                "pm_kisan": True,
                "installments": 21,
                "last_dbt": "2025-11-15"
            },
            "5678": {
                "name": "Suresh Patil",
                "state": "Karnataka",
                "district": "Belgaum",
                "land_hectares": 0.8,
                "irrigated_pct": 40,
                "survey_numbers": ["45/1"],
                "bank": "Bank of Baroda",
                "account_last4": "9012",
                "pm_kisan": True,
                "installments": 18,
                "last_dbt": "2025-10-20"
            },
            "9012": {
                "name": "Lakshmi Devi",
                "state": "Andhra Pradesh",
                "district": "Guntur",
                "land_hectares": 4.2,
                "irrigated_pct": 80,
                "survey_numbers": ["78/A", "78/B", "79/A"],
                "bank": "Andhra Bank",
                "account_last4": "3456",
                "pm_kisan": True,
                "installments": 21,
                "last_dbt": "2025-11-15"
            },
            "3456": {
                "name": "Mohammad Ismail",
                "state": "Uttar Pradesh",
                "district": "Lucknow",
                "land_hectares": 1.5,
                "irrigated_pct": 70,
                "survey_numbers": ["201/C"],
                "bank": "Punjab National Bank",
                "account_last4": "7890",
                "pm_kisan": True,
                "installments": 20,
                "last_dbt": "2025-09-10"
            }
        }
    
    def request_consent(self, purpose: str, scopes: list) -> Dict[str, Any]:
        """Request user consent for data access"""
        consent = self.consent_manager.create_consent(purpose, scopes)
        
        return {
            "consent_id": consent.consent_id,
            "purpose": purpose,
            "scopes": scopes,
            "expires_at": consent.expires_at.isoformat(),
            "status": "pending_user_action"
        }
    
    def verify_aadhaar(
        self, 
        aadhaar_last4: str, 
        consent_id: str,
        name_to_verify: Optional[str] = None
    ) -> AadhaarVerificationResult:
        """
        Mock Aadhaar verification
        
        In production, this would call UIDAI eKYC API
        """
        # Verify consent
        if not self.consent_manager.verify_consent(consent_id, "aadhaar_verify"):
            return AadhaarVerificationResult(
                verified=False,
                token="",
                name_verified=False,
                demographic_match=0.0,
                consent_id=consent_id,
                error="Valid consent required for Aadhaar verification"
            )
        
        # Validate input
        if not aadhaar_last4 or len(aadhaar_last4) != 4 or not aadhaar_last4.isdigit():
            return AadhaarVerificationResult(
                verified=False,
                token="",
                name_verified=False,
                demographic_match=0.0,
                consent_id=consent_id,
                error="Invalid Aadhaar last 4 digits"
            )
        
        # Mock verification (check against our mock data)
        farmer = self._mock_farmers.get(aadhaar_last4)
        
        if not farmer:
            # For demo, accept any 4 digits but flag as unverified in real DB
            token = self.token_manager.tokenize_aadhaar(aadhaar_last4, consent_id)
            return AadhaarVerificationResult(
                verified=True,
                token=token,
                name_verified=False,
                demographic_match=0.0,
                consent_id=consent_id
            )
        
        # Generate token and return
        token = self.token_manager.tokenize_aadhaar(aadhaar_last4, consent_id)
        
        # Calculate name match score
        name_match = 0.0
        if name_to_verify and farmer["name"]:
            # Simple fuzzy match (in production, use proper algorithm)
            name_match = 0.95 if name_to_verify.lower() in farmer["name"].lower() else 0.5
        
        logger.info(f"Aadhaar verified for token: {token[:15]}...")
        
        return AadhaarVerificationResult(
            verified=True,
            token=token,
            name_verified=name_match > 0.8,
            demographic_match=name_match,
            consent_id=consent_id
        )
    
    def get_land_records(
        self, 
        aadhaar_token: str,
        consent_id: str
    ) -> LandRecordResult:
        """
        Mock land records lookup
        
        In production, this would call state land records APIs
        (Bhoomi, Bhulekh, etc.)
        """
        # Verify consent
        if not self.consent_manager.verify_consent(consent_id, "land_records"):
            return LandRecordResult(
                verified=False, state="", district="", 
                total_area_hectares=0, irrigated_percentage=0,
                farmer_category="", survey_numbers=[], ownership_verified=False,
                error="Valid consent required for land records access"
            )
        
        # Validate token
        masked = self.token_manager.get_masked_reference(aadhaar_token)
        if not masked:
            return LandRecordResult(
                verified=False, state="", district="",
                total_area_hectares=0, irrigated_percentage=0,
                farmer_category="", survey_numbers=[], ownership_verified=False,
                error="Invalid or expired token"
            )
        
        # Get last 4 from masked reference
        last4 = masked[-4:]
        farmer = self._mock_farmers.get(last4)
        
        if not farmer:
            # Return demo data for unknown farmers
            return LandRecordResult(
                verified=True,
                state="Demo State",
                district="Demo District",
                total_area_hectares=2.0,
                irrigated_percentage=50,
                farmer_category=FarmerCategory.SMALL.value,
                survey_numbers=["DEMO/001"],
                ownership_verified=True
            )
        
        # Determine farmer category
        area = farmer["land_hectares"]
        if area < 1:
            category = FarmerCategory.MARGINAL
        elif area < 2:
            category = FarmerCategory.SMALL
        elif area < 4:
            category = FarmerCategory.MEDIUM
        else:
            category = FarmerCategory.LARGE
        
        return LandRecordResult(
            verified=True,
            state=farmer["state"],
            district=farmer["district"],
            total_area_hectares=farmer["land_hectares"],
            irrigated_percentage=farmer["irrigated_pct"],
            farmer_category=category.value,
            survey_numbers=farmer["survey_numbers"],
            ownership_verified=True
        )
    
    def verify_jan_dhan(
        self, 
        aadhaar_token: str,
        consent_id: str
    ) -> JanDhanResult:
        """
        Mock Jan Dhan bank account verification
        
        In production, this would call NPCI/Bank APIs
        """
        # Verify consent
        if not self.consent_manager.verify_consent(consent_id, "bank_verify"):
            return JanDhanResult(
                linked=False, bank_name="", account_masked="",
                dbt_enabled=False, pm_kisan_beneficiary=False,
                error="Valid consent required for bank verification"
            )
        
        # Validate token
        masked = self.token_manager.get_masked_reference(aadhaar_token)
        if not masked:
            return JanDhanResult(
                linked=False, bank_name="", account_masked="",
                dbt_enabled=False, pm_kisan_beneficiary=False,
                error="Invalid or expired token"
            )
        
        last4 = masked[-4:]
        farmer = self._mock_farmers.get(last4)
        
        if not farmer:
            # Demo response for unknown
            return JanDhanResult(
                linked=True,
                bank_name="Demo Bank",
                account_masked="XXXX0000",
                dbt_enabled=True,
                pm_kisan_beneficiary=False
            )
        
        return JanDhanResult(
            linked=True,
            bank_name=farmer["bank"],
            account_masked=f"XXXX{farmer['account_last4']}",
            dbt_enabled=True,
            pm_kisan_beneficiary=farmer["pm_kisan"],
            last_dbt_date=farmer.get("last_dbt")
        )
    
    def get_pm_kisan_status(
        self, 
        aadhaar_token: str,
        consent_id: str
    ) -> PMKisanStatus:
        """
        Mock PM-KISAN beneficiary status
        
        In production, this would call PM-KISAN API
        """
        # Verify consent
        if not self.consent_manager.verify_consent(consent_id, "pm_kisan_status"):
            return PMKisanStatus(
                enrolled=False,
                beneficiary_id=None,
                installments_received=0,
                last_installment_date=None,
                last_installment_amount=0,
                next_installment_expected=None,
                bank_verified=False
            )
        
        # Validate token
        masked = self.token_manager.get_masked_reference(aadhaar_token)
        if not masked:
            return PMKisanStatus(
                enrolled=False,
                beneficiary_id=None,
                installments_received=0,
                last_installment_date=None,
                last_installment_amount=0,
                next_installment_expected=None,
                bank_verified=False
            )
        
        last4 = masked[-4:]
        farmer = self._mock_farmers.get(last4)
        
        if not farmer or not farmer.get("pm_kisan"):
            return PMKisanStatus(
                enrolled=False,
                beneficiary_id=None,
                installments_received=0,
                last_installment_date=None,
                last_installment_amount=0,
                next_installment_expected=None,
                bank_verified=False
            )
        
        return PMKisanStatus(
            enrolled=True,
            beneficiary_id=f"PMKISAN{last4}XXXXX",
            installments_received=farmer["installments"],
            last_installment_date=farmer["last_dbt"],
            last_installment_amount=2000.0,
            next_installment_expected="2026-03-15",
            bank_verified=True
        )
    
    def get_unified_farmer_profile(
        self, 
        aadhaar_token: str,
        consent_id: str
    ) -> Dict[str, Any]:
        """Get complete farmer profile with all verifications"""
        
        land = self.get_land_records(aadhaar_token, consent_id)
        bank = self.verify_jan_dhan(aadhaar_token, consent_id)
        pm_kisan = self.get_pm_kisan_status(aadhaar_token, consent_id)
        
        # Calculate scheme eligibility based on verified data
        eligibility = {
            "pm_kisan": land.verified and land.total_area_hectares <= 2,
            "pmfby": land.verified,
            "kcc": bank.linked and bank.dbt_enabled,
            "micro_irrigation": land.verified and land.total_area_hectares >= 0.5,
            "organic_farming": land.verified and land.farmer_category in ["small", "marginal"]
        }
        
        return {
            "verified": land.verified and bank.linked,
            "aadhaar_token": aadhaar_token[:15] + "...",
            "land_records": asdict(land) if land.verified else None,
            "bank_details": asdict(bank) if bank.linked else None,
            "pm_kisan_status": asdict(pm_kisan) if pm_kisan.enrolled else None,
            "scheme_eligibility": eligibility,
            "dbt_ready": bank.dbt_enabled and land.ownership_verified,
            "farmer_category": land.farmer_category if land.verified else None
        }


# Global instance (initialized in main.py with proper secret)
jam_service: Optional[JAMTrinityService] = None


def get_jam_service(secret_key: str) -> JAMTrinityService:
    """Get or create JAM Trinity service instance"""
    global jam_service
    if jam_service is None:
        jam_service = JAMTrinityService(secret_key)
    return jam_service

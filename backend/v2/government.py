"""Public-information adapter. No government authorization or identity verification."""

from abc import ABC, abstractmethod

from fastapi import APIRouter

router = APIRouter(prefix="/api/v2", tags=["Public government information"])


class GovernmentAdapter(ABC):
    @abstractmethod
    def status(self): ...

    @abstractmethod
    def catalog(self): ...


class PublicInformationAdapter(GovernmentAdapter):
    def status(self):
        return {
            "mode": "public_information",
            "identity_verification": "not_authorized",
            "land_record_access": "not_authorized",
            "benefit_enrollment": "not_authorized",
            "government_endorsement": False,
        }

    def catalog(self):
        return [
            {
                "id": "pm-kisan",
                "name": "PM-KISAN",
                "purpose": "Income-support information for landholding farmer families, subject to official exclusions and verification.",
                "official_url": "https://pmkisan.gov.in/",
                "source_url": "https://pmkisan.gov.in/",
                "reviewed_at": "2026-10-03",
                "review_scope": "Official portal and exclusion categories checked",
                "requires_verification": [
                    "Landholding and family eligibility",
                    "Official exclusion categories",
                    "State/UT verification and required eKYC",
                ],
                "enrollment_status": "not_checked",
            },
            {
                "id": "pmfby",
                "name": "PMFBY crop insurance",
                "purpose": "Crop-insurance information. Coverage depends on the notified crop, district, season and enrollment rules.",
                "official_url": "https://www.pmfby.gov.in/",
                "source_url": "https://www.pmfby.gov.in/faq",
                "reviewed_at": "2026-10-03",
                "review_scope": "Official FAQ indexed; current state notifications require verification",
                "requires_verification": [
                    "Crop and area notification for this season",
                    "Current enrollment deadline",
                    "Insurer coverage and official loss-reporting rules",
                ],
                "enrollment_status": "not_checked",
            },
            {
                "id": "soil-health-card",
                "name": "Soil Health Card",
                "purpose": "Information about soil testing and nutrient reports. A recorded card is distinct from a satellite estimate.",
                "official_url": "https://soilhealth.dac.gov.in/",
                "source_url": "https://support.soilhealth.dac.gov.in/kb/?lang=en-US",
                "reviewed_at": "2026-10-03",
                "review_scope": "Official support and portal manual checked; individual access not tested",
                "requires_verification": ["Local soil collection/testing process", "Your own report and sample date"],
                "enrollment_status": "not_checked",
            },
        ]


@router.get("/government/status")
def government_status():
    return PublicInformationAdapter().status()


@router.get("/benefits/catalog")
def benefits_catalog():
    adapter = PublicInformationAdapter()
    return {
        "items": adapter.catalog(),
        "integration": adapter.status(),
        "limitations": [
            "This is public program information, not eligibility approval",
            "Krishyak does not submit applications or access Aadhaar, banking, land or beneficiary records",
            "Current official rules and state/season deadlines govern",
            "No combined or guaranteed personal benefit amount is calculated",
        ],
    }

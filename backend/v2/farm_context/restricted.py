"""Explicit integration contracts, without undocumented requests or fake records."""

from typing import Protocol

from pydantic import Field

from .models import Model, Source


class AuthorizedRequest(Model):
    # Opaque provider consent/reference, never Aadhaar or a farmer document.
    consent_reference: str = Field(min_length=1, max_length=200)
    subject_reference: str = Field(min_length=1, max_length=200)


class AuthorizedAdapter(Protocol):
    async def fetch(self, request: AuthorizedRequest) -> dict:
        """Normalize an authorized response once a verified contract exists."""


class RestrictedAdapter:
    provider = "restricted"
    source_url = "https://www.india.gov.in/"
    reason = "No approved, documented provider contract is configured"

    async def fetch(self, request: AuthorizedRequest):
        return {
            "data": None,
            "source": Source(
                provider=self.provider, source_url=self.source_url, status="disabled", message=self.reason
            ),
        }


class SoilHealthCardAdapter(RestrictedAdapter):
    provider = "Soil Health Card"
    source_url = "https://soilhealth.dac.gov.in/"


class AgriStackAdapter(RestrictedAdapter):
    provider = "AgriStack"
    source_url = "https://agristack.gov.in/"


class ENAMAdapter(RestrictedAdapter):
    provider = "e-NAM"
    source_url = "https://enam.gov.in/"


class IMDAdvisoryAdapter(RestrictedAdapter):
    provider = "IMD agricultural advisory"
    source_url = "https://api.imd.gov.in/public/api_reference.html"
    reason = "An approved machine-readable agricultural advisory contract is required"

"""One transient context, independent sources, no new farmer identity system."""

import asyncio

from ..crops import resolve_crop
from ..government import PublicInformationAdapter
from ..locations import resolve_location
from .models import FarmContext, Location, Source
from .providers import bhuvan, imd, ogd, open_meteo, soilgrids
from .settings import ProviderSettings
from .transport import ENDPOINTS, Gateway, Unavailable


def absent(provider, message, *, disabled=False, url=None):
    return {
        "data": None,
        "source": Source(
            provider=provider,
            status="disabled" if disabled else "unavailable",
            source_url=url or ENDPOINTS.get(provider, "https://lgdirectory.gov.in/"),
            message=message,
        ),
    }


class FarmContextService:
    def __init__(self, quotas, settings=None, gateway=None):
        self.settings = settings or ProviderSettings.from_env()
        self.gateway = gateway or Gateway(quotas)

    async def location(self, body):
        manual = resolve_location(body.state_code, body.district_code)
        result = Location(
            state_name=manual["state"],
            district_name=manual["district"],
            state_lgd_code=manual["state_code"],
            district_lgd_code=manual["district_code"],
            accuracy_meters=body.accuracy_meters,
            resolution="manual" if manual["state"] else "unresolved",
            confidence="reported" if manual["state"] else "unresolved",
        )
        if body.latitude is None:
            return {
                "data": result,
                "source": Source(
                    provider="LGD dated catalogue",
                    status="success" if manual["state"] else "unavailable",
                    source_url="https://lgdirectory.gov.in/",
                    message="Selected administrative area, not land ownership verification",
                ),
            }, False
        if not self.settings.nominatim_enabled:
            return {
                "data": result,
                "source": Source(
                    provider="LGD dated catalogue",
                    status="partial",
                    source_url="https://lgdirectory.gov.in/",
                    message="Automatic area lookup is disabled. Choose your state and district.",
                ),
            }, False
        lat, lon = round(body.latitude, 2), round(body.longitude, 2)

        async def reverse():
            payload = await self.gateway.read(
                "nominatim",
                {"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 10, "accept-language": "en", "addressdetails": 1},
            )
            address = payload["address"]
            allowed = ("country_code", "state", "state_district", "county")
            data = {key: address.get(key) for key in allowed}
            if any(v is not None and (not isinstance(v, str) or len(v) > 150) for v in data.values()):
                raise Unavailable()
            if not data.get("country_code"):
                raise Unavailable()
            return data

        section = await self.gateway.section("nominatim", [lat, lon], reverse, 86400)
        address = section["data"]
        if not address:
            section["data"] = result
            return section, False
        if address["country_code"].casefold() != "in":
            raise ValueError("Detected area is outside India. Choose your area manually.")
        try:
            detected = resolve_location(state=address.get("state"))
            try:
                detected = resolve_location(
                    state_code=detected["state_code"], district=address.get("state_district") or address.get("county")
                )
            except ValueError:
                pass
            if (
                manual["state_code"]
                and manual["state_code"] != detected["state_code"]
                or manual["district_code"]
                and detected["district_code"]
                and manual["district_code"] != detected["district_code"]
            ):
                raise ValueError("Detected and selected areas disagree. Choose your area manually.")
            result = Location(
                state_name=detected["state"],
                district_name=detected["district"],
                state_lgd_code=detected["state_code"],
                district_lgd_code=detected["district_code"],
                accuracy_meters=body.accuracy_meters,
                resolution="name_mapping",
                confidence="partial",
            )
        except ValueError as error:
            if "disagree" in str(error):
                raise
        section["data"] = result
        section["source"].status = "partial"
        section[
            "source"
        ].message = "Coarse area name matched to LGD. Confirm it. Village codes and land ownership are not inferred."
        return section, True

    async def build(self, body):
        crop = resolve_crop(body.crop_id, None)[1] if body.crop_id else None
        location, coordinates_verified = await self.location(body)
        area = location["data"]
        lat, lon = (round(body.latitude, 2), round(body.longitude, 2)) if coordinates_verified else (None, None)

        async def weather():
            if lat is None:
                return absent("imd", "Use location with permission to load area weather")
            if self.settings.imd_enabled:
                section = await self.gateway.section("imd", [lat, lon], lambda: imd(self.gateway, lat, lon), 900)
                if section["data"]:
                    section["source"].observed_at = section["data"]["observed_at"]
                    return section
            section = await self.gateway.section(
                "open_meteo",
                [lat, lon],
                lambda: open_meteo(self.gateway, lat, lon),
                1800,
                fallback=True,
                stale_seconds=1800,
            )
            if section["data"]:
                section["source"].observed_at = section["data"]["observed_at"]
                if section["source"].status != "stale":
                    section["source"].message = "Open-Meteo fallback. IMD is unavailable or awaiting approved access."
            return section

        async def soil():
            if not self.settings.soilgrids_enabled:
                return absent(
                    "soilgrids",
                    "SoilGrids REST is paused by its publisher. Add a measured report instead.",
                    disabled=True,
                    url="https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html",
                )
            if lat is None:
                return absent("soilgrids", "Use location with permission to request a soil estimate")
            return await self.gateway.section(
                "soilgrids", [lat, lon], lambda: soilgrids(self.gateway, lat, lon), 604800
            )

        async def spatial():
            if not self.settings.bhuvan_enabled:
                return absent("bhuvan", "Bhuvan public map catalogue is disabled", disabled=True)
            section = await self.gateway.section(
                "bhuvan", "capabilities-v1", lambda: bhuvan(self.gateway), 86400, stale_seconds=86400
            )
            if section["data"]:
                section[
                    "source"
                ].message = "Public map catalogue only. No plot land-use or flood measurement was retrieved."
                if section["source"].status == "success":
                    section["source"].status = "partial"
            return section

        async def market():
            if not self.settings.ogd_key.get_secret_value():
                return absent("ogd", "Server API key is missing. No market price has been invented.", disabled=True)
            if not crop or not area.state_name:
                return absent("ogd", "Choose your crop and state to load dated market quotes")
            section = await self.gateway.section(
                "ogd",
                [area.state_name, area.district_name, crop],
                lambda: ogd(
                    self.gateway, self.settings.ogd_key.get_secret_value(), area.state_name, area.district_name, crop
                ),
                3600,
                stale_seconds=3600,
            )
            if section["data"]:
                from datetime import datetime, timedelta, timezone

                stamp = datetime.fromisoformat(section["data"][0]["observed_date"]).replace(tzinfo=timezone.utc)
                section["source"].observed_at = stamp
                if stamp < datetime.now(timezone.utc) - timedelta(days=2):
                    section["source"].status = "stale"
                    section[
                        "source"
                    ].message = "Dated market quotes are older than two days. Verify locally before selling."
            elif section["data"] == []:
                section["source"].status = "unavailable"
                section["source"].message = "No comparable market quotes were returned for this crop and area."
            return section

        weather_section, soil_section, spatial_section, market_section = await asyncio.gather(
            weather(), soil(), spatial(), market()
        )
        sections = [weather_section, soil_section, spatial_section, market_section]
        return FarmContext(
            location=location,
            weather=weather_section,
            soil=soil_section,
            geospatial=spatial_section,
            market=market_section,
            schemes=PublicInformationAdapter().catalog(),
            status="available"
            if all(x["source"].status == "success" for x in sections)
            else "partial"
            if any(x["data"] is not None for x in sections) or area.state_name
            else "unavailable",
        )

    def health(self):
        return {
            "observed": self.gateway.last_health,
            "restricted": {
                "meri_pehchaan": {
                    "status": "disabled",
                    "reason": "Approved partner registration and verified OAuth configuration required",
                },
                "soil_health_card": {"status": "disabled", "reason": "No authorized report API configured"},
                "agristack": {"status": "disabled", "reason": "No authorized farmer registry API configured"},
                "enam": {"status": "disabled", "reason": "No authorized trading API configured"},
            },
            "identity_verification": False,
            "land_ownership_verification": False,
            "benefit_eligibility_verification": False,
        }

"""Spoken farm setup and the field assessment built from the farmer's records."""

import os
import unittest
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete

from db.models import Base
from v2.agronomy import area_to_hectares, fertilizer_products, match_location, soil_from_texture, typical_soil
from v2.application import install_v2
from v2.assessment import plan_inputs, schemes
from v2.farm_context.models import Soil, india_today
from v2.farm_setup import normalize, same_district
from v2.settings import Settings

ORIGIN = "http://localhost:3000"
SPOKEN = {
    "name": "Ram Lal",
    "village": "Bari",
    "district": "Dhaulpur",
    "state": "Rajasthan",
    "area_value": 5,
    "area_unit": "bigha",
    "crop": "Wheat",
    "soil_type": None,
    "soil_condition": "dry",
    "water": "irrigated",
    "seed": None,
}


class AgronomyTests(unittest.TestCase):
    def test_spoken_spellings_resolve_to_the_official_district(self):
        place = match_location("Rajasthan", "Dhaulpur")
        self.assertEqual((place["state"], place["district"]), ("Rajasthan", "Dholpur"))
        self.assertEqual(match_location("Rajsthan", None)["state_code"], 8)
        self.assertIsNone(match_location("Atlantis", None))

    def test_land_units_and_local_bigha(self):
        self.assertEqual(area_to_hectares(5, "hectare"), 5.0)
        self.assertAlmostEqual(area_to_hectares(10, "acre"), 4.0469, places=3)
        self.assertAlmostEqual(area_to_hectares(5, "bigha", "Rajasthan"), 1.2646, places=3)
        self.assertIsNone(area_to_hectares(5, "bigha", "Punjab"))
        self.assertAlmostEqual(area_to_hectares(5, "bigha", "Punjab", 1000), 0.5)
        self.assertIsNone(area_to_hectares(-1, "acre"))
        self.assertIsNone(area_to_hectares(1, "furlong"))

    def test_soil_texture_and_regional_fallback(self):
        loam = Soil(sand_g_kg=465, clay_g_kg=252, silt_g_kg=283)
        self.assertEqual(soil_from_texture(loam, "Rajasthan"), "Loamy")
        self.assertEqual(soil_from_texture(Soil(sand_g_kg=800, clay_g_kg=50, silt_g_kg=150)), "Sandy")
        self.assertEqual(soil_from_texture(Soil(sand_g_kg=200, clay_g_kg=450, silt_g_kg=350), "Maharashtra"), "Black")
        self.assertEqual(soil_from_texture(Soil(sand_g_kg=200, clay_g_kg=200, silt_g_kg=600), "Punjab"), "Alluvial")
        self.assertIsNone(soil_from_texture(Soil()))
        self.assertEqual(typical_soil("Rajasthan", "Dholpur"), "Alluvial")
        self.assertEqual(typical_soil("Rajasthan", "Jaisalmer", 70.9), "Sandy")
        self.assertIsNone(typical_soil("Atlantis"))

    def test_fertilizer_products_supply_the_plan_nutrients(self):
        wheat = fertilizer_products("wheat")  # 120 N, 60 P2O5, 40 K2O
        self.assertAlmostEqual(wheat["DAP"] * 0.46, 60, delta=0.1)
        self.assertAlmostEqual(wheat["DAP"] * 0.18 + wheat["Urea"] * 0.46, 120, delta=0.1)
        self.assertAlmostEqual(wheat["MOP"] * 0.60, 40, delta=0.1)


class SetupNormalizationTests(unittest.TestCase):
    def test_model_output_is_checked_against_fixed_lists(self):
        draft = normalize(SPOKEN)
        self.assertEqual((draft["district"], draft["district_code"], draft["state_code"]), ("Dholpur", 98, 8))
        self.assertEqual((draft["crop_id"], draft["season"], draft["days_to_harvest"]), ("wheat", "rabi", 135))
        self.assertAlmostEqual(draft["area_hectares"], 1.2646, places=3)
        self.assertEqual(draft["bigha_square_metres"], 2529.3)
        self.assertEqual((draft["soil_condition"], draft["water"], draft["soil_type"]), ("dry", "irrigated", None))
        guessed = normalize(SPOKEN | {"soil_type": "Alluvial"})
        self.assertIsNone(guessed["soil_type"])  # not named by the farmer
        named = normalize(SPOKEN | {"soil_type": "Black", "soil_words": "kali mitti"})
        self.assertEqual((named["soil_type"], named["soil_source"]), ("Black", "spoken"))
        wild = normalize(
            {"crop": "Moon rice", "area_value": "lots", "area_unit": "furlong", "soil_type": "Purple", "water": "pipes"}
        )
        self.assertEqual(
            [wild[key] for key in ("crop_id", "area_hectares", "area_unit", "soil_type", "water", "district")],
            [None, None, None, None, None, None],
        )

    def test_village_matches_must_be_in_the_farmers_district(self):
        self.assertTrue(same_district({"state_district": "Dhaulpur"}, "Dholpur"))
        self.assertTrue(same_district({"county": "Dholpur District"}, "Dholpur"))
        self.assertFalse(same_district({"state_district": "Nagaur"}, "Dholpur"))

    def test_plan_inputs_follow_water_dryness_and_seed(self):
        irrigated = plan_inputs("wheat", 2.0, "Alluvial", {}, "irrigated", {"per_quintal": 2425}, "high")
        rainfed = plan_inputs(
            "wheat", 2.0, "Alluvial", {"condition": "dry", "seed": "own_saved"}, "rainfed", None, None
        )
        # About six waterings over a 4.5-month wheat season; none when rain-fed.
        self.assertAlmostEqual(irrigated["irrigation_frequency"] * irrigated["season_months"], 6, delta=0.1)
        self.assertEqual(rainfed["irrigation_frequency"], 0)
        self.assertEqual(irrigated["expected_rainfall"], 150 + 6 * 60)
        self.assertEqual(irrigated["seed_quantity_kg"], 200)
        self.assertEqual(irrigated["pest_probability"], 0.35)
        self.assertLess(rainfed["expected_rainfall"], irrigated["expected_rainfall"])
        self.assertEqual(rainfed["seed_quality"], 0.6)

    def test_schemes_follow_the_field(self):
        dry = [x["id"] for x in schemes("wheat", "rabi", {"condition": "dry", "source": "soil_map"}, "rainfed", None)]
        self.assertEqual(dry, ["pm-kisan", "pmfby", "soil-health-card", "kcc", "pmksy", "pm-kusum", "enam"])
        tested = schemes("wheat", "rabi", {"source": "soil_test"}, "irrigated", None)
        self.assertNotIn("soil-health-card", [x["id"] for x in tested])
        self.assertNotIn("pmksy", [x["id"] for x in tested])
        self.assertEqual(next(x for x in tested if x["id"] == "pmfby")["premium_percent"], 1.5)


@unittest.skipUnless(os.getenv("V2_TEST_DATABASE_URL"), "Dedicated disposable PostGIS test URL required")
class SetupAndAssessmentEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ["V2_TEST_DATABASE_URL"]
        if not url.endswith("/krishyak_v2_test"):
            raise ValueError("Integration tests require the named disposable test database")
        cls.app = FastAPI()
        install_v2(
            cls.app,
            Settings(
                enabled=True,
                environment="test",
                database_url=url,
                auth_secret="synthetic-test-secret-" * 3,
                origins=[ORIGIN],
                otp_provider="development",
                dev_mobiles=["+919000000001", "+919000000002"],
            ),
        )
        cls.factory = cls.app.state.v2_database

    def setUp(self):
        with self.factory.begin() as db:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(delete(table))
        self.app.state.v2_quotas.local.clear()
        self.a = TestClient(self.app)
        self.a.headers["Origin"] = ORIGIN
        challenge = self.a.post("/api/v2/auth/request-otp", json={"mobile": "+919000000001"}).json()
        result = self.a.post(
            "/api/v2/auth/verify-otp",
            json={"challenge_id": challenge["challenge_id"], "code": "123456", "accept_policy_version": "2026-10-03"},
        )
        self.a.headers["X-CSRF-Token"] = result.json()["csrf_token"]

    def tearDown(self):
        self.a.close()

    def consent(self, *purposes):
        for purpose in purposes:
            response = self.a.post(
                "/api/v2/consents", json={"purpose": purpose, "granted": True, "policy_version": "2026-10-03"}
            )
            self.assertEqual(response.status_code, 200, response.text)

    def understand(self, text="main Dhaulpur se hoon"):
        return self.a.post("/api/v2/farm-setup/understand", json={"text": text, "language": "hi"})

    def test_understanding_needs_permission_and_only_maps_with_location_consent(self):
        self.assertEqual(self.understand().status_code, 403)
        self.consent("speech_processing")
        reply = AsyncMock(return_value=str(SPOKEN).replace("'", '"').replace("None", "null"))
        gateway = SimpleNamespace(read=AsyncMock(side_effect=AssertionError("no lookups without consent")))
        with (
            patch("v2.farm_setup.complete", reply),
            patch.object(self.app.state.v2_farm_context, "gateway", gateway),
        ):
            response = self.understand()
        self.assertEqual(response.status_code, 200, response.text)
        draft = response.json()
        self.assertEqual((draft["district"], draft["crop_id"], draft["location"]), ("Dholpur", "wheat", None))
        # East Rajasthan's typical soil, labelled as a rough guess.
        self.assertEqual((draft["soil_type"], draft["soil_source"]), ("Alluvial", "state_typical"))
        self.assertEqual(draft["missing"], [])
        self.assertEqual(draft["retention"], "not_stored")

    def test_village_location_and_soil_map_are_used_with_consent(self):
        self.consent("speech_processing", "location_processing")
        reply = AsyncMock(return_value='```json\n{"village": "Bari", "district": "Dholpur", "state": "Rajasthan"}\n```')

        async def read(provider, params, **options):
            if provider == "nominatim_search":
                return [
                    {"lat": "26.70", "lon": "77.90", "addresstype": "town", "address": {"state_district": "Dhaulpur"}}
                ]
            self.assertEqual(dict(params)["lat"], 26.74)  # sampled outside the town
            layer = lambda name, value: {  # noqa: E731
                "name": name,
                "unit_measure": {"d_factor": 10, "target_units": "%"},
                "depths": [{"label": "0-5cm", "values": {"mean": value}}],
            }
            return {"properties": {"layers": [layer("clay", 252), layer("sand", 465), layer("silt", 283)]}}

        with (
            patch("v2.farm_setup.complete", reply),
            patch.object(self.app.state.v2_farm_context, "gateway", SimpleNamespace(read=read)),
        ):
            draft = self.understand().json()
        self.assertEqual(draft["location"], {"latitude": 26.7, "longitude": 77.9, "matched": "village", "urban": True})
        self.assertEqual((draft["soil_type"], draft["soil_source"]), ("Loamy", "soil_map"))
        self.assertEqual(draft["soil_measurements"]["sand_percent"], 46)
        self.assertEqual(draft["missing"], ["area", "crop"])

    def test_saved_field_gets_a_full_assessment(self):
        self.consent("agronomic_analysis")
        self.a.patch("/api/v2/me", json={"display_name": "Ram Lal", "state": "Rajasthan", "district": "Dholpur"})
        farm = self.a.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Bari farm"}).json()
        body = {
            "operation_id": str(uuid4()),
            "farm_id": farm["id"],
            "name": "Wheat field",
            "entered_area_hectares": 1.2646,
            "irrigation_type": "irrigated",
            "soil_metadata": {"soil_type": "Loamy", "source": "soil_map", "condition": "dry"},
        }
        plot = self.a.post("/api/v2/plots", json=body)
        self.assertEqual(plot.status_code, 201, plot.text)
        self.assertEqual(self.a.post("/api/v2/plots", json=body).json()["id"], plot.json()["id"])
        plot = plot.json()
        self.assertEqual(plot["soil_metadata"], {"soil_type": "Loamy", "source": "soil_map", "condition": "dry"})
        path = f"/api/v2/plots/{plot['id']}/assessment"
        self.assertEqual(self.a.post(path).status_code, 422)  # no crop yet
        cycle = self.a.post(
            f"/api/v2/plots/{plot['id']}/crop-cycles",
            json={
                "crop_id": "wheat",
                "sowing_date": india_today().isoformat(),
                "expected_harvest": (india_today() + timedelta(days=135)).isoformat(),
            },
        )
        self.assertEqual(cycle.status_code, 201, cycle.text)
        report = self.a.post(path)
        self.assertEqual(report.status_code, 200, report.text)
        result = report.json()
        self.assertEqual((result["crop_id"], result["season"], result["water"]), ("wheat", "rabi", "irrigated"))
        self.assertTrue(0 <= result["field_score"] <= 100)
        self.assertGreater(result["harvest"]["total_quintals"], 0)
        self.assertEqual(result["price"]["source"], "msp")
        self.assertEqual(result["inputs"]["seed_kg"], 126.5)
        self.assertEqual(result["inputs"]["nutrients_kg_per_hectare"], {"N": 120, "P2O5": 60, "K2O": 40})
        self.assertEqual(set(result["risk"]), {"overall", "weather", "price", "pest", "soil"})
        self.assertTrue(all(row["crop_id"] != "wheat" for row in result["alternatives"]))
        self.assertIn("pmfby", [x["id"] for x in result["schemes"]])
        # An edit from an older screen without soil details keeps them.
        update = dict(body, revision=plot["revision"])
        update.pop("soil_metadata")
        update.pop("operation_id")
        kept = self.a.put(f"/api/v2/plots/{plot['id']}", json=update | {"operation_id": body["operation_id"]})
        self.assertEqual(kept.status_code, 200, kept.text)
        self.assertEqual(kept.json()["soil_metadata"]["soil_type"], "Loamy")

    def test_assessment_needs_permission_and_ownership(self):
        farm = self.a.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "F"}).json()
        plot = self.a.post(
            "/api/v2/plots",
            json={"operation_id": str(uuid4()), "farm_id": farm["id"], "name": "P", "entered_area_hectares": 1},
        ).json()
        self.assertEqual(self.a.post(f"/api/v2/plots/{plot['id']}/assessment").status_code, 403)
        self.consent("agronomic_analysis")
        self.assertEqual(self.a.post(f"/api/v2/plots/{uuid4()}/assessment").status_code, 404)


if __name__ == "__main__":
    unittest.main()

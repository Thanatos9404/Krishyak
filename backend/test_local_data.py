"""District yield forecasts, climate outlook, GPS registration lookup and the report built on them."""

import asyncio
import os
import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete

from db.models import Base
from v2 import climate, yields
from v2.application import install_v2
from v2.farm_context.models import india_today
from v2.farm_context.transport import Unavailable
from v2.farm_setup import season_now
from v2.settings import Settings

ORIGIN = "http://localhost:3000"
MOBILES = ["+919000000001", "+919000000002", "+919000000003"]


def archive_payload(start, end, rain_for=lambda day: 0.0):
    days, cursor = [], start
    while cursor <= end:
        days.append(cursor)
        cursor += timedelta(days=1)
    return {
        "daily_units": {"precipitation_sum": "mm", "temperature_2m_max": "°C", "temperature_2m_min": "°C"},
        "daily": {
            "time": [d.isoformat() for d in days],
            "precipitation_sum": [rain_for(d) for d in days],
            "temperature_2m_max": [40.0 if d.month == 5 else 30.0 for d in days],
            "temperature_2m_min": [8.0 if d.month == 1 else 20.0 for d in days],
        },
    }


def forecast_payload():
    today = india_today()
    return {
        "daily_units": {
            "temperature_2m_max": "°C",
            "temperature_2m_min": "°C",
            "precipitation_sum": "mm",
            "precipitation_probability_max": "%",
            "wind_speed_10m_max": "km/h",
            "weather_code": "wmo code",
        },
        "daily": {
            "time": [(today + timedelta(days=i)).isoformat() for i in range(7)],
            "temperature_2m_max": [25.4] * 7,
            "temperature_2m_min": [14.8] * 7,
            "precipitation_sum": [0, 0, 6.2, 31.0, 0, 0, 0],
            "precipitation_probability_max": [0, 5, 80, 95, 10, 0, None],
            "wind_speed_10m_max": [8.2] * 7,
            "weather_code": [0, 3, 61, 65, 2, 0, 45],
        },
    }


class FakeGateway:
    """Answers like Nominatim, Open-Meteo and SoilGrids; records which providers were asked."""

    def __init__(self):
        self.quotas = SimpleNamespace(redis=None)
        self.calls = []
        self.failing = set()

    async def read(self, provider, params, **options):
        self.calls.append(provider)
        if provider in self.failing:
            raise Unavailable()
        params = dict(params)
        if provider == "open_meteo":
            return forecast_payload()
        if provider == "open_meteo_archive":
            start, end = date.fromisoformat(params["start_date"]), date.fromisoformat(params["end_date"])
            # 10 mm on every July day, 1 mm on every January day, dry otherwise.
            return archive_payload(start, end, lambda d: 10.0 if d.month == 7 else 1.0 if d.month == 1 else 0.0)
        if provider == "nominatim":
            return {
                "address": {
                    "country_code": "in",
                    "state": "Rajasthan",
                    "state_district": "Jaipur District",
                    "village": "Harota",
                }
            }
        if provider == "nominatim_search":
            return [{"lat": "27.17", "lon": "75.72", "addresstype": "village", "address": {"state_district": "Jaipur"}}]
        if provider == "soilgrids":

            def layer(name, unit, mean):
                return {
                    "name": name,
                    "unit_measure": {"d_factor": 10, "target_units": unit},
                    "depths": [{"label": "0-5cm", "values": {"mean": mean}}],
                }

            return {
                "properties": {"layers": [layer("clay", "%", 255), layer("sand", "%", 466), layer("silt", "%", 278)]}
            }
        raise AssertionError(provider)


class YieldTableTests(unittest.TestCase):
    def test_a_district_gets_its_own_forecast_with_a_range(self):
        row = yields.district_yield("wheat", "rabi", "Rajasthan", "Jaipur")
        self.assertEqual(row["level"], "district")
        self.assertTrue(2500 < row["kg_per_hectare"] < 5000)  # the all-India average would be about 3,500
        self.assertLess(row["low"], row["kg_per_hectare"])
        self.assertGreater(row["high"], row["kg_per_hectare"])
        self.assertGreaterEqual(row["years_of_records"], 10)
        punjab = yields.district_yield("wheat", "rabi", "Punjab", "Ludhiana")
        self.assertGreater(punjab["kg_per_hectare"], row["kg_per_hectare"])

    def test_spelling_variants_still_match_and_unknown_places_fall_back(self):
        self.assertEqual(yields.district_yield("wheat", "rabi", "Rajasthan", "Jaipur ")["level"], "district")
        self.assertEqual(yields.district_yield("wheat", "rabi", "Rajasthan", "No Such District")["level"], "state")
        self.assertEqual(yields.district_yield("wheat", "rabi", "Atlantis", "Nowhere")["level"], "national")
        self.assertIsNone(yields.district_yield("dragonfruit", "rabi", "Rajasthan", "Jaipur"))
        self.assertIsNone(yields.district_yield(None, "rabi", "Rajasthan", "Jaipur"))

    def test_local_crop_mix_comes_from_district_records(self):
        grown = yields.common_crops("Rajasthan", "Jaipur")
        rabi = [row["crop_id"] for row in grown["rabi"]]
        self.assertIn("wheat", rabi)
        self.assertIn("mustard", rabi)
        self.assertTrue(all(3 <= row["area_share_percent"] <= 100 for row in grown["rabi"]))
        self.assertEqual(yields.common_crops("Atlantis", "Nowhere"), {})

    def test_the_model_card_reports_the_baselines_it_was_compared_with(self):
        card = yields.model_card()
        test = card["test"]["horizon_2_years"]
        served, old = test["served_per_crop_selection"], test["national_average_previous_engine"]
        # The point of the model: far closer than the all-India average the engine used before.
        self.assertLess(served["median_ape_pct"], old["median_ape_pct"] * 0.6)
        self.assertLessEqual(served["mae_kg_ha"], test["district_5_year_mean"]["mae_kg_ha"])
        self.assertTrue(70 <= card["interval_80pct_coverage"]["test_2022_23"] <= 90)
        self.assertIn("leakage_control", card["splits"])


class ClimateTests(unittest.TestCase):
    def setUp(self):
        climate.LOCAL.clear()
        self.gateway = FakeGateway()

    def test_ten_years_of_daily_weather_become_monthly_and_seasonal_normals(self):
        normal = asyncio.run(climate.normals(self.gateway, 27.17, 75.72))
        self.assertEqual(normal["monthly_rain_mm"][6], 310.0)  # July: 31 days x 10 mm
        self.assertEqual(normal["monthly_rain_mm"][0], 31.0)
        self.assertEqual(normal["annual_rain_mm"], 341)
        self.assertEqual(normal["season_rain_mm"], {"kharif": 310, "rabi": 31, "summer": 0})
        self.assertEqual(normal["monthly_high_c"][4], 40.0)
        self.assertEqual(normal["monthly_low_c"][0], 8.0)
        self.assertEqual(normal["rainy_days_per_year"], 31)
        self.assertEqual(normal["years"][1], india_today().year - 1)
        # The same cell is answered from the cache: one archive call in total.
        asyncio.run(climate.normals(self.gateway, 27.171, 75.724))
        self.assertEqual(self.gateway.calls.count("open_meteo_archive"), 1)

    def test_recent_rain_is_compared_with_the_same_dates_in_a_normal_year(self):
        normal = asyncio.run(climate.normals(self.gateway, 27.17, 75.72))
        recent = asyncio.run(climate.recent_rain(self.gateway, 27.17, 75.72, normal))
        window = recent["last_90_days"]
        self.assertAlmostEqual(window["rain_mm"], window["normal_mm"], delta=0.5)
        if window["normal_mm"] >= 10:
            self.assertEqual(window["percent_of_normal"], 100)
        else:
            self.assertIsNone(window["percent_of_normal"])  # a dry season has no meaningful percentage

    def test_the_week_ahead_is_seven_checked_days(self):
        week = asyncio.run(climate.week_ahead(self.gateway, 27.17, 75.72))
        self.assertEqual(len(week["days"]), 7)
        self.assertEqual(
            [day["sky"] for day in week["days"]], ["clear", "cloudy", "rain", "heavy_rain", "cloudy", "clear", "fog"]
        )
        self.assertEqual(week["days"][3]["rain_mm"], 31.0)
        self.assertIsNone(week["days"][6]["rain_chance_percent"])

    def test_one_failing_source_does_not_hide_the_others(self):
        self.gateway.failing = {"open_meteo_archive"}
        result = asyncio.run(climate.outlook(self.gateway, 27.17, 75.72))
        self.assertIsNotNone(result["forecast"])
        self.assertIsNone(result["climate"])
        self.assertIsNone(result["recent_rain"])
        self.assertTrue(result["limits"])

    def test_seasons_follow_the_indian_calendar(self):
        self.assertEqual(season_now(date(2026, 7, 1)), "kharif")
        self.assertEqual(season_now(date(2026, 11, 20)), "rabi")
        self.assertEqual(season_now(date(2027, 1, 15)), "rabi")
        self.assertEqual(season_now(date(2027, 4, 10)), "summer")


@unittest.skipUnless(os.getenv("V2_TEST_DATABASE_URL"), "Dedicated disposable PostGIS test URL required")
class RegistrationAndReportTests(unittest.TestCase):
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
                dev_mobiles=MOBILES,
            ),
        )
        cls.factory = cls.app.state.v2_database

    def setUp(self):
        with self.factory.begin() as db:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(delete(table))
        self.app.state.v2_quotas.local.clear()
        climate.LOCAL.clear()
        self.gateway = FakeGateway()
        self.patch = patch.object(self.app.state.v2_farm_context, "gateway", self.gateway)
        self.patch.start()
        self.client = TestClient(self.app)
        self.client.headers["Origin"] = ORIGIN
        challenge = self.client.post("/api/v2/auth/request-otp", json={"mobile": MOBILES[0]}).json()
        result = self.client.post(
            "/api/v2/auth/verify-otp",
            json={"challenge_id": challenge["challenge_id"], "code": "123456", "accept_policy_version": "2026-10-03"},
        )
        self.client.headers["X-CSRF-Token"] = result.json()["csrf_token"]

    def tearDown(self):
        self.patch.stop()
        self.client.close()

    def allow(self, *purposes):
        for purpose in purposes:
            response = self.client.post(
                "/api/v2/consents", json={"purpose": purpose, "granted": True, "policy_version": "2026-10-03"}
            )
            self.assertEqual(response.status_code, 200, response.text)

    def wheat_field(self, **plot):
        self.client.patch("/api/v2/me", json={"display_name": "Ramesh", "state_code": 8, "district_code": 102})
        farm = self.client.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Farm"}).json()
        body = {
            "operation_id": str(uuid4()),
            "farm_id": farm["id"],
            "name": "Wheat field",
            "entered_area_hectares": 1.2,
            "irrigation_type": "irrigated",
            "soil_metadata": {"soil_type": "Loamy", "source": "farmer_selected"},
            **plot,
        }
        created = self.client.post("/api/v2/plots", json=body)
        self.assertEqual(created.status_code, 201, created.text)
        sowing = india_today() - timedelta(days=20)
        cycle = self.client.post(
            f"/api/v2/plots/{created.json()['id']}/crop-cycles",
            json={
                "crop_id": "wheat",
                "sowing_date": sowing.isoformat(),
                "expected_harvest": (sowing + timedelta(days=135)).isoformat(),
            },
        )
        self.assertEqual(cycle.status_code, 201, cycle.text)
        return created.json()

    def test_a_gps_fix_fills_place_soil_climate_and_local_crops(self):
        body = {"latitude": 27.17123, "longitude": 75.72044, "accuracy_meters": 18}
        self.assertEqual(self.client.post("/api/v2/farm-setup/locate", json=body).status_code, 403)
        self.assertEqual(self.gateway.calls, [])  # nothing leaves the server without permission
        self.allow("location_processing")
        response = self.client.post("/api/v2/farm-setup/locate", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        found = response.json()
        self.assertEqual(
            found["location"], {"latitude": 27.17, "longitude": 75.72, "accuracy_meters": 18, "matched": "gps"}
        )
        self.assertEqual(
            found["place"],
            {"state_code": 8, "district_code": 102, "state": "Rajasthan", "district": "Jaipur", "village": "Harota"},
        )
        self.assertEqual((found["soil"]["soil_type"], found["soil"]["source"]), ("Loamy", "soil_map"))
        self.assertEqual(found["climate"]["annual_rain_mm"], 341)
        self.assertNotIn("daily_normal_mm", found["climate"])
        self.assertEqual(len(found["forecast"]["days"]), 7)
        self.assertEqual(found["season"], season_now())
        self.assertTrue(all(row["crop_id"] for row in found["suggested_crops"]))
        self.assertEqual(found["retention"], "not_stored")
        with self.factory() as db:
            from db.models import Plot

            self.assertEqual(db.query(Plot).count(), 0)

    def test_a_chosen_district_and_village_work_without_gps(self):
        self.allow("location_processing")
        response = self.client.post(
            "/api/v2/farm-setup/locate", json={"state_code": 8, "district_code": 102, "village": "Harota"}
        )
        self.assertEqual(response.status_code, 200, response.text)
        found = response.json()
        self.assertEqual(found["location"]["matched"], "village")
        self.assertEqual(found["place"]["district"], "Jaipur")
        self.assertEqual(self.client.post("/api/v2/farm-setup/locate", json={"village": "Harota"}).status_code, 422)
        self.assertEqual(self.client.post("/api/v2/farm-setup/locate", json={"latitude": 27.1}).status_code, 422)

    def test_a_slow_soil_map_does_not_hold_up_registration(self):
        self.allow("location_processing")
        self.gateway.failing = {"soilgrids"}
        found = self.client.post("/api/v2/farm-setup/locate", json={"latitude": 27.17, "longitude": 75.72}).json()
        self.assertEqual(found["soil"]["source"], "state_typical")
        self.assertIn(found["soil"]["soil_type"], {"Alluvial", "Sandy"})
        self.assertEqual(found["place"]["village"], "Harota")

    def test_the_field_report_is_anchored_on_the_district_forecast_and_real_rainfall(self):
        self.allow("location_processing", "agronomic_analysis")
        plot = self.wheat_field(approximate_location={"latitude": 27.17, "longitude": 75.72})
        report = self.client.get(f"/api/v2/plots/{plot['id']}/assessment")
        self.assertEqual(report.status_code, 200, report.text)
        report = report.json()
        basis = report["harvest"]["basis"]
        district = yields.district_yield("wheat", "rabi", "Rajasthan", "Jaipur")
        self.assertEqual((basis["level"], basis["kg_per_hectare"]), ("district", district["kg_per_hectare"]))
        # Farm practice can move the district figure, but only within 30 %.
        ratio = report["harvest"]["yield_kg_per_hectare"] / district["kg_per_hectare"]
        self.assertTrue(0.69 <= ratio <= 1.31, ratio)
        self.assertEqual(basis["farm_adjustment_percent"], round((ratio - 1) * 100))
        self.assertEqual(report["assumptions"]["method"], "district_yield_model_with_farm_adjustments")
        self.assertEqual(report["assumptions"]["season_rain_source"], "ten_year_normal")
        self.assertEqual(
            report["assumptions"]["season_rain_mm"], round(31 + 310 * 0.15)
        )  # rabi rain + carried moisture
        # Other crops are only suggested if this district is recorded as growing them.
        for row in report["alternatives"]:
            self.assertEqual(yields.district_yield(row["crop_id"], "rabi", "Rajasthan", "Jaipur")["level"], "district")
        self.assertEqual(self.client.post(f"/api/v2/plots/{plot['id']}/assessment").status_code, 200)

    def test_without_a_location_the_report_says_its_rain_figure_is_an_assumption(self):
        self.allow("agronomic_analysis")
        plot = self.wheat_field()
        report = self.client.get(f"/api/v2/plots/{plot['id']}/assessment").json()
        self.assertEqual(report["assumptions"]["season_rain_source"], "regional_assumption")
        self.assertEqual(report["harvest"]["basis"]["level"], "district")
        self.assertNotIn("open_meteo_archive", self.gateway.calls)

    def test_the_outlook_needs_permission_and_a_place(self):
        self.allow("agronomic_analysis")
        plot = self.wheat_field()
        self.assertEqual(self.client.get(f"/api/v2/plots/{plot['id']}/outlook").status_code, 403)
        self.allow("location_processing")
        self.assertEqual(self.client.get(f"/api/v2/plots/{plot['id']}/outlook").status_code, 422)
        located = self.wheat_field(approximate_location={"latitude": 27.17, "longitude": 75.72})
        outlook = self.client.get(f"/api/v2/plots/{located['id']}/outlook")
        self.assertEqual(outlook.status_code, 200, outlook.text)
        self.assertEqual(len(outlook.json()["forecast"]["days"]), 7)
        self.assertEqual(outlook.json()["climate"]["season_rain_mm"]["kharif"], 310)
        self.gateway.failing = {"open_meteo", "open_meteo_archive"}
        climate.LOCAL.clear()
        self.assertEqual(self.client.get(f"/api/v2/plots/{located['id']}/outlook").status_code, 503)

    def test_the_example_field_is_public_and_computed_from_live_sources(self):
        visitor = TestClient(self.app)
        response = visitor.get("/api/v2/example/field")
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual((body["example"]["district"], body["example"]["crop_id"]), ("Jaipur", "wheat"))
        self.assertIn("not a real farm", body["notice"])
        basis = body["report"]["harvest"]["basis"]
        district = yields.district_yield("wheat", "rabi", "Rajasthan", "Jaipur")
        self.assertEqual((basis["level"], basis["kg_per_hectare"]), ("district", district["kg_per_hectare"]))
        self.assertEqual(body["report"]["assumptions"]["season_rain_source"], "ten_year_normal")
        self.assertEqual(len(body["outlook"]["forecast"]["days"]), 7)
        self.assertEqual(body["calendar"]["status"], "available")
        # No account, no cookie, nothing stored.
        self.assertNotIn("set-cookie", {key.lower() for key in response.headers})
        with self.factory() as db:
            from db.models import Plot

            self.assertEqual(db.query(Plot).count(), 0)
        visitor.close()

    def test_without_a_mandi_quote_the_report_uses_the_dated_support_price(self):
        from gov_api_service import MSP_DATA

        self.allow("agronomic_analysis")
        plot = self.wheat_field()
        price = self.client.get(f"/api/v2/plots/{plot['id']}/assessment").json()["price"]
        entry = MSP_DATA["crops"]["Wheat"]
        self.assertEqual((price["source"], price["per_quintal"]), ("msp", float(entry["msp"])))
        self.assertEqual(price["date"], entry["year"])
        self.assertTrue(price["source_url"].startswith("https://"))

    def test_a_crop_with_no_price_gets_a_harvest_but_no_invented_money(self):
        self.allow("agronomic_analysis")
        plot = self.wheat_field()
        with patch("v2.assessment.price_for", return_value=None):
            report = self.client.post(f"/api/v2/plots/{plot['id']}/assessment")
        self.assertEqual(report.status_code, 200, report.text)
        report = report.json()
        self.assertGreater(report["harvest"]["yield_kg_per_hectare"], 0)
        self.assertIsNone(report["price"])
        for key in ("profit", "revenue", "profit_per_hectare", "profit_range", "chance_of_profit_percent"):
            self.assertIsNone(report["harvest"][key], key)
        self.assertIsNone(report["ai_plan"]["profit"])
        self.assertIsNone(report["ai_plan"]["extra_profit"])

    def test_the_farming_profile_is_saved_and_checked(self):
        saved = self.client.patch(
            "/api/v2/me",
            json={"display_name": "Ramesh", "farming_kind": "crops_and_animals", "farming_method": "organic"},
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        farmer = saved.json()["farmer"]
        self.assertEqual((farmer["farming_kind"], farmer["farming_method"]), ("crops_and_animals", "organic"))
        bad = self.client.patch("/api/v2/me", json={"display_name": "Ramesh", "farming_method": "magic"})
        self.assertEqual(bad.status_code, 422)


if __name__ == "__main__":
    unittest.main()

"""Public-provider contracts and failure isolation without any paid/external calls."""

import asyncio
import copy
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch

import httpx
from pydantic import ValidationError

from v2.farm_context.engines import reviewed_market_history, scenario_inputs
from v2.farm_context.models import ContextInput, MarketRecord, Soil, Source, india_today, now
from v2.farm_context.providers import imd, normalize_capabilities, normalize_markets, normalize_soil, open_meteo
from v2.farm_context.service import FarmContextService
from v2.farm_context.settings import ProviderSettings
from v2.farm_context.transport import Gateway, Unavailable
from v2.limits import Quotas
from v2.settings import Settings


def quotas():
    return Quotas(Settings(auth_secret="synthetic-test-secret-" * 3))


class ContextModelsTests(unittest.TestCase):
    def test_coordinates_are_paired_finite_and_india_bounded(self):
        for payload in (
            {"latitude": 26.9},
            {"latitude": float("nan"), "longitude": 75.8},
            {"latitude": 51, "longitude": 0},
            {"district_code": 102},
            {"latitude": True, "longitude": 75.8},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                ContextInput(**payload)
        with self.assertRaises(ValidationError):
            Source(
                provider="Fixture",
                status="success",
                source_url="https://example.test",
                retrieved_at="2026-10-04T10:00:00",
            )

    def test_soil_estimates_preserve_units_and_missing_nutrients(self):
        payload = {
            "properties": {
                "layers": [
                    {
                        "name": "nitrogen",
                        "unit_measure": {"d_factor": 100, "target_units": "g/kg"},
                        "depths": [{"label": "0-5cm", "values": {"mean": 150}}],
                    },
                    {
                        "name": "soc",
                        "unit_measure": {"d_factor": 10, "target_units": "g/kg"},
                        "depths": [{"label": "0-5cm", "values": {"mean": None}}],
                    },
                ]
            }
        }
        soil = normalize_soil(payload)
        self.assertEqual(soil.nitrogen_g_kg, 1.5)
        self.assertIsNone(soil.organic_carbon_g_kg)
        self.assertIsNone(soil.phosphorus)
        self.assertTrue(soil.estimated)
        payload["properties"]["layers"][0]["unit_measure"]["d_factor"] = 10
        with self.assertRaises(Unavailable):
            normalize_soil(payload)
        with self.assertRaises(ValidationError):
            Soil(ph=15)

    def test_wms_catalogue_cannot_claim_point_evidence_or_expand_entities(self):
        spatial = normalize_capabilities(
            b'<WMS_Capabilities><Layer><Name>landuse</Name><Layer queryable="1"><Name>district</Name></Layer></Layer></WMS_Capabilities>'
        )
        self.assertEqual(spatial.queryable_layers, ["district"])
        self.assertIsNone(spatial.land_use)
        self.assertTrue(spatial.capabilities_only)
        with self.assertRaises(Unavailable):
            normalize_capabilities(b'<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]><WMS_Capabilities/>')

    def test_market_quotes_reject_conflicting_duplicates_wrong_crop_and_bad_prices(self):
        row = {
            "state": "Rajasthan",
            "district": "Jaipur",
            "commodity": "Wheat",
            "variety": "Other",
            "market": "Fixture",
            "arrival_date": india_today().strftime("%d/%m/%Y"),
            "min_price": "2000",
            "max_price": "2200",
            "modal_price": "2100",
        }
        result = normalize_markets(
            {
                "records": [
                    row,
                    copy.deepcopy(row),
                    row | {"commodity": "Rice"},
                    row | {"market": "Bad", "modal_price": "nan"},
                ]
            },
            "Rajasthan",
            "Jaipur",
            "Wheat",
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["unit"], "INR/quintal")
        self.assertEqual(
            normalize_markets({"records": [row, row | {"modal_price": "2050"}]}, "Rajasthan", "Jaipur", "Wheat"), []
        )

    def test_mandi_calendar_rolls_at_indian_midnight_and_rejects_future_dates(self):
        row = {
            "state": "Rajasthan",
            "district": "Jaipur",
            "commodity": "Wheat",
            "variety": "Other",
            "market": "Fixture",
            "arrival_date": "05/10/2026",
            "min_price": "2000",
            "max_price": "2200",
            "modal_price": "2100",
        }
        for minute, expected_date, expected_count in ((29, date(2026, 10, 4), 0), (30, date(2026, 10, 5), 1)):
            with (
                self.subTest(minute=minute),
                patch(
                    "v2.farm_context.models.now", return_value=datetime(2026, 10, 4, 18, minute, tzinfo=timezone.utc)
                ),
            ):
                self.assertEqual(india_today(), expected_date)
                quotes = normalize_markets(
                    {"records": [row, row | {"arrival_date": "06/10/2026"}, row | {"arrival_date": "03/09/2026"}]},
                    "Rajasthan",
                    "Jaipur",
                    "Wheat",
                )
                self.assertEqual(len(quotes), expected_count)
                if quotes:
                    self.assertEqual(quotes[0]["observed_date"], "2026-10-05")


class MarketHistoryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from test_system_integrity import PARAMS

        self.parameters = PARAMS
        self.context = await FarmContextService(quotas(), ProviderSettings(bhuvan_enabled=False)).build(
            ContextInput(state_code=8)
        )
        self.context.market.source = Source(
            provider="ogd",
            status="success",
            source_url="https://www.data.gov.in/",
            valid_until=now() + timedelta(hours=1),
        )

    def quote(self, days=0, **overrides):
        values = {
            "commodity": self.parameters["crop"],
            "market": "Fixture market",
            "variety": "Fixture variety",
            "district": "Jaipur",
            "state": "Rajasthan",
            "modal_price": 2100 + days * 10,
            "observed_date": india_today() - timedelta(days=days),
        }
        return MarketRecord(**(values | overrides))

    def simulate(self):
        from simulation_engine import SimulationEngine

        quote = self.context.market.data[0]
        return SimulationEngine().run_whatif_simulation(
            self.parameters, 2, farm_context=self.context, market_quote_index=0, expected_quote_id=quote.quote_id
        )

    async def test_history_cannot_mix_markets_varieties_crops_or_administrative_areas(self):
        quote = self.quote()
        self.context.market.data = [
            quote,
            self.quote(1),
            self.quote(2, market="Other market"),
            self.quote(2, variety="Other variety"),
            self.quote(2, commodity="Wheat"),
            self.quote(2, district="Jodhpur"),
            self.quote(2, state="Gujarat"),
            self.quote(31),
            self.quote(-1),
        ]
        frame, stats, source = reviewed_market_history(self.context, quote.model_dump(mode="json"))
        self.assertEqual(frame["Modal_x0020_Price"].tolist(), [2110, 2100])
        self.assertEqual(stats["observations"], 2)
        self.assertEqual(source["market"], "Fixture market")
        self.assertEqual(source["variety"], "Fixture variety")
        self.assertEqual(source["unit"], "INR/quintal")
        self.assertFalse(source["complete_archive"])
        self.assertFalse(source["missing_days_filled"])

    async def test_consecutive_normalized_records_reach_forecaster_and_risk_once(self):
        self.context.market.data = [self.quote(i) for i in range(21)]
        with patch("v2.farm_context.engines.reviewed_market_history", wraps=reviewed_market_history) as history:
            result = self.simulate()
        self.assertEqual(history.call_count, 1)
        for name in ("current_plan", "ai_optimal_plan", "worst_case_plan"):
            with self.subTest(name=name):
                forecast = result[name]["price_forecast"]
                self.assertEqual(forecast["historical_days"], 21)
                self.assertEqual(forecast["consecutive_returns"], 20)
                self.assertFalse(forecast["forecast_validated"])
                self.assertEqual(forecast["method"], "persistence_baseline")
                self.assertEqual(forecast["prediction_interval"]["kind"], "uncalibrated_log_return_interval")
                self.assertEqual(forecast["history_metadata"]["provider"], "ogd")
                self.assertEqual(result[name]["risk"]["component_evidence"]["price"], "historical_price_dispersion")
                self.assertEqual(result[name]["risk"]["contextual_evidence"]["market"]["history"]["observations"], 21)
        self.assertEqual(
            result["current_plan"]["price_forecast"]["source_metadata"]["source_type"], "reviewed_public_quote"
        )
        worst_source = result["worst_case_plan"]["price_forecast"]["source_metadata"]
        self.assertEqual(worst_source["source_type"], "scenario_assumption")
        self.assertTrue(worst_source["is_scenario_adjustment"])
        self.assertEqual(worst_source["reference_price"], 2100)

    async def test_one_quote_does_not_borrow_unrelated_local_history(self):
        import pandas as pd

        from simulation_engine import SimulationEngine

        quote = self.quote()
        self.context.market.data = [quote]
        engine = SimulationEngine()
        unrelated = pd.DataFrame(
            {"Arrival_Date": pd.date_range(end=india_today(), periods=30), "Modal_x0020_Price": range(4000, 4030)}
        )
        with patch.object(engine.price_forecaster.data_loader, "get_commodity_prices", return_value=unrelated):
            result = engine.run_whatif_simulation(
                self.parameters, 2, farm_context=self.context, market_quote_index=0, expected_quote_id=quote.quote_id
            )
        forecast = result["current_plan"]["price_forecast"]
        self.assertEqual(forecast["historical_days"], 1)
        self.assertEqual(forecast["consecutive_returns"], 0)
        self.assertIsNone(forecast["prediction_interval"])
        self.assertEqual(forecast["volatility_level"], "Unknown")
        self.assertEqual(
            result["current_plan"]["risk"]["component_evidence"]["price"], "assumed_baseline_insufficient_history"
        )

    async def test_date_gaps_and_conflicting_duplicates_are_not_filled_or_averaged(self):
        quote = self.quote()
        self.context.market.data = [self.quote(i) for i in range(0, 29, 2)] + [
            self.quote(4),
            self.quote(6, modal_price=3100),
        ]
        frame, _, source = reviewed_market_history(self.context, quote.model_dump(mode="json"))
        self.assertEqual(len(frame), 14)
        self.assertNotIn(india_today() - timedelta(days=6), frame["Arrival_Date"].dt.date.tolist())
        self.assertFalse(source["missing_days_filled"])
        forecast = self.simulate()["current_plan"]["price_forecast"]
        self.assertEqual(forecast["consecutive_returns"], 0)
        self.assertIsNone(forecast["prediction_interval"])


class GatewayTests(unittest.IsolatedAsyncioTestCase):
    async def test_provider_http_and_payload_failures_are_sanitized(self):
        for status in (400, 401, 403, 404, 408, 429, 500, 502, 503):

            async def handler(request, status=status):
                return httpx.Response(status, text="private upstream token")

            gateway = Gateway(
                quotas(), client_factory=lambda **kw: httpx.AsyncClient(transport=httpx.MockTransport(handler), **kw)
            )
            with self.subTest(status=status), self.assertRaises(Unavailable) as error:
                await gateway.read("ogd", {})
            self.assertEqual(str(error.exception), "")
        for content_type, raw in (("text/html", b"<html/>"), ("application/json", b""), ("application/json", b"{")):

            async def malformed(request, raw=raw, content_type=content_type):
                return httpx.Response(200, content=raw, headers={"content-type": content_type})

            gateway = Gateway(
                quotas(), client_factory=lambda **kw: httpx.AsyncClient(transport=httpx.MockTransport(malformed), **kw)
            )
            with self.subTest(content_type=content_type, raw=raw), self.assertRaises(Unavailable):
                await gateway.read("ogd", {})

    async def test_weather_units_dates_forecast_only_imd_and_fallback(self):
        stamp = now().replace(minute=0, second=0, microsecond=0)
        units = {"temperature_2m": "°C", "relative_humidity_2m": "%", "precipitation": "mm", "wind_speed_10m": "km/h"}
        row = {
            "time": stamp.strftime("%Y-%m-%dT%H:%M"),
            "temperature_2m": 29,
            "relative_humidity_2m": 60,
            "precipitation": 1,
            "wind_speed_10m": 4,
        }
        payload = {
            "current": row,
            "current_units": units,
            "hourly_units": units,
            "hourly": {
                "time": [(stamp + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M") for i in range(48)],
                **{key: [row[key]] * 48 for key in units},
            },
        }
        gateway = Gateway(quotas())
        gateway.read = AsyncMock(return_value=payload)
        weather = await open_meteo(gateway, 26.91, 75.81)
        self.assertEqual(weather.precipitation_next_24h_mm, 24)
        payload["hourly_units"] = units | {"precipitation": "inch"}
        with self.assertRaises(Unavailable):
            await open_meteo(gateway, 26.91, 75.81)
        imd_row = {
            "Latitude": "26.91",
            "Longitude": "75.81",
            "Date": india_today().isoformat(),
            "Station_Name": "Fixture Jaipur",
        }
        for i in range(7):
            prefix = "Todays_Forecast_" if i == 0 else f"Day_{i + 1}_"
            description = "Todays_Forecast" if i == 0 else f"Day_{i + 1}_Forecast"
            imd_row.update({prefix + "Min_Temp": "20", prefix + "Max_Temp": "30", description: "Partly cloudy"})
        gateway.read = AsyncMock(return_value=[imd_row])
        official = await imd(gateway, 26.91, 75.81)
        self.assertEqual(len(official.daily_forecast), 7)
        self.assertIsNone(official.temperature_c)
        self.assertIsNone(official.precipitation_next_24h_mm)
        imd_row["Date"] = (india_today() - timedelta(days=4)).isoformat()
        with self.assertRaises(Unavailable):
            await imd(gateway, 26.91, 75.81)

    async def test_normalized_evidence_preserves_manual_models_and_only_imports_reviewed_prices(self):
        from simulation_engine import SimulationEngine
        from test_system_integrity import PARAMS

        context = await FarmContextService(quotas(), ProviderSettings(bhuvan_enabled=False)).build(
            ContextInput(state_code=8)
        )
        engine = SimulationEngine()
        plain = engine.run_whatif_simulation(PARAMS, 10)
        enriched = engine.run_whatif_simulation(PARAMS, 10, farm_context=context)
        for key in ("current_plan", "ai_optimal_plan", "worst_case_plan"):
            evidence = enriched[key]["risk"].pop("contextual_evidence")
            self.assertFalse(evidence["land_ownership_verified"])
        self.assertEqual(plain, enriched)
        quote = MarketRecord(
            commodity=PARAMS["crop"],
            market="Fixture",
            variety="Other",
            district="Jaipur",
            state="Rajasthan",
            modal_price=2700,
            observed_date=india_today(),
        )
        context.market.data = [quote]
        context.market.source = Source(
            provider="ogd",
            status="success",
            source_url="https://www.data.gov.in/",
            valid_until=now() + timedelta(minutes=5),
        )
        reviewed, _ = scenario_inputs(PARAMS, context, 0, quote.quote_id)
        self.assertEqual(reviewed["current_market_price"], 2700)
        self.assertEqual(reviewed["expected_rainfall"], PARAMS["expected_rainfall"])
        self.assertEqual(reviewed["fertilizer_mix"], PARAMS["fertilizer_mix"])
        for index, digest, change in (
            (0, "0" * 64, {}),
            (1, quote.quote_id, {}),
            (0, quote.quote_id, {"crop": "Cotton"}),
        ):
            with self.subTest(index=index, change=change), self.assertRaises(ValueError):
                scenario_inputs(PARAMS | change, context, index, digest)
        context.market.source.status = "stale"
        with self.assertRaises(ValueError):
            scenario_inputs(PARAMS, context, 0, quote.quote_id)

    async def test_mandi_freshness_and_review_use_the_same_indian_calendar(self):
        from test_system_integrity import PARAMS

        clock = datetime(2026, 10, 4, 18, 30, tzinfo=timezone.utc)
        with (
            patch("v2.farm_context.models.now", return_value=clock),
            patch("v2.farm_context.engines.now", return_value=clock),
            patch("v2.farm_context.transport.now", return_value=clock),
        ):
            for stamp, status in ((date(2026, 10, 3), "success"), (date(2026, 10, 2), "stale")):
                with self.subTest(stamp=stamp):
                    gateway = Gateway(quotas())
                    gateway.read = AsyncMock(
                        return_value={
                            "records": [
                                {
                                    "state": "Rajasthan",
                                    "district": "Jaipur",
                                    "commodity": PARAMS["crop"],
                                    "variety": "Other",
                                    "market": "Fixture",
                                    "arrival_date": stamp.strftime("%d/%m/%Y"),
                                    "min_price": "2000",
                                    "max_price": "2200",
                                    "modal_price": "2100",
                                }
                            ]
                        }
                    )
                    context = await FarmContextService(
                        quotas(), ProviderSettings(ogd_key="synthetic-test-key", bhuvan_enabled=False), gateway
                    ).build(ContextInput(state_code=8, district_code=102, crop_id="rice"))
                    self.assertEqual(context.market.source.status, status)
                    self.assertIsNone(context.market.source.observed_at)
                    quote = context.market.data[0]
                    self.assertEqual(quote.observed_date, stamp)
                    if status == "success":
                        reviewed, _ = scenario_inputs(PARAMS, context, 0, quote.quote_id)
                        self.assertEqual(reviewed["current_market_price"], 2100)
                    else:
                        with self.assertRaises(ValueError):
                            scenario_inputs(PARAMS, context, 0, quote.quote_id)

    async def test_review_rejects_future_and_calendar_stale_quotes_independently_of_cache(self):
        from test_system_integrity import PARAMS

        context = await FarmContextService(quotas(), ProviderSettings(bhuvan_enabled=False)).build(
            ContextInput(state_code=8)
        )
        clock = datetime(2026, 10, 4, 18, 30, tzinfo=timezone.utc)
        context.market.source = Source(
            provider="ogd",
            status="success",
            source_url="https://www.data.gov.in/",
            valid_until=clock + timedelta(hours=1),
        )
        with (
            patch("v2.farm_context.models.now", return_value=clock),
            patch("v2.farm_context.engines.now", return_value=clock),
        ):
            for stamp in (date(2026, 10, 6), date(2026, 10, 2)):
                with self.subTest(stamp=stamp):
                    quote = MarketRecord(
                        commodity=PARAMS["crop"],
                        market="Fixture",
                        variety="Other",
                        district="Jaipur",
                        state="Rajasthan",
                        modal_price=2100,
                        observed_date=stamp,
                    )
                    context.market.data = [quote]
                    with self.assertRaisesRegex(ValueError, "not comparable"):
                        scenario_inputs(PARAMS, context, 0, quote.quote_id)

    async def test_singleflight_cache_stale_bounds_and_circuit(self):
        clock = [0.0]
        gateway = Gateway(quotas(), clock=lambda: clock[0])
        loader = AsyncMock(return_value={"value": 1})
        values = await asyncio.gather(
            *(gateway.section("ogd", "fixture", loader, 10, stale_seconds=10) for _ in range(5))
        )
        self.assertEqual(loader.await_count, 1)
        self.assertTrue(all(v["data"] == {"value": 1} for v in values))
        hit = await gateway.section("ogd", "fixture", loader, 10, stale_seconds=10)
        self.assertTrue(hit["source"].cache_hit)
        clock[0] = 11
        loader.side_effect = ValueError("private token and coordinates")
        stale = await gateway.section("ogd", "fixture", loader, 10, stale_seconds=10)
        self.assertEqual(stale["source"].status, "stale")
        clock[0] = 22
        missing = await gateway.section("ogd", "fixture", loader, 10, stale_seconds=10)
        self.assertIsNone(missing["data"])
        self.assertNotIn("private", missing["source"].model_dump_json())
        self.assertEqual(loader.await_count, 2)

    async def test_distributed_provider_spacing_fails_closed(self):
        quota = quotas()
        quota.redis = Mock()
        quota.redis.set.return_value = False
        gateway = Gateway(quota)
        with self.assertRaises(Unavailable):
            await gateway.pace("soilgrids", 12.1)
        self.assertEqual(quota.redis.set.call_args.kwargs["px"], 12100)
        quota.redis.set.side_effect = ConnectionError("secret")
        with self.assertRaises(Unavailable):
            await gateway.pace("nominatim", 1.1)

    async def test_fixed_endpoints_no_redirect_and_bounded_json(self):
        captured = []

        async def handler(request):
            captured.append(request)
            return httpx.Response(200, json={"value": 1})

        def factory(**kwargs):
            return httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs)

        gateway = Gateway(quotas(), client_factory=factory)
        self.assertEqual(await gateway.read("ogd", {"api-key": "private-fixture-key"}), {"value": 1})
        self.assertEqual(captured[0].url.host, "api.data.gov.in")
        with self.assertRaises(Unavailable):
            await gateway.read("https://attacker.test", {})

        async def redirect(request):
            return httpx.Response(302, headers={"location": "http://169.254.169.254/"})

        gateway.client_factory = lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(redirect), **kwargs)
        with self.assertRaises(Unavailable):
            await gateway.read("ogd", {})

        async def oversized(request):
            return httpx.Response(
                200, headers={"content-type": "application/json"}, content=b"x" * (2 * 1024 * 1024 + 1)
            )

        gateway.client_factory = lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(oversized), **kwargs)
        with self.assertRaises(Unavailable):
            await gateway.read("ogd", {})

    async def test_manual_context_needs_no_gps_and_missing_credentials_are_honest(self):
        service = FarmContextService(quotas(), ProviderSettings(bhuvan_enabled=False))
        result = await service.build(ContextInput(state_code=8, district_code=102, crop_id="wheat"))
        self.assertEqual(result.location.data.district_lgd_code, 102)
        self.assertEqual(result.market.source.status, "disabled")
        self.assertIsNone(result.market.data)
        self.assertIsNone(result.weather.data)
        self.assertFalse(result.precise_coordinates_stored)
        self.assertEqual(result.status, "partial")
        self.assertFalse(service.health()["identity_verification"])

    async def test_country_rejection_happens_before_downstream_calls(self):
        gateway = Gateway(quotas())
        gateway.read = AsyncMock(return_value={"address": {"country_code": "np", "state": "Fixture"}})
        service = FarmContextService(quotas(), ProviderSettings(nominatim_enabled=True, bhuvan_enabled=False), gateway)
        with self.assertRaises(ValueError):
            await service.build(ContextInput(latitude=27.7, longitude=85.3))
        self.assertEqual(gateway.read.await_count, 1)

    async def test_gps_matches_lgd_without_inventing_village_codes_and_failure_isolation(self):
        gateway = Gateway(quotas())

        async def read(provider, params, **kwargs):
            if provider == "nominatim":
                return {
                    "address": {
                        "country_code": "in",
                        "state": "Rajasthan",
                        "state_district": "Jaipur",
                        "village": "Fixture private village",
                    }
                }
            raise Unavailable()

        gateway.read = AsyncMock(side_effect=read)
        service = FarmContextService(
            quotas(), ProviderSettings(nominatim_enabled=True, soilgrids_enabled=True), gateway
        )
        result = await service.build(
            ContextInput(latitude=26.912345, longitude=75.812345, accuracy_meters=80, crop_id="wheat")
        )
        self.assertEqual(result.location.data.district_lgd_code, 102)
        self.assertIsNone(result.location.data.village_lgd_code)
        self.assertEqual(result.location.data.confidence, "partial")
        self.assertEqual(result.weather.source.status, "unavailable")
        self.assertEqual(result.status, "partial")
        self.assertNotIn("26.912345", result.model_dump_json())
        reverse = gateway.read.call_args_list[0].args[1]
        self.assertEqual(reverse["lat"], 26.91)
        self.assertNotIn("Fixture private village", result.model_dump_json())

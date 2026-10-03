"""Real PostGIS integration tests use a dedicated disposable database only."""

import asyncio
import copy
import io
import json
import os
import unittest
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, Mock, patch
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import delete, select

from db.models import (
    AuthChallenge,
    Base,
    Consent,
    Farmer,
    ImageAsset,
    Job,
    ObjectDeletion,
    Observation,
    Session,
    utcnow,
)
from v2.application import install_v2
from v2.schemas import ObservationInput, PlotInput, ProfileInput
from v2.settings import Settings

ORIGIN = "http://localhost:3000"
POLYGON = {
    "type": "Polygon",
    "coordinates": [[[75.8, 26.9], [75.801, 26.9], [75.801, 26.901], [75.8, 26.901], [75.8, 26.9]]],
}


class ConfigAndSchemaTests(unittest.TestCase):
    def test_profile_language_acceptance_matches_the_first_pilot_scope(self):
        pilot = json.loads(
            (Path(__file__).resolve().parents[1] / "frontend/src/i18n/pilotLanguages.json").read_text(encoding="utf-8")
        )
        for code in pilot["codes"]:
            with self.subTest(language=code):
                profile = ProfileInput(display_name="Synthetic farmer", preferred_language=code)
                self.assertEqual(profile.preferred_language, code)
        for code in pilot["deferred"]:
            with self.subTest(deferred=code), self.assertRaises(ValidationError):
                ProfileInput(display_name="Synthetic farmer", preferred_language=code)

    def test_hosted_runtime_cannot_reenable_legacy_pii_or_development_identity(self):
        with patch.dict(os.environ, {"VERCEL": "1", "ENVIRONMENT": "development", "KRISHYAK_V2_ENABLED": "false"}):
            settings = Settings.from_env()
            self.assertTrue(settings.deployed)
            app = FastAPI()
            install_v2(app, settings)
            with TestClient(app) as client:
                self.assertEqual(client.post("/register-farmer", json={}).status_code, 410)
            with self.assertRaises(ValidationError):
                Settings(
                    enabled=True,
                    hosted=True,
                    environment="development",
                    database_url="postgresql+psycopg://synthetic/test",
                    auth_secret="test-auth-secret-" * 3,
                    otp_provider="development",
                    dev_mobiles=["+919000000001"],
                )

    def test_redis_outage_fails_closed_without_logging_identity(self):
        from v2.limits import Quotas

        quotas = Quotas(Settings(auth_secret="test-auth-secret-" * 3))
        quotas.redis = Mock()
        quotas.redis.eval.side_effect = ConnectionError("private connection details")
        with self.assertRaises(HTTPException) as raised:
            quotas.check("otp_mobile", "+919000000001", 3, 600)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertNotIn("private", raised.exception.detail)
        self.assertNotIn("9000000001", str(quotas.redis.eval.call_args))

    def test_moisture_inspection_needs_recent_clear_comparable_history_and_weather(self):
        from types import SimpleNamespace

        from v2.evidence import compose_today

        now = utcnow()
        plot = SimpleNamespace(id=uuid4(), name="Synthetic", revision=1)
        rows = [
            SimpleNamespace(
                observed_at=now - timedelta(days=5 - index),
                source="Synthetic fixture",
                source_type="remote_sensing",
                provenance={"boundary_revision": 1, "aggregation_days": 10},
                payload={
                    "index": "ndmi",
                    "observation": {"quality_status": "clear", "mean": value, "valid_fraction": 0.9},
                },
            )
            for index, value in enumerate([0.6, 0.6, 0.6, 0.6, 0.4])
        ]
        weather = SimpleNamespace(
            created_at=now,
            observed_at=now,
            source="Synthetic weather fixture",
            provenance={"boundary_revision": 1},
            payload={"precipitation_next_24h_mm": 0},
        )
        result = compose_today(plot, rows, weather=weather)
        self.assertEqual(result["actions"][0]["kind"], "moisture_context")
        self.assertIn("cannot establish water stress", result["actions"][0]["evidence"]["limitations"][0])
        for change in ["cloud", "stale", "different_boundary", "rain"]:
            selected = copy.deepcopy(rows)
            forecast = copy.deepcopy(weather)
            if change == "cloud":
                selected[-1].payload["observation"]["quality_status"] = "cloudy"
            elif change == "stale":
                forecast.created_at -= timedelta(hours=7)
            elif change == "different_boundary":
                selected[-1].provenance["boundary_revision"] = 2
            else:
                forecast.payload["precipitation_next_24h_mm"] = 1
            self.assertFalse(
                any(
                    action["kind"] == "moisture_context"
                    for action in compose_today(plot, selected, weather=forecast)["actions"]
                )
            )

    def test_malformed_weather_fails_without_fabricated_fallback(self):
        from v2.context import fetch_weather
        from weather_alerts import weather_alert_service

        current = {"temperature": 27, "humidity": 60, "wind_speed": 3, "timestamp": None, "utc_offset_seconds": 0}
        forecasts = [
            Mock(
                to_dict=Mock(
                    return_value={
                        "timestamp": utcnow().isoformat(),
                        "temperature": 27,
                        "humidity": 60,
                        "wind_speed": 3,
                        "precipitation": 0,
                    }
                )
            )
            for _ in range(48)
        ]
        with (
            patch.object(weather_alert_service, "get_current_weather", AsyncMock(return_value=current)),
            patch.object(weather_alert_service, "get_forecast", AsyncMock(return_value=forecasts)),
            self.assertRaises(HTTPException) as raised,
        ):
            asyncio.run(fetch_weather(26.9, 75.8))
        self.assertEqual(raised.exception.status_code, 503)

    def test_private_logging_masks_plot_id_and_omits_network_identity(self):
        from logging_config import RequestLogger

        recorder = RequestLogger("test-private")
        identifier = str(uuid4())
        with patch.object(recorder.logger, "info") as log:
            recorder.log_request("safe-trace", "GET", f"/api/v2/plots/{identifier}/today", "private-ip")
        self.assertNotIn(identifier, str(log.call_args))
        self.assertNotIn("private-ip", str(log.call_args))
        self.assertIn("{id}", str(log.call_args))

    def test_disabled_does_not_require_secrets(self):
        self.assertFalse(Settings().enabled)

    def test_enabled_requires_db_and_secret(self):
        with self.assertRaises(ValidationError):
            Settings(enabled=True)

    def test_deployed_prohibits_development_otp_and_local_storage(self):
        with self.assertRaises(ValidationError):
            Settings(
                enabled=True,
                environment="production",
                database_url="postgresql+psycopg://local/test",
                auth_secret="x" * 32,
                otp_provider="development",
                dev_mobiles=["+919000000001"],
            )

    def test_coordinates_area_and_dates_reject_invalid_values(self):
        for area in [True, float("nan"), float("inf"), 0, -1, 501]:
            with self.subTest(area=area), self.assertRaises(ValidationError):
                PlotInput(operation_id=uuid4(), farm_id=uuid4(), name="Test", entered_area_hectares=area)
        for when in ["2026-01-01T00:00:00", (utcnow() + timedelta(days=1)).isoformat()]:
            with self.assertRaises(ValidationError):
                ObservationInput(operation_id=uuid4(), kind="farmer_observation", observed_at=when, note="Synthetic")


@unittest.skipUnless(os.getenv("V2_TEST_DATABASE_URL"), "Dedicated disposable PostGIS test URL required")
class FoundationIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = os.environ["V2_TEST_DATABASE_URL"]
        if not url.endswith("/krishyak_v2_test"):
            raise ValueError("Integration tests require the named disposable test database")
        cls.settings = Settings(
            enabled=True,
            environment="test",
            database_url=url,
            auth_secret="synthetic-test-secret-" * 3,
            origins=[ORIGIN],
            otp_provider="development",
            dev_mobiles=["+919000000001", "+919000000002"],
        )
        cls.app = FastAPI()
        install_v2(cls.app, cls.settings)
        cls.factory = cls.app.state.v2_database

    def setUp(self):
        self.images = TemporaryDirectory(prefix="krishyak-v2-test-")
        self.app.state.v2_settings.storage_root = Path(self.images.name)
        with self.factory.begin() as db:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(delete(table))
        self.app.state.v2_quotas.local.clear()
        self.a = TestClient(self.app)
        self.b = TestClient(self.app)
        self.a.headers["Origin"] = ORIGIN
        self.b.headers["Origin"] = ORIGIN

    def tearDown(self):
        self.a.close()
        self.b.close()
        self.images.cleanup()

    def sign_in(self, client, mobile="+919000000001"):
        challenge = client.post("/api/v2/auth/request-otp", json={"mobile": mobile})
        self.assertEqual(challenge.status_code, 200, challenge.text)
        payload = {
            "challenge_id": challenge.json()["challenge_id"],
            "code": "123456",
            "accept_policy_version": "2026-10-03",
        }
        result = client.post("/api/v2/auth/verify-otp", json=payload)
        self.assertEqual(result.status_code, 200, result.text)
        client.headers["X-CSRF-Token"] = result.json()["csrf_token"]
        return payload, result.json()

    def consent(self, client, purpose):
        result = client.post(
            "/api/v2/consents", json={"purpose": purpose, "granted": True, "policy_version": "2026-10-03"}
        )
        self.assertEqual(result.status_code, 200, result.text)

    def farm_plot(self, client, mapped=False):
        farm = client.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Synthetic test farm"})
        self.assertEqual(farm.status_code, 201, farm.text)
        payload = {
            "operation_id": str(uuid4()),
            "farm_id": farm.json()["id"],
            "name": "Synthetic field",
            "entered_area_hectares": 1,
        }
        if mapped:
            self.consent(client, "location_processing")
            payload["boundary"] = copy.deepcopy(POLYGON)
        plot = client.post("/api/v2/plots", json=payload)
        self.assertEqual(plot.status_code, 201, plot.text)
        return farm.json(), plot.json(), payload

    def test_farm_revision_conflict_and_delete_isolation(self):
        self.sign_in(self.a)
        self.sign_in(self.b, "+919000000002")
        farm, plot, _ = self.farm_plot(self.a)
        body = {"name": "Renamed synthetic farm", "revision": farm["revision"]}
        first = self.a.patch(f"/api/v2/farms/{farm['id']}", json=body)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(self.a.patch(f"/api/v2/farms/{farm['id']}", json=body).status_code, 409)
        self.assertEqual(self.b.delete(f"/api/v2/farms/{farm['id']}").status_code, 404)
        self.assertEqual(self.a.delete(f"/api/v2/farms/{farm['id']}").status_code, 200)
        self.assertEqual(self.a.get(f"/api/v2/plots/{plot['id']}").status_code, 404)

    def test_weather_persistence_idempotency_freshness_and_permission(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a, mapped=True)
        self.consent(self.a, "agronomic_analysis")
        payload = {
            "current": {"timestamp": utcnow().isoformat(), "temperature": 27, "humidity": 60, "wind_speed": 3},
            "hourly": [],
            "precipitation_next_24h_mm": 0,
            "units": {"temperature": "°C", "precipitation": "mm", "wind_speed": "km/h", "humidity": "%"},
        }
        path = f"/api/v2/plots/{plot['id']}/weather/refresh"
        body = {"operation_id": str(uuid4())}
        with patch("v2.context.fetch_weather", AsyncMock(return_value=payload)) as provider:
            saved = self.a.post(path, json=body)
            self.assertEqual(saved.status_code, 201, saved.text)
            replay = self.a.post(path, json=body)
            self.assertEqual(replay.json()["id"], saved.json()["id"])
            self.assertEqual(provider.call_count, 1)
        self.assertEqual(self.a.get(f"/api/v2/plots/{plot['id']}/weather").json()["status"], "available")
        self.assertFalse(self.a.get(f"/api/v2/plots/{plot['id']}/today").json().get("health_score"))
        self.a.post(
            "/api/v2/consents",
            json={"purpose": "location_processing", "granted": False, "policy_version": "2026-10-03"},
        )
        self.assertEqual(self.a.post(path, json={"operation_id": str(uuid4())}).status_code, 403)

    def test_otp_replay_wrong_attempt_expired_and_session_rotation(self):
        payload, _ = self.sign_in(self.a)
        self.assertEqual(self.a.post("/api/v2/auth/verify-otp", json=payload).status_code, 400)
        old_access = self.a.cookies.get("krishyak_session")
        old_refresh = self.a.cookies.get("krishyak_refresh")
        renewed = self.a.post("/api/v2/auth/refresh")
        self.assertEqual(renewed.status_code, 200, renewed.text)
        self.a.headers["X-CSRF-Token"] = renewed.json()["csrf_token"]
        self.assertNotEqual(old_access, self.a.cookies.get("krishyak_session"))
        self.b.cookies.set("krishyak_session", old_access, path="/api/v2")
        self.assertEqual(self.b.get("/api/v2/me").status_code, 401)
        self.b.cookies.set("krishyak_refresh", old_refresh, path="/api/v2")
        self.assertEqual(self.b.post("/api/v2/auth/refresh").status_code, 401)
        self.assertEqual(self.a.post("/api/v2/auth/logout").status_code, 200)
        self.assertEqual(self.a.get("/api/v2/me").status_code, 401)

    def test_otp_wrong_and_expired(self):
        result = self.a.post("/api/v2/auth/request-otp", json={"mobile": "+919000000001"}).json()
        payload = {"challenge_id": result["challenge_id"], "code": "000000", "accept_policy_version": "2026-10-03"}
        for _ in range(5):
            self.assertEqual(self.a.post("/api/v2/auth/verify-otp", json=payload).status_code, 400)
        payload["code"] = "123456"
        self.assertEqual(self.a.post("/api/v2/auth/verify-otp", json=payload).status_code, 400)
        result = self.a.post("/api/v2/auth/request-otp", json={"mobile": "+919000000001"}).json()
        with self.factory.begin() as db:
            challenge = db.scalar(select(AuthChallenge).where(AuthChallenge.id == result["challenge_id"]))
            challenge.expires_at = utcnow() - timedelta(seconds=1)
        payload["challenge_id"] = result["challenge_id"]
        self.assertEqual(self.a.post("/api/v2/auth/verify-otp", json=payload).status_code, 400)

    def test_origin_csrf_and_disabled_account(self):
        self.a.headers["Origin"] = "https://attacker.invalid"
        self.assertEqual(self.a.post("/api/v2/auth/request-otp", json={"mobile": "+919000000001"}).status_code, 403)
        self.a.headers["Origin"] = ORIGIN
        self.sign_in(self.a)
        self.a.headers.pop("X-CSRF-Token")
        self.assertEqual(
            self.a.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Test"}).status_code, 403
        )
        with self.factory.begin() as db:
            db.scalar(select(Farmer)).status = "disabled"
        self.assertEqual(self.a.get("/api/v2/me").status_code, 401)

    def test_two_owner_idor_and_paginated_lists(self):
        self.sign_in(self.a)
        self.sign_in(self.b, "+919000000002")
        farm, plot, payload = self.farm_plot(self.a)
        self.assertEqual(self.b.get(f"/api/v2/plots/{plot['id']}").status_code, 404)
        self.assertEqual(self.b.get(f"/api/v2/plots/{plot['id']}/timeline").status_code, 404)
        self.assertEqual(self.b.get(f"/api/v2/plots/{plot['id']}/remote-sensing").status_code, 404)
        self.assertEqual(self.b.get(f"/api/v2/plots/{plot['id']}/today").status_code, 404)
        payload["operation_id"] = str(uuid4())
        self.assertEqual(self.b.post("/api/v2/plots", json=payload).status_code, 404)
        self.assertEqual(self.b.get("/api/v2/plots").json()["items"], [])
        self.assertEqual(len(self.a.get("/api/v2/plots?limit=1").json()["items"]), 1)
        self.assertEqual(self.a.get("/api/v2/plots?limit=101").status_code, 422)

    def test_postgis_area_is_computed_and_invalid_geometry_rejected(self):
        self.sign_in(self.a)
        farm, plot, payload = self.farm_plot(self.a, mapped=True)
        self.assertNotEqual(float(plot["area_hectares"]), 1)
        self.assertGreater(float(plot["area_hectares"]), 0)
        self.assertEqual(float(plot["entered_area_hectares"]), 1)
        payload["operation_id"] = str(uuid4())
        payload["boundary"]["coordinates"] = [
            [[75.8, 26.9], [75.801, 26.901], [75.8, 26.901], [75.801, 26.9], [75.8, 26.9]]
        ]
        self.assertEqual(self.a.post("/api/v2/plots", json=payload).status_code, 422)

    def test_crop_overlap_and_revision_conflict(self):
        self.sign_in(self.a)
        _, plot, payload = self.farm_plot(self.a)
        cycle = {"crop": "Tomato", "sowing_date": "2026-09-01", "expected_harvest": "2026-12-01"}
        first = self.a.post(f"/api/v2/plots/{plot['id']}/crop-cycles", json=cycle)
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(self.a.post(f"/api/v2/plots/{plot['id']}/crop-cycles", json=cycle).status_code, 409)
        payload["revision"] = 1
        first = self.a.put(f"/api/v2/plots/{plot['id']}", json=payload)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(self.a.put(f"/api/v2/plots/{plot['id']}", json=payload).status_code, 409)

    def test_idempotency_requires_identical_evidence_and_active_consent(self):
        self.sign_in(self.a)
        _, plot, payload = self.farm_plot(self.a)
        self.assertEqual(self.a.post("/api/v2/plots", json=payload).json()["id"], plot["id"])
        payload["name"] = "Changed"
        self.assertEqual(self.a.post("/api/v2/plots", json=payload).status_code, 409)
        observation = {
            "operation_id": str(uuid4()),
            "kind": "farmer_observation",
            "observed_at": utcnow().isoformat(),
            "note": "Synthetic inspection",
        }
        path = f"/api/v2/plots/{plot['id']}/observations"
        self.assertEqual(self.a.post(path, json=observation).status_code, 403)
        self.consent(self.a, "agronomic_analysis")
        first = self.a.post(path, json=observation)
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(self.a.post(path, json=observation).json()["id"], first.json()["id"])
        observation["note"] = "Different evidence"
        self.assertEqual(self.a.post(path, json=observation).status_code, 409)
        self.assertEqual(len(self.a.get(path.replace("observations", "timeline")).json()["items"]), 1)

    def test_no_data_does_not_mean_healthy_and_request_limits(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a)
        result = self.a.get(f"/api/v2/plots/{plot['id']}/today").json()
        self.assertEqual(result["satellite_status"], "unavailable")
        self.assertNotIn("healthy", str(result))
        self.assertTrue(result["actions"])
        self.assertEqual(self.a.post("/api/v2/farms", content="x" * 70000).status_code, 413)

    def photo(self):
        stream = io.BytesIO()
        exif = Image.Exif()
        exif[270] = "Synthetic sensitive metadata must be removed"
        Image.new("RGB", (128, 128), "green").save(stream, "JPEG", exif=exif)
        return stream.getvalue()

    def scan_photo(self, client, plot_id, operation_id=None, content=None):
        return client.post(
            "/api/v2/disease-scans",
            data={"plot_id": plot_id, "crop": "Tomato", "operation_id": str(operation_id or uuid4())},
            files={"image": ("synthetic.jpg", content or self.photo(), "image/jpeg")},
        )

    def test_private_photo_idempotency_metadata_and_feedback(self):
        self.sign_in(self.a)
        self.sign_in(self.b, "+919000000002")
        _, plot, _ = self.farm_plot(self.a)
        self.consent(self.a, "agronomic_analysis")
        operation = uuid4()
        synthetic_prediction = {"status": "uncertain", "confidence": 0.51, "top_predictions": []}
        with patch("model_inference.predict_from_image", return_value=synthetic_prediction):
            response = self.scan_photo(self.a, plot["id"], operation)
            self.assertEqual(response.status_code, 201, response.text)
            image_id = response.json()["image_id"]
            self.assertEqual(self.scan_photo(self.a, plot["id"], operation).json()["image_id"], image_id)
            self.assertEqual(self.scan_photo(self.b, plot["id"]).status_code, 404)
        downloaded = self.a.get(f"/api/v2/disease-scans/{image_id}/image")
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(Image.open(io.BytesIO(downloaded.content)).getexif(), {})
        self.assertNotIn(b"Synthetic sensitive", downloaded.content)
        self.assertEqual(self.b.get(f"/api/v2/disease-scans/{image_id}/image").status_code, 404)
        body = {"operation_id": str(uuid4()), "image_id": image_id, "verdict": "unsure"}
        first = self.a.post("/api/v2/feedback", json=body)
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(self.a.post("/api/v2/feedback", json=body).json()["id"], first.json()["id"])
        self.assertEqual(self.b.post("/api/v2/feedback", json=body).status_code, 404)
        exported = self.a.get("/api/v2/me/export").json()
        self.assertNotIn("object_key", str(exported))
        self.assertNotIn("token_hash", str(exported))
        self.assertEqual(len(exported["images"]), 1)
        self.assertEqual(len(exported["observations"]), 1)

    def test_image_limits_reject_corruption_spoofing_animation_and_dimensions(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a)
        self.consent(self.a, "agronomic_analysis")
        self.assertEqual(self.scan_photo(self.a, plot["id"], content=b"not a JPEG").status_code, 422)
        self.assertEqual(self.scan_photo(self.a, plot["id"], content=b"x" * (8 * 1024 * 1024 + 1)).status_code, 422)
        stream = io.BytesIO()
        Image.new("RGB", (8193, 1)).save(stream, "JPEG")
        self.assertEqual(self.scan_photo(self.a, plot["id"], content=stream.getvalue()).status_code, 422)
        from v2.providers import sanitize_image

        stream = io.BytesIO()
        Image.new("RGB", (8, 8), "red").save(
            stream, "WEBP", save_all=True, append_images=[Image.new("RGB", (8, 8), "blue")]
        )
        with self.assertRaises(ValueError):
            sanitize_image(stream.getvalue(), "image/webp")

    def test_consent_revocation_during_upload_leaves_only_cleanup(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a)
        self.consent(self.a, "agronomic_analysis")

        def withdraw_during_put(*args):
            with self.factory.begin() as db:
                consent = db.scalar(select(Consent).where(Consent.purpose == "agronomic_analysis"))
                consent.withdrawn_at = utcnow()

        storage = Mock()
        storage.put.side_effect = withdraw_during_put
        with (
            patch("model_inference.predict_from_image", return_value={"status": "unavailable"}),
            patch("v2.images.object_storage", return_value=storage),
        ):
            response = self.scan_photo(self.a, plot["id"])
        self.assertEqual(response.status_code, 403, response.text)
        with self.factory() as db:
            self.assertEqual(db.scalars(select(ImageAsset)).all(), [])
            self.assertEqual(len(db.scalars(select(ObjectDeletion)).all()), 1)

    def test_research_review_active_labels_withdrawal_and_refresh_age(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a)
        self.consent(self.a, "agronomic_analysis")
        self.consent(self.a, "model_improvement")
        with patch("model_inference.predict_from_image", return_value={"status": "uncertain", "confidence": 0.51}):
            image_id = self.scan_photo(self.a, plot["id"]).json()["image_id"]
        self.sign_in(self.b, "+919000000002")
        self.assertEqual(self.b.get("/api/v2/review-queue").status_code, 403)
        with self.factory.begin() as db:
            db.scalar(select(Farmer).where(Farmer.mobile == "+919000000002")).role = "agronomist"
        self.assertEqual(len(self.b.get("/api/v2/review-queue").json()["items"]), 1)
        self.assertEqual(self.b.get(f"/api/v2/review-queue/{image_id}/image").status_code, 200)
        self.assertEqual(
            self.b.post(
                f"/api/v2/review-queue/{image_id}", json={"corrected_class": "invented", "note": "Synthetic review"}
            ).status_code,
            422,
        )
        from v2.images import model_release

        label = model_release()[1][0]
        reviewed = self.b.post(
            f"/api/v2/review-queue/{image_id}",
            json={
                "operation_id": str(uuid4()),
                "corrected_class": label,
                "note": "Synthetic review fixture; no accuracy claim",
            },
        )
        self.assertEqual(reviewed.status_code, 200, reviewed.text)
        self.a.post(
            "/api/v2/consents", json={"purpose": "model_improvement", "granted": False, "policy_version": "2026-10-03"}
        )
        self.assertEqual(self.b.get("/api/v2/review-queue").json()["items"], [])
        self.assertEqual(self.b.get(f"/api/v2/review-queue/{image_id}/image").status_code, 404)
        with self.factory.begin() as db:
            session = db.scalar(
                select(Session).join(Farmer).where(Farmer.mobile == "+919000000002", Session.revoked.is_(False))
            )
            session.authenticated_at = utcnow() - timedelta(minutes=11)
        response = self.b.post("/api/v2/auth/refresh")
        self.assertEqual(response.status_code, 200)
        self.b.headers["X-CSRF-Token"] = response.json()["csrf_token"]
        self.assertEqual(self.b.get("/api/v2/review-queue").status_code, 401)

    def test_account_deletion_cascades_and_durable_cleanup_survives(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a)
        self.consent(self.a, "agronomic_analysis")
        with patch("model_inference.predict_from_image", return_value={"status": "unavailable"}):
            self.scan_photo(self.a, plot["id"])
        self.assertEqual(self.a.delete("/api/v2/me").status_code, 200)
        self.assertEqual(self.a.get("/api/v2/me").status_code, 401)
        with self.factory.begin() as db:
            self.assertEqual(db.scalars(select(Farmer)).all(), [])
            self.assertEqual(db.scalars(select(ImageAsset)).all(), [])
            self.assertEqual(db.scalars(select(Observation)).all(), [])
            self.assertEqual(db.scalars(select(Session)).all(), [])
            self.assertEqual(len(db.scalars(select(ObjectDeletion)).all()), 1)
        from v2.worker import cleanup_once

        cleanup_once(self.factory, self.settings)
        with self.factory() as db:
            self.assertEqual(db.scalars(select(ObjectDeletion)).all(), [])
        self.assertEqual(list(Path(self.images.name).rglob("*.jpg")), [])

    def satellite_job(self, plot):
        self.consent(self.a, "satellite_processing")
        payload = {
            "operation_id": str(uuid4()),
            "start_date": "2026-09-01",
            "end_date": "2026-10-01",
            "index": "ndvi",
            "interval_days": 10,
        }
        service = Mock()
        service.status.return_value = {"status": "ready"}
        with patch("remote_sensing.router.get_service", return_value=service):
            response = self.a.post(f"/api/v2/plots/{plot['id']}/remote-sensing/refresh", json=payload)
        self.assertEqual(response.status_code, 202, response.text)
        return response.json(), payload

    def test_satellite_worker_deduplication_notification_and_ownership(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a, mapped=True)
        job, payload = self.satellite_job(plot)
        service = Mock()
        service.provider.name = "Synthetic provider fixture"
        observed = {
            "start": "2026-09-01T00:00:00Z",
            "end": "2026-09-11T00:00:00Z",
            "mean": 0.61,
            "valid_fraction": 0.9,
            "quality_status": "clear",
        }
        service.execute.return_value = (
            {"observations": [observed], "provenance": {"method": "synthetic fixture"}},
            False,
        )
        from v2.worker import run_once

        self.assertTrue(run_once(self.factory, self.settings, service))
        self.assertEqual(len(self.a.get(f"/api/v2/plots/{plot['id']}/timeline").json()["items"]), 1)
        with self.factory.begin() as db:
            saved = db.get(Job, UUID(job["id"]))
            self.assertEqual(saved.status, "completed")
            saved.status, saved.available_at = "retry", utcnow()
        run_once(self.factory, self.settings, service)
        self.assertEqual(len(self.a.get(f"/api/v2/plots/{plot['id']}/timeline").json()["items"]), 1)
        notice = self.a.get("/api/v2/notifications").json()["items"][0]
        self.sign_in(self.b, "+919000000002")
        self.assertEqual(self.b.post(f"/api/v2/notifications/{notice['id']}/acknowledge").status_code, 404)
        first = self.a.post(f"/api/v2/notifications/{notice['id']}/acknowledge").json()
        self.assertEqual(
            self.a.post(f"/api/v2/notifications/{notice['id']}/acknowledge").json()["acknowledged_at"],
            first["acknowledged_at"],
        )

    def test_worker_revocation_during_provider_call_and_retry_bounds(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a, mapped=True)
        job, _ = self.satellite_job(plot)

        def revoke(*args):
            with self.factory.begin() as db:
                db.scalar(select(Consent).where(Consent.purpose == "satellite_processing")).withdrawn_at = utcnow()
            return {"observations": [], "provenance": {}}, False

        service = Mock()
        service.execute.side_effect = revoke
        from v2.worker import run_once

        run_once(self.factory, self.settings, service)
        with self.factory() as db:
            self.assertEqual(db.get(Job, UUID(job["id"])).status, "cancelled")
            self.assertEqual(db.scalars(select(Observation)).all(), [])
        self.consent(self.a, "satellite_processing")
        from remote_sensing.providers.base import ProviderError

        service.execute.side_effect = ProviderError("provider_outage", "synthetic outage", 503)
        with self.factory.begin() as db:
            saved = db.get(Job, UUID(job["id"]))
            saved.status, saved.attempts = "pending", 0
        for attempt in range(3):
            run_once(self.factory, self.settings, service)
            with self.factory.begin() as db:
                saved = db.get(Job, UUID(job["id"]))
                self.assertEqual(saved.status, "retry" if attempt < 2 else "failed")
                saved.available_at = utcnow()

    def test_soil_units_origin_and_offline_operation_replay(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a)
        self.consent(self.a, "agronomic_analysis")
        body = {
            "operation_id": str(uuid4()),
            "observed_at": utcnow().isoformat(),
            "source": "Synthetic lab report entry",
            "reported_method": "lab_report",
            "measurements": [{"parameter": "ph", "value": 6.5, "unit": "pH", "depth_cm": 15}],
        }
        path = f"/api/v2/plots/{plot['id']}/soil"
        response = self.a.post(path, json=body)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.a.post(path, json=body).json()["id"], response.json()["id"])
        body["operation_id"] = str(uuid4())
        body["measurements"][0]["unit"] = "kg/ha"
        self.assertEqual(self.a.post(path, json=body).status_code, 422)
        self.assertEqual(self.a.get(f"/api/v2/plots/{plot['id']}/today").json()["soil_status"], "recent")

    def test_pilot_role_isolation_enrollment_and_withdrawal(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a)
        self.sign_in(self.b, "+919000000002")
        body = {"name": "Synthetic cohort", "district": "Synthetic district", "crops": ["Tomato"]}
        self.assertEqual(self.b.post("/api/v2/admin/pilots", json=body).status_code, 403)
        with self.factory.begin() as db:
            db.scalar(select(Farmer).where(Farmer.mobile == "+919000000002")).role = "organisation_admin"
        response = self.b.post("/api/v2/admin/pilots", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        cohort = response.json()["id"]
        self.assertEqual(
            self.a.post(f"/api/v2/pilot-enrollments/{cohort}", json={"plot_ids": [plot["id"]]}).status_code, 403
        )
        self.consent(self.a, "pilot_research")
        self.assertEqual(
            self.a.post(f"/api/v2/pilot-enrollments/{cohort}", json={"plot_ids": [plot["id"]]}).status_code, 201
        )
        path = f"/api/v2/admin/pilots/{cohort}/report"
        self.assertEqual(self.a.get(path).status_code, 403)
        report = self.b.get(path).json()
        self.assertEqual(report["enrolled_farmers"], 1)
        self.assertIsNone(report["yield_improvement"])
        self.assertTrue(report["suppressed_small_cohort"])
        self.a.post(
            "/api/v2/consents", json={"purpose": "pilot_research", "granted": False, "policy_version": "2026-10-03"}
        )
        self.assertEqual(self.b.get(path).json()["enrolled_farmers"], 0)

    def test_expired_access_reload_can_bootstrap_but_cannot_refresh_without_csrf(self):
        self.sign_in(self.a)
        with self.factory.begin() as db:
            db.scalar(select(Session)).expires_at = utcnow() - timedelta(seconds=1)
        self.assertEqual(self.a.get("/api/v2/me").status_code, 401)
        self.assertEqual(self.a.get("/api/v2/auth/session").status_code, 200)
        self.a.headers.pop("X-CSRF-Token")
        self.assertEqual(self.a.post("/api/v2/auth/refresh").status_code, 403)
        self.a.headers["X-CSRF-Token"] = self.a.get("/api/v2/auth/session").json()["csrf_token"]
        self.assertEqual(self.a.post("/api/v2/auth/refresh").status_code, 200)

    def test_scheduled_satellite_is_opt_in_bounded_and_deduplicated(self):
        self.sign_in(self.a)
        _, plot, _ = self.farm_plot(self.a, mapped=True)
        self.consent(self.a, "satellite_processing")
        from v2.worker import schedule_once

        service = Mock()
        service.status.return_value = {"status": "ready"}
        self.assertEqual(schedule_once(self.factory, self.settings, service), 0)
        enabled = self.settings.model_copy(
            update={"satellite_schedule_enabled": True, "satellite_schedule_plots_per_day": 1}
        )
        self.assertEqual(schedule_once(self.factory, enabled, service), 1)
        self.assertEqual(schedule_once(self.factory, enabled, service), 0)
        with self.factory() as db:
            jobs = db.scalars(select(Job).where(Job.plot_id == UUID(plot["id"]))).all()
            self.assertEqual(len(jobs), 3)
            self.assertEqual({job.payload["index"] for job in jobs}, {"ndvi", "ndmi", "ndre"})


if __name__ == "__main__":
    unittest.main()

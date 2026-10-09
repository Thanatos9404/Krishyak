"""Passkey sign-in, recovery and serverless worker tests against real PostGIS.

The software authenticator below builds genuine WebAuthn attestation and
assertion bytes (CBOR, COSE EC2 P-256, ECDSA SHA-256), so the production
py_webauthn verifier runs unmodified.
"""

import base64
import hashlib
import json
import os
import struct
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from uuid import uuid4

import cbor2
import httpx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import delete, select

from db.models import Base, Farmer, Job, Passkey, RecoveryCode
from v2.application import install_v2
from v2.providers import VercelBlobStorage
from v2.settings import Settings

ORIGIN = "http://localhost:3000"
SECRET = "synthetic-cron-secret-for-tests-only-000000"


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64url(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


class SoftAuthenticator:
    """A platform authenticator with user verification, like a phone screen lock."""

    def __init__(self, origin=ORIGIN):
        self.origin = origin
        self.rp_id = origin.split("://")[1].split(":")[0]
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.credential_id = os.urandom(32)
        self.count = 0

    def _auth_data(self, attested=False):
        self.count += 1
        flags = 0x01 | 0x04 | (0x40 if attested else 0)  # UP, UV, AT
        data = hashlib.sha256(self.rp_id.encode()).digest() + bytes([flags]) + struct.pack(">I", self.count)
        if attested:
            numbers = self.key.public_key().public_numbers()
            cose = cbor2.dumps(
                {1: 2, 3: -7, -1: 1, -2: numbers.x.to_bytes(32, "big"), -3: numbers.y.to_bytes(32, "big")}
            )
            data += bytes(16) + struct.pack(">H", len(self.credential_id)) + self.credential_id + cose
        return data

    def _client_data(self, kind, options, origin=None):
        return json.dumps(
            {"type": kind, "challenge": options["challenge"], "origin": origin or self.origin, "crossOrigin": False}
        ).encode()

    def create(self, options, origin=None):
        client_data = self._client_data("webauthn.create", options, origin)
        attestation = cbor2.dumps({"fmt": "none", "attStmt": {}, "authData": self._auth_data(attested=True)})
        return {
            "id": b64url(self.credential_id),
            "rawId": b64url(self.credential_id),
            "type": "public-key",
            "response": {
                "clientDataJSON": b64url(client_data),
                "attestationObject": b64url(attestation),
                "transports": ["internal", "hybrid"],
            },
            "clientExtensionResults": {},
        }

    def get(self, options, origin=None, credential_id=None):
        client_data = self._client_data("webauthn.get", options, origin)
        auth_data = self._auth_data()
        signature = self.key.sign(auth_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256()))
        identifier = credential_id or self.credential_id
        return {
            "id": b64url(identifier),
            "rawId": b64url(identifier),
            "type": "public-key",
            "response": {
                "clientDataJSON": b64url(client_data),
                "authenticatorData": b64url(auth_data),
                "signature": b64url(signature),
                "userHandle": None,
            },
            "clientExtensionResults": {},
        }


class PasskeySettingsTests(unittest.TestCase):
    base = dict(
        enabled=True,
        hosted=True,
        environment="production",
        database_url="postgresql+psycopg://user:pw@db.example/krishyak?sslmode=require",
        auth_secret="synthetic-test-secret-" * 3,
        origins=["https://krishyak.example"],
        redis_url="rediss://default:pw@redis.example:6379",
        storage_provider="vercel_blob",
        blob_token="vercel_blob_rw_STOREID_synthetic",
        worker_mode="request",
        cron_secret=SECRET,
    )

    def test_deployment_accepts_passkeys_blob_and_request_worker(self):
        settings = Settings(**self.base)
        self.assertTrue(settings.deployed)
        self.assertEqual(settings.otp_provider, "disabled")

    def test_deployment_requires_a_real_sign_in_method_and_safe_worker_trigger(self):
        for change in [
            {"passkey_enabled": False},
            {"cron_secret": "short"},
            {"blob_token": "not-a-store-token"},
            {"redis_url": "redis://plaintext:6379"},
            {"otp_provider": "development", "dev_mobiles": ["+919000000001"]},
        ]:
            with self.subTest(change=change), self.assertRaises(ValidationError):
                Settings(**(self.base | change))

    def test_hosted_vercel_defaults_to_request_worker_mode(self):
        with patch.dict(os.environ, {"VERCEL": "1", "KRISHYAK_V2_ENABLED": "false"}, clear=False):
            self.assertEqual(Settings.from_env().worker_mode, "request")


class VercelBlobProtocolTests(unittest.TestCase):
    def test_private_put_get_delete_use_store_token_and_never_public_access(self):
        calls = []

        def handler(request):
            calls.append(request)
            if request.method == "PUT":
                return httpx.Response(200, json={"url": "https://storeid.private.blob.vercel-storage.com/a/b.jpg"})
            if request.method == "GET":
                return httpx.Response(200, content=b"jpeg-bytes")
            return httpx.Response(200)

        transport = httpx.MockTransport(handler)
        original = httpx.Client

        def client(*args, **kwargs):
            kwargs["transport"] = transport
            return original(*args, **kwargs)

        storage = VercelBlobStorage(Settings(blob_token="vercel_blob_rw_StoreID_synthetic"))
        with patch("v2.providers.httpx.Client", side_effect=client):
            storage.put("images/farmer/scan.jpg", b"jpeg-bytes")
            self.assertEqual(storage.get("images/farmer/scan.jpg"), b"jpeg-bytes")
            storage.delete("images/farmer/scan.jpg")
        put, get, remove = calls
        self.assertEqual(put.headers["x-vercel-blob-access"], "private")
        self.assertEqual(put.headers["x-allow-overwrite"], "0")
        self.assertEqual(put.url.params["pathname"], "images/farmer/scan.jpg")
        self.assertEqual(get.url.host, "storeid.private.blob.vercel-storage.com")
        for call in calls:
            self.assertEqual(call.headers["authorization"], "Bearer vercel_blob_rw_StoreID_synthetic")
        self.assertEqual(json.loads(remove.content)["urls"], [str(get.url.copy_with(query=None))])
        with self.assertRaises(ValueError):
            storage._url("../escape")


@unittest.skipUnless(os.getenv("V2_TEST_DATABASE_URL"), "Dedicated disposable PostGIS test URL required")
class PasskeyIntegrationTests(unittest.TestCase):
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
            origins=[ORIGIN, "http://127.0.0.1:3000"],
            worker_mode="request",
            cron_secret=SECRET,
        )
        cls.app = FastAPI()
        install_v2(cls.app, cls.settings)
        cls.factory = cls.app.state.v2_database

    def setUp(self):
        self.images = TemporaryDirectory(prefix="krishyak-passkey-test-")
        self.app.state.v2_settings.storage_root = Path(self.images.name)
        with self.factory.begin() as db:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(delete(table))
        self.app.state.v2_quotas.local.clear()
        self.client = TestClient(self.app)
        self.client.headers["Origin"] = ORIGIN

    def tearDown(self):
        self.client.close()
        self.images.cleanup()

    def register(self, client=None, authenticator=None, **extra):
        client = client or self.client
        authenticator = authenticator or SoftAuthenticator()
        body = {"display_name": "Ramesh Patel", "accept_policy_version": "2026-10-03"} | extra
        options = client.post("/api/v2/auth/passkey/register/options", json=body)
        self.assertEqual(options.status_code, 200, options.text)
        payload = options.json()
        self.assertEqual(payload["options"]["rp"]["id"], "localhost")
        self.assertEqual(payload["options"]["authenticatorSelection"]["residentKey"], "required")
        result = client.post(
            "/api/v2/auth/passkey/register/verify",
            json={"challenge_id": payload["challenge_id"], "credential": authenticator.create(payload["options"])},
        )
        self.assertEqual(result.status_code, 200, result.text)
        client.headers["X-CSRF-Token"] = result.json()["csrf_token"]
        return authenticator, result.json()

    def sign_in(self, client, authenticator, **kwargs):
        options = client.post("/api/v2/auth/passkey/login/options", json={})
        self.assertEqual(options.status_code, 200, options.text)
        payload = options.json()
        return client.post(
            "/api/v2/auth/passkey/login/verify",
            json={
                "challenge_id": payload["challenge_id"],
                "credential": authenticator.get(payload["options"], **kwargs),
            },
        )

    def test_status_advertises_passkeys_without_sms(self):
        status = self.client.get("/api/v2/status").json()
        self.assertTrue(status["passkey_available"])
        self.assertFalse(status["otp_available"])

    def test_sign_up_creates_account_with_unverified_contact_and_recovery_code(self):
        authenticator, result = self.register(contact_mobile="98765 43210", preferred_language="hi")
        farmer = result["farmer"]
        self.assertIsNone(farmer["mobile"])
        self.assertEqual(farmer["contact_mobile"], "+919876543210")
        self.assertEqual(farmer["preferred_language"], "hi")
        self.assertRegex(result["recovery_code"], r"^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$")
        self.assertEqual(self.client.get("/api/v2/me").status_code, 200)
        devices = self.client.get("/api/v2/me/passkeys").json()
        self.assertEqual(len(devices["items"]), 1)
        self.assertTrue(devices["recovery_code_active"])
        self.assertFalse(devices["verified_mobile"])
        with self.factory() as db:
            stored = db.scalar(select(RecoveryCode))
            self.assertNotIn(result["recovery_code"], stored.code_hash)
        # An unverified contact number is not an identity: another farmer may enter it.
        other = TestClient(self.app)
        other.headers["Origin"] = ORIGIN
        self.register(other, contact_mobile="9876543210")
        other.close()

    def test_sign_in_with_passkey_and_counter_replay_is_rejected(self):
        authenticator, _ = self.register()
        fresh = TestClient(self.app)
        fresh.headers["Origin"] = ORIGIN
        response = self.sign_in(fresh, authenticator)
        self.assertEqual(response.status_code, 200, response.text)
        fresh.headers["X-CSRF-Token"] = response.json()["csrf_token"]
        self.assertEqual(fresh.get("/api/v2/me").json()["farmer"]["display_name"], "Ramesh Patel")
        authenticator.count -= 1  # a cloned authenticator replays an old counter
        self.assertEqual(self.sign_in(fresh, authenticator).status_code, 400)
        fresh.close()

    def test_wrong_origin_unknown_credential_and_challenge_reuse_fail(self):
        authenticator, _ = self.register()
        evil = TestClient(self.app)
        evil.headers["Origin"] = "https://attacker.example"
        self.assertEqual(evil.post("/api/v2/auth/passkey/login/options", json={}).status_code, 403)
        evil.close()
        self.assertEqual(self.sign_in(self.client, authenticator, origin="http://127.0.0.1:3000").status_code, 400)
        self.assertEqual(self.sign_in(self.client, authenticator, credential_id=os.urandom(32)).status_code, 400)
        options = self.client.post("/api/v2/auth/passkey/login/options", json={}).json()
        body = {"challenge_id": options["challenge_id"], "credential": authenticator.get(options["options"])}
        self.assertEqual(self.client.post("/api/v2/auth/passkey/login/verify", json=body).status_code, 200)
        self.assertEqual(self.client.post("/api/v2/auth/passkey/login/verify", json=body).status_code, 400)

    def test_recovery_code_is_single_use_and_rotates(self):
        _, result = self.register()
        fresh = TestClient(self.app)
        fresh.headers["Origin"] = ORIGIN
        spaced = result["recovery_code"].replace("-", " ").lower()
        recovered = fresh.post("/api/v2/auth/recovery", json={"code": spaced})
        self.assertEqual(recovered.status_code, 200, recovered.text)
        self.assertNotEqual(recovered.json()["recovery_code"], result["recovery_code"])
        self.assertEqual(fresh.post("/api/v2/auth/recovery", json={"code": result["recovery_code"]}).status_code, 400)
        fresh.close()

    def test_add_second_device_and_cannot_remove_last_sign_in_method(self):
        _, _ = self.register()
        second = SoftAuthenticator()
        options = self.client.post("/api/v2/me/passkeys/options", json={})
        self.assertEqual(options.status_code, 200, options.text)
        self.assertEqual(len(options.json()["options"]["excludeCredentials"]), 1)
        added = self.client.post(
            "/api/v2/me/passkeys/verify",
            json={
                "challenge_id": options.json()["challenge_id"],
                "credential": second.create(options.json()["options"]),
                "device_label": "Son's phone",
            },
        )
        self.assertEqual(added.status_code, 200, added.text)
        items = added.json()["items"]
        self.assertEqual([x["device_label"] for x in items], ["This phone", "Son's phone"])
        self.assertEqual(self.client.delete(f"/api/v2/me/passkeys/{items[0]['id']}").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/v2/me/passkeys/{items[1]['id']}").status_code, 422)

    def test_account_deletion_removes_passkeys(self):
        self.register()
        self.assertEqual(self.client.delete("/api/v2/me").status_code, 200)
        with self.factory() as db:
            self.assertIsNone(db.scalar(select(Passkey.id)))
            self.assertIsNone(db.scalar(select(Farmer.id)))

    def test_scheduled_trigger_requires_cron_secret_and_drains_queue(self):
        self.assertEqual(self.client.get("/api/v2/internal/worker").status_code, 404)
        wrong = {"Authorization": "Bearer " + "x" * 48}
        self.assertEqual(self.client.get("/api/v2/internal/worker", headers=wrong).status_code, 404)
        with patch("v2.worker.run_once", return_value=False), patch("remote_sensing.router.get_service", Mock()):
            ok = self.client.get("/api/v2/internal/worker", headers={"Authorization": f"Bearer {SECRET}"})
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual(ok.json()["jobs_processed"], 0)

    def test_unmapped_field_with_location_gets_weather_and_location_is_rounded(self):
        self.register()
        for purpose in ("location_processing", "agronomic_analysis"):
            granted = self.client.post(
                "/api/v2/consents", json={"purpose": purpose, "granted": True, "policy_version": "2026-10-03"}
            )
            self.assertEqual(granted.status_code, 200, granted.text)
        farm = self.client.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Synthetic"})
        body = {
            "operation_id": str(uuid4()),
            "farm_id": farm.json()["id"],
            "name": "Well field",
            "entered_area_hectares": 0.8,
            "approximate_location": {"latitude": 26.91234, "longitude": 75.78765},
        }
        plot = self.client.post("/api/v2/plots", json=body)
        self.assertEqual(plot.status_code, 201, plot.text)
        self.assertEqual(plot.json()["approximate_location"], {"latitude": 26.91, "longitude": 75.79})
        self.assertIsNone(plot.json()["centroid"])
        self.assertEqual(self.client.post("/api/v2/plots", json=body).status_code, 201)
        outside = body | {"operation_id": str(uuid4()), "approximate_location": {"latitude": 51.5, "longitude": 0.1}}
        self.assertEqual(self.client.post("/api/v2/plots", json=outside).status_code, 422)
        captured = {}

        async def weather(lat, lon):
            captured.update(lat=lat, lon=lon)
            raise RuntimeError("provider stub reached")

        with patch("v2.context.fetch_weather", side_effect=weather), self.assertRaises(RuntimeError):
            self.client.post(f"/api/v2/plots/{plot.json()['id']}/weather/refresh", json={"operation_id": str(uuid4())})
        self.assertEqual(captured, {"lat": 26.91, "lon": 75.79})

    def test_http_migration_is_hidden_unless_enabled_and_authorized(self):
        auth = {"Authorization": f"Bearer {SECRET}"}
        self.assertEqual(self.client.post("/api/v2/internal/migrate", headers=auth).status_code, 404)
        with patch.dict(
            os.environ,
            {"V2_HTTP_MIGRATIONS": "true", "V2_MIGRATION_DATABASE_URL": os.environ["V2_TEST_DATABASE_URL"]},
        ):
            self.assertEqual(self.client.post("/api/v2/internal/migrate").status_code, 404)
            done = self.client.post("/api/v2/internal/migrate", headers=auth)
        self.assertEqual(done.status_code, 200, done.text)
        self.assertEqual(done.json()["schema"], done.json()["head"])

    def test_request_mode_readiness_fails_when_queue_is_stranded(self):
        from datetime import timedelta

        from db.models import utcnow

        self.register()
        farm = self.client.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Synthetic"})
        self.assertEqual(farm.status_code, 201, farm.text)
        plot = self.client.post(
            "/api/v2/plots",
            json={
                "operation_id": str(uuid4()),
                "farm_id": farm.json()["id"],
                "name": "North field",
                "entered_area_hectares": 0.4,
            },
        )
        self.assertEqual(plot.status_code, 201, plot.text)
        settings = self.app.state.v2_settings
        with patch.object(settings, "hosted", True):
            self.assertEqual(self.client.get("/health/ready").status_code, 200)
            self.assertEqual(self.client.get("/health/ready").json()["worker"], "request")
            with self.factory.begin() as db:
                db.add(
                    Job(
                        plot_id=plot.json()["id"],
                        operation_id=uuid4(),
                        kind="satellite",
                        payload={},
                        available_at=utcnow() - timedelta(hours=2),
                    )
                )
            self.assertEqual(self.client.get("/health/ready").status_code, 503)


if __name__ == "__main__":
    unittest.main()


class ProviderUrlTests(unittest.TestCase):
    def test_neon_and_upstash_standard_variables_are_accepted(self):
        env = {
            "DATABASE_URL": "postgresql://user:pw@ep-x-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
            "DATABASE_URL_UNPOOLED": "postgres://user:pw@ep-x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
            "KV_URL": "rediss://default:pw@x.upstash.io:6379",
            "V2_DATABASE_URL": "",
            "V2_MIGRATION_DATABASE_URL": "",
            "V2_REDIS_URL": "",
        }
        with patch.dict(os.environ, env):
            from v2.settings import migration_url_from_env

            settings = Settings.from_env()
            self.assertTrue(settings.database_url.get_secret_value().startswith("postgresql+psycopg://"))
            self.assertIn("-pooler.", settings.database_url.get_secret_value())
            self.assertEqual(settings.redis_url.get_secret_value(), env["KV_URL"])
            self.assertTrue(migration_url_from_env().startswith("postgresql+psycopg://user:pw@ep-x.ap-"))

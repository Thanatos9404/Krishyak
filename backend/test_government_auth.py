"""Synthetic signing fixtures. No live identity, document or government call."""

import json
import logging
import time
import unittest
from unittest.mock import Mock
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from v2.access_logging import OAuthAccessRedactor
from v2.government_auth import CALLBACK, REVOKE, TOKEN, Configuration, MeriPehchaanAdapter
from v2.limits import Quotas
from v2.settings import Settings


class GovernmentAuthContracts(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.public = (
            cls.private.public_key()
            .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
            .decode()
        )

    def setUp(self):
        self.settings = Settings(
            enabled=True,
            database_url="postgresql+psycopg://fixture/fixture",
            auth_secret="synthetic-test-secret-" * 3,
            origins=["https://app.example.test"],
        )
        self.config = Configuration(
            enabled=True,
            approved=True,
            client_id="fixture",
            client_secret="private-test-secret",
            redirect_uri="https://app.example.test" + CALLBACK,
            issuer="https://issuer.example.test",
            public_key_pem=self.public,
        )
        self.quota = Quotas(self.settings)
        self.quota.redis = Mock()
        self.adapter = MeriPehchaanAdapter(self.settings, self.quota, self.config)

    def test_disabled_or_unapproved_login_cannot_start(self):
        for change in (
            {"enabled": False},
            {"approved": False},
            {"client_secret": ""},
            {"redirect_uri": "https://evil.test" + CALLBACK},
            {"redirect_uri": "https://app.example.test" + CALLBACK + "?next=https://evil.test"},
        ):
            adapter = MeriPehchaanAdapter(self.settings, self.quota, self.config.model_copy(update=change))
            if "client_secret" in change:
                adapter.config = Configuration(**(self.config.model_dump() | change))
            with self.subTest(change=change):
                self.assertFalse(adapter.available())
                with self.assertRaises(HTTPException):
                    adapter.begin("browser", None, "login")

    def test_state_is_single_use_browser_bound_and_pkce_has_no_identity(self):
        url = self.adapter.begin("browser-fixture", None, "login")
        parsed = urlsplit(url)
        params = parse_qs(parsed.query)
        self.assertEqual(parsed.hostname, "digilocker.meripehchaan.gov.in")
        self.assertEqual(params["scope"], ["openid"])
        self.assertEqual(params["code_challenge_method"], ["S256"])
        self.assertNotIn("client_secret", params)
        self.assertNotIn("verified_mobile", params)
        record = json.loads(self.quota.redis.set.call_args.args[1])
        self.assertGreaterEqual(len(record["verifier"]), 43)
        self.assertNotIn("browser-fixture", self.quota.redis.set.call_args.args[1])
        self.quota.redis.getdel.return_value = json.dumps(record)
        result = self.adapter.consume(params["state"][0], "browser-fixture")
        self.assertEqual(result["nonce"], params["nonce"][0])
        self.quota.redis.getdel.return_value = None
        with self.assertRaises(HTTPException):
            self.adapter.consume(params["state"][0], "browser-fixture")
        self.quota.redis.getdel.return_value = json.dumps(record)
        with self.assertRaises(HTTPException):
            self.adapter.consume(params["state"][0], "other-browser")

    async def test_verified_signature_issuer_audience_expiry_nonce_and_token_discard(self):
        seen = []
        issued = int(time.time())
        record = {"nonce": "fixture-nonce", "verifier": "fixture-verifier"}
        claims = {
            "iss": self.config.issuer,
            "sub": "fixture-subject",
            "aud": "fixture",
            "iat": issued,
            "exp": issued + 60,
            "nonce": "fixture-nonce",
        }
        signed = [jwt.encode(claims, self.private, algorithm="RS256")]

        async def provider(request):
            seen.append(request)
            if str(request.url) == REVOKE:
                return httpx.Response(200)
            self.assertEqual(str(request.url), TOKEN)
            return httpx.Response(
                200,
                json={
                    "access_token": "private-fixture-token",
                    "token_type": "Bearer",
                    "scope": "openid",
                    "expires_in": 60,
                    "id_token": signed[0],
                },
            )

        self.adapter.client_factory = lambda **kwargs: httpx.AsyncClient(
            transport=httpx.MockTransport(provider), **kwargs
        )
        digest = await self.adapter.exchange("private-code", record)
        self.assertEqual(len(digest), 64)
        self.assertNotIn("fixture-subject", digest)
        self.assertEqual(len(seen), 2)
        for change in (
            {"nonce": "wrong"},
            {"aud": "wrong"},
            {"iss": "https://evil.test"},
            {"exp": issued - 1},
            {"iat": issued + 1000},
        ):
            signed[0] = jwt.encode(claims | change, self.private, algorithm="RS256")
            with self.subTest(change=change), self.assertRaises(HTTPException) as error:
                await self.adapter.exchange("private-code", record)
            self.assertNotIn("private-code", error.exception.detail)
            self.assertEqual(str(seen[-1].url), REVOKE)
        signed[0] = jwt.encode(claims, "fixture-shared-secret-"*3, algorithm="HS256")
        with self.assertRaises(HTTPException):
            await self.adapter.exchange("private-code", record)

    def test_access_log_redacts_only_callback_parameters(self):
        record = logging.LogRecord(
            "uvicorn.access",
            20,
            "fixture",
            1,
            '%s - "%s %s HTTP/%s" %d',
            ("127.0.0.1", "GET", CALLBACK + "?code=private-code&state=private-state", "1.1", 303),
            None,
        )
        OAuthAccessRedactor().filter(record)
        self.assertNotIn("private-code", record.getMessage())
        self.assertNotIn("private-state", record.getMessage())
        self.assertIn(CALLBACK, record.getMessage())

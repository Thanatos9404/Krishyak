"""Provider credentials are protected by shared, fail-closed usage budgets."""

import os
import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from remote_sensing.providers.base import ProviderError
from v2.limits import Quotas
from v2.settings import Settings
from v2.usage import public_budget, satellite_budget


def quotas():
    return Quotas(Settings(auth_secret="synthetic-test-secret-" * 3))


class SatelliteBudgetTests(unittest.TestCase):
    def test_costs_are_charged_per_operation_and_caps_apply_globally(self):
        with patch.dict(os.environ, {"REMOTE_SENSING_IP_PER_MINUTE": "100", "REMOTE_SENSING_GLOBAL_PER_MONTH": "5"}):
            check = satellite_budget(quotas())
        check("preview", "owner:a")  # 2 requests
        check("acquisitions", "owner:b")  # 3 requests: monthly total 5
        with self.assertRaises(ProviderError) as raised:
            check("timeseries", "owner:c")  # a different caller still hits the global cap
        self.assertEqual((raised.exception.status, raised.exception.code), (429, "local_quota"))

    def test_per_caller_minute_limit(self):
        check = satellite_budget(quotas())
        for _ in range(6):
            check("timeseries", "owner:a")
        with self.assertRaises(ProviderError):
            check("timeseries", "owner:a")
        check("timeseries", "owner:b")

    def test_shared_store_outage_fails_closed(self):
        store = quotas()
        store.redis = Mock()
        store.redis.eval.side_effect = ConnectionError("down")
        with self.assertRaises(ProviderError) as raised:
            satellite_budget(store)("timeseries", "owner:a")
        self.assertEqual(raised.exception.status, 503)


class PublicBudgetTests(unittest.TestCase):
    def test_open_meteo_global_cap_spans_callers(self):
        store = quotas()
        with patch.dict(os.environ, {"OPEN_METEO_PUBLIC_PER_DAY": "2"}):
            public_budget(store, "/weather/current", "1.1.1.1")
            public_budget(store, "/weather/forecast", "2.2.2.2")
            with self.assertRaises(HTTPException) as raised:
                public_budget(store, "/weather/current", "3.3.3.3")
        self.assertEqual(raised.exception.status_code, 429)
        public_budget(store, "/crops", "3.3.3.3")

    def test_compute_heavy_routes_have_a_tighter_per_caller_limit(self):
        store = quotas()
        for _ in range(10):
            public_budget(store, "/detect_disease", "1.1.1.1")
        with self.assertRaises(HTTPException):
            public_budget(store, "/detect_disease", "1.1.1.1")


class PublicSatelliteRouteTests(unittest.TestCase):
    def test_deployed_satellite_routes_require_an_account_before_any_provider_call(self):
        from remote_sensing.router import get_service, router

        app = FastAPI()
        app.include_router(router)
        app.state.v2_settings = Settings(hosted=True, environment="production")
        app.state.v2_database = None
        provider_call = Mock()
        with patch.object(get_service(), "execute", provider_call), TestClient(app) as client:
            response = client.post(
                "/remote-sensing/timeseries",
                json={
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[75.8, 26.9], [75.801, 26.9], [75.801, 26.901], [75.8, 26.9]]],
                    },
                    "start_date": "2026-08-01",
                    "end_date": "2026-09-01",
                },
            )
        self.assertEqual(response.status_code, 401, response.text)
        provider_call.assert_not_called()


if __name__ == "__main__":
    unittest.main()


class ProxiedClientTests(unittest.TestCase):
    def request(self, header=None):
        from starlette.requests import Request

        headers = [(b"x-krishyak-client", header.encode())] if header else []
        return Request({"type": "http", "headers": headers, "client": ("10.0.0.1", 1)})

    def signed(self, secret, address, stamp):
        import hashlib
        import hmac

        value = f"{address}|{stamp}"
        return f"{value}|{hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()}"

    def test_only_a_fresh_correctly_signed_address_is_trusted(self):
        import time

        from security import client_ip

        secret = "s" * 40
        now = int(time.time())
        with patch.dict(os.environ, {"KRISHYAK_PROXY_SECRET": secret, "VERCEL": "0"}):
            self.assertEqual(client_ip(self.request(self.signed(secret, "2401:4900::1", now))), "2401:4900::1")
            self.assertEqual(client_ip(self.request(self.signed("x" * 40, "1.2.3.4", now))), "10.0.0.1")
            self.assertEqual(client_ip(self.request(self.signed(secret, "1.2.3.4", now - 600))), "10.0.0.1")
            self.assertEqual(client_ip(self.request("1.2.3.4|garbage")), "10.0.0.1")
        with patch.dict(os.environ, {"KRISHYAK_PROXY_SECRET": "", "VERCEL": "0"}):
            self.assertEqual(client_ip(self.request(self.signed("", "1.2.3.4", now))), "10.0.0.1")

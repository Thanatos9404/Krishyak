"""Mandi price trends are computed only from stored, dated, same-series quotes."""

import os
import unittest
from datetime import timedelta
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import delete, func, select

from db.models import Base, MarketPrice
from v2.application import install_v2
from v2.farm_context.models import india_today
from v2.farm_context.transport import Unavailable
from v2.market import CURRENT, HISTORY, change, normalize
from v2.settings import Settings

ORIGIN = "http://localhost:3000"


def day(offset):
    return india_today() - timedelta(days=offset)


def current_row(offset, price, market="Jaipur (F&V)", variety="Other"):
    return {
        "state": "Rajasthan",
        "district": "Jaipur",
        "market": market,
        "commodity": "Wheat",
        "variety": variety,
        "grade": "FAQ",
        "arrival_date": day(offset).strftime("%d/%m/%Y"),
        "min_price": str(price - 100),
        "max_price": str(price + 100),
        "modal_price": str(price),
    }


def history_row(offset, price, market="Jaipur (F&V)"):
    return {
        "State": "Rajasthan",
        "District": "Jaipur",
        "Market": market,
        "Commodity": "Wheat",
        "Variety": "Other",
        "Grade": "FAQ",
        "Arrival_Date": day(offset).strftime("%d/%m/%Y"),
        "Min_x0020_Price": price - 100,
        "Max_x0020_Price": price + 100,
        "Modal_x0020_Price": price,
    }


class NormalizationTests(unittest.TestCase):
    def test_both_resource_field_styles_are_accepted_and_scoped(self):
        rows = normalize(
            {
                "records": [
                    history_row(1, 2450),
                    current_row(0, 2500),
                    current_row(0, 2600) | {"district": "Kota"},
                    current_row(40, 2000),  # outside the trend window
                    current_row(0, 2500) | {"commodity": "Mustard"},
                    current_row(-2, 2500),  # future date
                    current_row(0, 0),
                ]
            },
            "Rajasthan",
            "Jaipur",
            "Wheat",
            CURRENT,
        )
        self.assertEqual(sorted(x["modal_price"] for x in rows), [2450.0, 2500.0])

    def test_conflicting_same_day_quotes_are_dropped_not_averaged(self):
        rows = normalize(
            {"records": [current_row(0, 2500), current_row(0, 2700)]}, "Rajasthan", "Jaipur", "Wheat", CURRENT
        )
        self.assertEqual(rows, [])

    def test_malformed_payload_is_unavailable(self):
        with self.assertRaises(Unavailable):
            normalize({"records": "nope"}, "Rajasthan", None, "Wheat", CURRENT)

    def test_change_needs_a_comparable_dated_quote(self):
        latest = (day(0), 2600.0)
        self.assertIsNone(change([(day(1), 2500.0), latest], latest, 7))
        result = change([(day(7), 2400.0), (day(1), 2500.0), latest], latest, 7)
        self.assertEqual((result["percent"], result["direction"]), (8.3, "up"))
        steady = change([(day(6), 2590.0), latest], latest, 7)
        self.assertEqual(steady["direction"], "steady")


@unittest.skipUnless(os.getenv("V2_TEST_DATABASE_URL"), "Dedicated disposable PostGIS test URL required")
class MarketEndpointTests(unittest.TestCase):
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
            ),
        )
        cls.factory = cls.app.state.v2_database

    def setUp(self):
        with self.factory.begin() as db:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(delete(table))
        self.app.state.v2_quotas.local.clear()
        self.service = self.app.state.v2_farm_context
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()

    def respond(self, current, history):
        async def read(provider, params):
            value = {"ogd": current, "ogd_history": history}[provider]
            if isinstance(value, Exception):
                raise value
            self.assertEqual(params["api-key"], "synthetic-ogd-key")
            return value

        return patch.object(self.service.gateway, "read", side_effect=read)

    def test_trend_from_history_is_persisted_and_served_with_sources(self):
        history = {"records": [history_row(n, 2400 + (7 - n) * 10) for n in range(1, 8)]}
        with (
            patch.object(self.service.settings, "ogd_key", SecretStr("synthetic-ogd-key")),
            self.respond({"records": [current_row(0, 2600)]}, history) as read,
        ):
            first = self.client.get(
                "/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"}
            )
            self.assertEqual(first.status_code, 200, first.text)
            body = first.json()
            self.assertEqual((body["status"], body["unit"], body["scope"]), ("available", "INR/quintal", "district"))
            market = body["markets"][0]
            self.assertEqual(market["latest"]["modal_price"], 2600.0)
            self.assertEqual(market["change_7d"]["from_price"], 2400.0)
            self.assertEqual(market["change_7d"]["direction"], "up")
            self.assertEqual(len(market["series"]), 8)
            # A fresh scope is served from storage without calling the provider again.
            again = self.client.get(
                "/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"}
            )
            self.assertEqual(again.json()["providers"], {"current": "cached", "history": "cached"})
            self.assertEqual(read.call_count, 2)
        with self.factory() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(MarketPrice)), 8)
            sources = set(db.scalars(select(MarketPrice.source_resource)).all())
            self.assertEqual(sources, {CURRENT, HISTORY})

    def test_provider_outage_serves_stored_quotes_as_stale(self):
        with (
            patch.object(self.service.settings, "ogd_key", SecretStr("synthetic-ogd-key")),
            self.respond({"records": [current_row(2, 2500)]}, Unavailable()),
        ):
            self.client.get(
                "/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"}
            )
        with self.factory.begin() as db:
            from db.models import MarketFetch

            db.execute(delete(MarketFetch))
        with (
            patch.object(self.service.settings, "ogd_key", SecretStr("synthetic-ogd-key")),
            self.respond(Unavailable(), Unavailable()),
        ):
            stale = self.client.get(
                "/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"}
            )
        body = stale.json()
        self.assertEqual(body["status"], "stale")
        self.assertEqual(body["markets"][0]["latest"]["age_days"], 2)
        self.assertIsNone(body["markets"][0]["change_7d"])

    def test_without_key_or_data_reports_not_configured_and_rejects_unknown_crop(self):
        with patch.object(self.service.settings, "ogd_key", SecretStr("")):
            response = self.client.get("/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan"})
        self.assertEqual(response.json()["status"], "not_configured")
        self.assertEqual(response.json()["markets"], [])
        bad = self.client.get("/api/v2/market/prices", params={"crop": "unobtainium", "state": "Rajasthan"})
        self.assertEqual(bad.status_code, 422)


if __name__ == "__main__":
    unittest.main()

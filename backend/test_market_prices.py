"""Mandi price trends are computed only from stored, dated, same-series quotes."""

import os
import unittest
from datetime import timedelta
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import delete, func, select

from db.models import Base, CropCycle, Farm, Farmer, MarketFetch, MarketPrice, Plot, utcnow
from v2 import national_prices
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


def national_payload(offset=1, wheat=(2818.46, 2799.92, 2791.74), extra=()):
    """The table the Agmarknet 2.0 home page reads: one row per commodity, three reporting days."""

    def record(name, prices):
        return {
            "cmdt_name": name,
            "cmdt_grp_name": "Cereals",
            "msp_price": "2585.00",
            "reported_date": day(offset).strftime("%d-%m-%Y"),
            "as_on_price": str(prices[0]),
            "one_day_ago_price": str(prices[1]),
            "two_day_ago_price": str(prices[2]),
            "as_on_arrival": "29467.77",
            "trend": "up",
        }

    records = [record("Wheat", wheat), record("Maize", (2753.73, 2762.91, 2769.35)), *extra]
    return {"status": "success", "data": {"columns": [], "records": records}}


class NationalAverageTests(unittest.TestCase):
    def test_the_dashboard_table_becomes_dated_all_india_rows(self):
        rows = national_prices.parse(
            national_payload(
                extra=[{"cmdt_name": "Copra", "reported_date": day(1).strftime("%d-%m-%Y"), "as_on_price": "26057"}]
            ),
            india_today(),
        )
        wheat = sorted((r["arrival_date"], r["modal_price"]) for r in rows if r["commodity"] == "Wheat")
        self.assertEqual(wheat, [(day(3), 2791.74), (day(2), 2799.92), (day(1), 2818.46)])
        self.assertEqual(
            {r["commodity"] for r in rows}, {"Wheat", "Maize"}
        )  # crops the app does not cover are left out
        self.assertTrue(all((r["state"], r["market"]) == ("India", "All-India average") for r in rows))

    def test_odd_tables_are_refused_rather_than_repaired(self):
        today = india_today()
        for payload in (None, {}, {"data": {"records": "no"}}, {"data": {"records": []}}):
            with self.subTest(payload=payload), self.assertRaises(Unavailable):
                national_prices.parse(payload, today)
        old = national_payload(offset=12)
        future = national_payload(offset=-1)
        nonsense = national_payload(wheat=("NA", "-5", "abc"))
        for payload in (old, future):
            with self.subTest("date"), self.assertRaises(Unavailable):
                national_prices.parse(payload, today)
        self.assertEqual({r["commodity"] for r in national_prices.parse(nonsense, today)}, {"Maize"})

    def test_a_local_quote_leads_only_when_it_is_as_recent_as_the_national_one(self):
        national = {"date": day(1).isoformat()}
        fresh = [{"latest": {"date": day(1).isoformat()}}]
        older = [{"latest": {"date": day(4).isoformat()}}]
        self.assertEqual(national_prices.lead(fresh, national), "local")
        self.assertEqual(national_prices.lead(older, national), "national")
        self.assertEqual(national_prices.lead([], national), "national")
        self.assertEqual(national_prices.lead(older, None), "local")
        self.assertEqual(national_prices.lead([], None), "none")


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
                cron_secret="synthetic-cron-secret-" * 2,
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

    def respond(self, current, history, national=None):
        async def read(provider, params, **options):
            if provider == "agmarknet_national":
                self.assertEqual(params["dashboard"], "marketwise_price_arrival")
                if national is None or isinstance(national, Exception):
                    raise national or Unavailable()
                return national
            value = {"ogd": current, "ogd_history": history}[provider]
            if isinstance(value, Exception):
                raise value
            self.assertEqual(params["api-key"], "synthetic-ogd-key")
            return value

        return patch.object(self.service.gateway, "read", side_effect=read)

    def calls(self, read, provider):
        return sum(1 for call in read.call_args_list if call.args[0] == provider)

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
            self.assertEqual(again.json()["providers"]["current"], "cached")
            self.assertEqual(again.json()["providers"]["history"], "cached")
            self.assertEqual(self.calls(read, "ogd") + self.calls(read, "ogd_history"), 2)
            # With no national figure the local quote leads and nothing national is claimed.
            self.assertEqual((body["lead"], body["national"]), ("local", None))
            # A failed national read is not repeated on the next request.
            self.assertEqual(self.calls(read, "agmarknet_national"), 1)
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

    def test_when_the_mandi_feed_is_down_the_all_india_average_is_shown_first(self):
        params = {"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"}
        with (
            patch.object(self.service.settings, "ogd_key", SecretStr("synthetic-ogd-key")),
            self.respond(Unavailable(), Unavailable(), national_payload()) as read,
        ):
            body = self.client.get("/api/v2/market/prices", params=params).json()
            self.assertEqual((body["status"], body["markets"], body["lead"]), ("unavailable", [], "national"))
            national = body["national"]
            self.assertEqual(
                (national["per_quintal"], national["date"], national["age_days"]), (2818.46, day(1).isoformat(), 1)
            )
            self.assertEqual(national["change"]["from_price"], 2799.92)
            self.assertEqual(national["change"]["direction"], "steady")
            self.assertEqual(len(national["series"]), 3)
            self.assertIn("Agmarknet 2.0", body["sources"][-1]["name"])
            self.assertIn("all-India average", body["limitations"][-1])
            # The stored national table serves the next request without another call.
            again = self.client.get("/api/v2/market/prices", params=params).json()
            self.assertEqual(again["providers"]["national"], "cached")
            self.assertEqual(self.calls(read, "agmarknet_national"), 1)
        # A crop the national table does not cover claims no national price.
        with patch.object(self.service.settings, "ogd_key", SecretStr("")):
            apple = self.client.get("/api/v2/market/prices", params={"crop": "apple", "state": "Rajasthan"}).json()
        self.assertEqual((apple["national"], apple["lead"]), (None, "none"))

    def test_an_older_local_quote_gives_way_and_a_fresh_one_leads(self):
        params = {"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"}
        with (
            patch.object(self.service.settings, "ogd_key", SecretStr("synthetic-ogd-key")),
            self.respond({"records": [current_row(4, 2500)]}, Unavailable(), national_payload()),
        ):
            older = self.client.get("/api/v2/market/prices", params=params).json()
        self.assertEqual((older["lead"], older["markets"][0]["latest"]["age_days"]), ("national", 4))
        with self.factory.begin() as db:
            db.execute(delete(MarketFetch))
        with (
            patch.object(self.service.settings, "ogd_key", SecretStr("synthetic-ogd-key")),
            self.respond({"records": [current_row(0, 2650)]}, Unavailable(), national_payload()),
        ):
            fresh = self.client.get("/api/v2/market/prices", params=params).json()
        self.assertEqual((fresh["lead"], fresh["markets"][0]["latest"]["modal_price"]), ("local", 2650.0))
        self.assertEqual(fresh["national"]["per_quintal"], 2818.46)

    def test_the_nightly_job_stores_prices_for_the_crops_farmers_grow(self):
        with self.factory.begin() as db:
            farmer = Farmer(display_name="Asha", state="Rajasthan", district="Jaipur")
            db.add(farmer)
            db.flush()
            farm = Farm(farmer_id=farmer.id, operation_id=farmer.id, name="Farm")
            db.add(farm)
            db.flush()
            plot = Plot(farm_id=farm.id, operation_id=farm.id, name="Field")
            db.add(plot)
            db.flush()
            db.add(
                CropCycle(
                    plot_id=plot.id,
                    operation_id=plot.id,
                    crop="Wheat",
                    crop_id="wheat",
                    sowing_date=day(30),
                    expected_harvest=day(-100),
                    status="active",
                )
            )
        self.assertEqual(self.client.get("/api/v2/internal/prices").status_code, 404)
        secret = {"Authorization": "Bearer " + "synthetic-cron-secret-" * 2}
        with (
            patch.object(self.service.settings, "ogd_key", SecretStr("synthetic-ogd-key")),
            self.respond(
                {"records": [current_row(0, 2600)]}, {"records": [history_row(1, 2580)]}, national_payload()
            ) as read,
        ):
            done = self.client.get("/api/v2/internal/prices", headers=secret)
            self.assertEqual(done.status_code, 200, done.text)
            self.assertEqual(
                {k: done.json()[k] for k in ("national", "scopes", "refreshed", "unavailable", "quotes")},
                {"national": "success", "scopes": 1, "refreshed": 1, "unavailable": 0, "quotes": 2},
            )
            # The farmer's price page is then served from storage, with no provider call.
            before = read.call_count
            page = self.client.get(
                "/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan", "district": "Jaipur"}
            ).json()
            self.assertEqual((page["status"], page["lead"], read.call_count), ("available", "local", before))
            self.assertEqual(self.client.get("/api/v2/internal/prices", headers=secret).json()["skipped"], 1)
        with self.factory() as db:
            self.assertGreaterEqual(db.scalar(select(func.count()).select_from(MarketPrice)), 8)
            self.assertLess(utcnow() - db.get(MarketFetch, national_prices.SCOPE).fetched_at, timedelta(minutes=1))

    def test_without_key_or_data_reports_not_configured_and_rejects_unknown_crop(self):
        with patch.object(self.service.settings, "ogd_key", SecretStr("")):
            response = self.client.get("/api/v2/market/prices", params={"crop": "wheat", "state": "Rajasthan"})
        self.assertEqual(response.json()["status"], "not_configured")
        self.assertEqual(response.json()["markets"], [])
        bad = self.client.get("/api/v2/market/prices", params={"crop": "unobtainium", "state": "Rajasthan"})
        self.assertEqual(bad.status_code, 422)


if __name__ == "__main__":
    unittest.main()

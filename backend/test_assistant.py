"""Voice assistant answers are short, grounded in the farmer's own records and never stored."""

import json
import os
import unittest
from datetime import timedelta
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

from db.models import Base, CropCycle, MarketPrice, Observation, utcnow
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import delete
from v2.application import install_v2
from v2.assistant import complete, parse_reply, system_prompt
from v2.farm_context.models import india_today
from v2.settings import Settings

ORIGIN = "http://localhost:3000"


class ReplyParsingTests(unittest.TestCase):
    def test_json_answer_and_action_are_used(self):
        answer, action = parse_reply('{"answer": "कल बारिश हो सकती है।", "action": "weather"}')
        self.assertEqual((answer, action), ("कल बारिश हो सकती है।", "weather"))

    def test_code_fences_markdown_and_unknown_actions_are_cleaned(self):
        answer, action = parse_reply('```json\n{"answer": "**Check** the leaves", "action": "spray"}\n```')
        self.assertEqual((answer, action), ("Check the leaves", "none"))

    def test_plain_text_falls_back_without_an_action(self):
        self.assertEqual(parse_reply("Water early in the morning."), ("Water early in the morning.", "none"))

    def test_empty_answer_is_an_error(self):
        with self.assertRaises(HTTPException):
            parse_reply('{"answer": "  ", "action": "none"}')

    def test_prompt_names_language_and_forbids_chemical_doses(self):
        prompt = system_prompt("ta", {"today": "2026-10-28", "crop": {"name": "Rice"}})
        self.assertIn("Reply only in Tamil", prompt)
        self.assertIn("never give a chemical dose", prompt)
        self.assertIn("1800-180-1551", prompt)
        self.assertIn('"name": "Rice"', prompt)

    def test_missing_key_is_reported_not_guessed(self):
        import asyncio

        with patch.dict(os.environ, {"SARVAM_API_KEY": ""}), self.assertRaises(HTTPException) as caught:
            asyncio.run(complete([{"role": "user", "content": "hello"}]))
        self.assertEqual(caught.exception.status_code, 503)


@unittest.skipUnless(os.getenv("V2_TEST_DATABASE_URL"), "Dedicated disposable PostGIS test URL required")
class AssistantEndpointTests(unittest.TestCase):
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
        self.b = TestClient(self.app)
        self.a.headers["Origin"] = ORIGIN
        self.b.headers["Origin"] = ORIGIN

    def tearDown(self):
        self.a.close()
        self.b.close()

    def sign_in(self, client, mobile="+919000000001"):
        challenge = client.post("/api/v2/auth/request-otp", json={"mobile": mobile}).json()
        result = client.post(
            "/api/v2/auth/verify-otp",
            json={"challenge_id": challenge["challenge_id"], "code": "123456", "accept_policy_version": "2026-10-03"},
        )
        self.assertEqual(result.status_code, 200, result.text)
        client.headers["X-CSRF-Token"] = result.json()["csrf_token"]

    def consent(self, client, purpose, granted=True):
        result = client.post(
            "/api/v2/consents", json={"purpose": purpose, "granted": granted, "policy_version": "2026-10-03"}
        )
        self.assertEqual(result.status_code, 200, result.text)

    def field(self, client):
        farm = client.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Synthetic farm"}).json()
        plot = client.post(
            "/api/v2/plots",
            json={
                "operation_id": str(uuid4()),
                "farm_id": farm["id"],
                "name": "North field",
                "entered_area_hectares": 1.5,
            },
        )
        self.assertEqual(plot.status_code, 201, plot.text)
        return plot.json()

    def ask(self, client, **body):
        return client.post("/api/v2/assistant/ask", json={"question": "Will it rain?", "language": "hi", **body})

    def test_answers_use_the_farmers_own_records_and_nothing_is_stored(self):
        self.sign_in(self.a)
        self.a.patch(
            "/api/v2/me", json={"display_name": "Synthetic farmer", "state": "Rajasthan", "district": "Jaipur"}
        )
        self.consent(self.a, "speech_processing")
        plot = self.field(self.a)
        with self.factory.begin() as db:
            plot_id = UUID(plot["id"])
            db.add(
                CropCycle(
                    plot_id=plot_id,
                    crop="Wheat",
                    crop_id="wheat",
                    sowing_date=india_today() - timedelta(days=30),
                    expected_harvest=india_today() + timedelta(days=90),
                    growth_stage="tillering",
                )
            )
            db.add(
                Observation(
                    plot_id=plot_id,
                    kind="weather",
                    observed_at=utcnow() - timedelta(hours=1),
                    source_type="weather_model",
                    source="Open-Meteo",
                    payload={
                        "current": {"temperature": 31.2, "humidity": 40, "wind_speed": 9},
                        "hourly": [{"temperature": 33.5}, {"temperature": 29}],
                        "precipitation_next_24h_mm": 4.2,
                    },
                    operation_id=uuid4(),
                    payload_hash="0" * 64,
                )
            )
            db.add(
                MarketPrice(
                    id=uuid4(),
                    arrival_date=india_today() - timedelta(days=1),
                    state="Rajasthan",
                    district="Jaipur",
                    market="Chomu",
                    commodity="Wheat",
                    variety="Other",
                    grade="FAQ",
                    modal_price=2450,
                    source_resource="test",
                )
            )
        before = self._rows()
        provider = AsyncMock(return_value='{"answer": "हाँ, कल 4.2 मिमी बारिश हो सकती है।", "action": "weather"}')
        with patch("v2.assistant.complete", provider):
            response = self.ask(
                self.a,
                plot_id=plot["id"],
                history=[{"role": "farmer", "text": "Namaste"}, {"role": "assistant", "text": "Namaste!"}],
            )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["action"], "weather")
        self.assertEqual(body["grounded_on"], ["crop", "field", "mandi_prices", "weather"])
        self.assertEqual(body["retention"], "not_stored")
        messages = provider.call_args.args[0]
        self.assertEqual([m["role"] for m in messages], ["system", "user", "assistant", "user"])
        facts = json.loads(messages[0]["content"].split("FACTS (the farmer's own records, may be incomplete):\n", 1)[1])
        self.assertEqual(facts["weather"]["rain_next_24h_mm"], 4.2)
        self.assertEqual(facts["weather"]["max_temperature_next_48h_c"], 33.5)
        self.assertEqual(facts["crop"]["days_since_sowing"], 30)
        self.assertEqual(facts["mandi_prices"][0]["modal_price_rupees_per_quintal"], 2450)
        self.assertEqual(facts["field"]["area_hectares"], 1.5)
        self.assertEqual(self._rows(), before)

    def test_permission_language_and_ownership_are_enforced(self):
        self.sign_in(self.a)
        self.sign_in(self.b, "+919000000002")
        plot = self.field(self.a)
        provider = AsyncMock(return_value='{"answer": "ok", "action": "none"}')
        with patch("v2.assistant.complete", provider):
            self.assertEqual(self.ask(self.a).status_code, 403)
            self.consent(self.a, "speech_processing")
            self.consent(self.b, "speech_processing")
            self.assertEqual(self.ask(self.a, language="fr").status_code, 422)
            self.assertEqual(self.ask(self.b, plot_id=plot["id"]).status_code, 404)
            self.assertEqual(self.ask(self.a, question="x" * 501).status_code, 422)
            self.assertEqual(self.ask(self.a, unexpected=True).status_code, 422)
            self.assertEqual(self.ask(self.a, plot_id=plot["id"]).status_code, 200)
        self.assertEqual(provider.call_count, 1)

    def test_withdrawing_permission_during_the_call_discards_the_answer(self):
        self.sign_in(self.a)
        self.consent(self.a, "speech_processing")

        async def withdraw(messages):
            self.consent(self.a, "speech_processing", granted=False)
            return '{"answer": "ok", "action": "none"}'

        with patch("v2.assistant.complete", withdraw):
            self.assertEqual(self.ask(self.a).status_code, 403)

    def test_per_farmer_hourly_limit(self):
        self.sign_in(self.a)
        self.consent(self.a, "speech_processing")
        with patch("v2.assistant.complete", AsyncMock(return_value='{"answer": "ok", "action": "none"}')):
            codes = []
            for _ in range(11):
                codes.append(self.ask(self.a).status_code)
        # The per-IP minute window (10) is the first limit a burst reaches.
        self.assertEqual(codes[:10], [200] * 10)
        self.assertEqual(codes[10], 429)

    def test_requires_sign_in(self):
        self.assertEqual(self.ask(self.a).status_code, 401)

    def _rows(self):
        with self.factory() as db:
            return {
                table.name: len(db.execute(table.select()).all())
                for table in Base.metadata.sorted_tables
                if table.name not in {"v2_sessions", "v2_auth_challenges"}
            }


if __name__ == "__main__":
    unittest.main()

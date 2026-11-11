"""Pest Radar, Claim Kit, Krishyak Live, farmer groups, Verify and the crop calendar."""

import io
import os
import unittest
from datetime import date, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import delete, select, update

from db.models import Base, Farmer, ImageAsset, Observation, Session, utcnow
from v2.application import install_v2
from v2.crop_calendar import CALENDAR, calendar_for
from v2.farm_context.models import india_today
from v2.settings import Settings
from v2.verify import assess

ORIGIN = "http://localhost:3000"
MOBILES = ["+919000000001", "+919000000002", "+919000000003"]
FIELD = {  # about one hectare near Jaipur
    "type": "Polygon",
    "coordinates": [[[75.787, 26.912], [75.788, 26.912], [75.788, 26.913], [75.787, 26.913], [75.787, 26.912]]],
}


def jpeg():
    data = io.BytesIO()
    Image.new("RGB", (640, 480), (40, 120, 50)).save(data, "JPEG")
    return data.getvalue()


def views(sowing, values):
    """Clear 10-day NDVI intervals starting 30 days before sowing."""
    start = sowing - timedelta(days=30)
    return [
        (start + timedelta(days=10 * i), start + timedelta(days=10 * i + 9), value) for i, value in enumerate(values)
    ]


class CalendarAndEvidenceTests(unittest.TestCase):
    def test_calendar_marks_what_is_due_today(self):
        sowing = date(2026, 11, 1)
        plan = calendar_for("wheat", sowing, today=sowing + timedelta(days=22))
        self.assertEqual([row["kind"] for row in plan["now"]], ["water"])
        self.assertIn("most important", plan["now"][0]["task"])
        self.assertEqual((plan["next"]["kind"], plan["next"]["in_days"]), ("weed", 8))
        self.assertEqual(plan["stages"][0]["from"], "2026-11-21")
        self.assertIsNone(calendar_for("dragonfruit", sowing))
        self.assertEqual(calendar_for("rice", sowing)["counted_from"], "transplanting")

    def test_calendar_never_names_chemicals_or_doses(self):
        text = " ".join(task for stages in CALENDAR.values() for *_, task in stages).lower()
        for word in ("kg", "gram", "ml", "litre", "spray", "urea", "dap", "pesticide", "fungicide", "insecticide"):
            self.assertNotIn(word, text)
        for stages in CALENDAR.values():
            self.assertTrue(all(first <= last for first, last, *_ in stages))

    def test_growth_after_sowing_is_consistent(self):
        sowing = date(2026, 6, 20)
        series = views(sowing, [0.14, 0.15, 0.16, 0.2, 0.31, 0.47, 0.62, 0.7])
        verdict, reason, findings = assess(sowing, series, sowing + timedelta(days=60))
        self.assertEqual((verdict, reason), ("consistent", "crop_growth_after_declared_sowing"))
        self.assertEqual((findings["greenness_at_sowing"], findings["peak_greenness"]), (0.14, 0.7))

    def test_bare_or_already_green_fields_go_to_a_person(self):
        sowing = date(2026, 6, 20)
        bare = views(sowing, [0.12, 0.13, 0.12, 0.13, 0.14, 0.15, 0.14, 0.15, 0.16])
        self.assertEqual(assess(sowing, bare, sowing + timedelta(days=70))[:2], ("needs_review", "no_crop_growth_seen"))
        orchard = views(sowing, [0.66, 0.68, 0.67, 0.69, 0.68, 0.7, 0.69])
        self.assertEqual(
            assess(sowing, orchard, sowing + timedelta(days=45))[:2], ("needs_review", "green_before_declared_sowing")
        )

    def test_cloud_and_early_requests_are_not_held_against_the_farmer(self):
        sowing = date(2026, 6, 20)
        self.assertEqual(assess(sowing, [], sowing + timedelta(days=50))[0], "not_enough_evidence")
        self.assertEqual(assess(sowing, [], sowing + timedelta(days=12))[0], "too_early")
        weak = views(sowing, [0.2, 0.2, 0.22, 0.25, 0.3, 0.33])
        self.assertEqual(assess(sowing, weak, sowing + timedelta(days=35))[0], "not_enough_evidence")


@unittest.skipUnless(os.getenv("V2_TEST_DATABASE_URL"), "Dedicated disposable PostGIS test URL required")
class FieldServiceTests(unittest.TestCase):
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
        self.images = TemporaryDirectory(prefix="krishyak-v2-test-")
        self.app.state.v2_settings.storage_root = Path(self.images.name)
        with self.factory.begin() as db:
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(delete(table))
        self.app.state.v2_quotas.local.clear()
        self.clients = []

    def tearDown(self):
        for client in self.clients:
            client.close()
        self.images.cleanup()

    def farmer(self, index=0, name="Asha", *consents):
        client = TestClient(self.app)
        client.headers["Origin"] = ORIGIN
        self.clients.append(client)
        challenge = client.post("/api/v2/auth/request-otp", json={"mobile": MOBILES[index]}).json()
        result = client.post(
            "/api/v2/auth/verify-otp",
            json={"challenge_id": challenge["challenge_id"], "code": "123456", "accept_policy_version": "2026-10-03"},
        )
        self.assertEqual(result.status_code, 200, result.text)
        client.headers["X-CSRF-Token"] = result.json()["csrf_token"]
        client.patch(
            "/api/v2/me",
            json={"display_name": name, "state": "Rajasthan", "district": "Jaipur", "village": "Chomu"},
        )
        self.allow(client, *consents)
        return client

    def allow(self, client, *purposes, granted=True):
        for purpose in purposes:
            response = client.post(
                "/api/v2/consents", json={"purpose": purpose, "granted": granted, "policy_version": "2026-10-03"}
            )
            self.assertEqual(response.status_code, 200, response.text)

    def field(self, client, *, crop="tomato", mapped=False, latitude=26.91, longitude=75.79, sown_days_ago=40):
        farm = client.post("/api/v2/farms", json={"operation_id": str(uuid4()), "name": "Farm"}).json()
        body = {"operation_id": str(uuid4()), "farm_id": farm["id"], "name": "North field", "entered_area_hectares": 1}
        if mapped:
            body["boundary"] = FIELD
        elif latitude is not None:
            body["approximate_location"] = {"latitude": latitude, "longitude": longitude}
        plot = client.post("/api/v2/plots", json=body)
        self.assertEqual(plot.status_code, 201, plot.text)
        if crop:
            sowing = india_today() - timedelta(days=sown_days_ago)
            cycle = client.post(
                f"/api/v2/plots/{plot.json()['id']}/crop-cycles",
                json={
                    "crop_id": crop,
                    "sowing_date": sowing.isoformat(),
                    "expected_harvest": (sowing + timedelta(days=120)).isoformat(),
                },
            )
            self.assertEqual(cycle.status_code, 201, cycle.text)
        return plot.json()

    def photo_check(self, plot, label="Tomato___Late_blight", status="detected", crop_id="tomato", days_ago=1):
        with self.factory.begin() as db:
            from db.models import Farm, Plot

            farmer_id = db.scalar(select(Farm.farmer_id).join(Plot).where(Plot.id == UUID(plot["id"])))
            db.add(
                ImageAsset(
                    farmer_id=farmer_id,
                    plot_id=UUID(plot["id"]),
                    object_key=f"{farmer_id}/{uuid4()}.jpg",
                    sha256="0" * 64,
                    mime="image/jpeg",
                    width=10,
                    height=10,
                    created_at=utcnow() - timedelta(days=days_ago),
                    result={
                        "status": status,
                        "predicted_class": label if status == "detected" else None,
                        "crop_id": crop_id,
                        "guidance": {"name": "Tomato late blight"} if status == "detected" else {},
                    },
                )
            )

    def ndvi(self, plot, values, sowing, revision=1):
        with self.factory.begin() as db:
            for start, end, mean in views(sowing, values):
                db.add(
                    Observation(
                        plot_id=UUID(plot["id"]),
                        kind="remote_sensing",
                        observed_at=utcnow() - (india_today() - end),
                        source_type="remote_sensing",
                        source="test",
                        payload={
                            "index": "ndvi",
                            "observation": {
                                "start": f"{start}T00:00:00Z",
                                "end": f"{end}T23:59:59Z",
                                "mean": mean,
                                "quality_status": "clear",
                            },
                        },
                        provenance={"boundary_revision": revision},
                        operation_id=uuid4(),
                        payload_hash="0" * 64,
                    )
                )

    def make_organiser(self, client):
        with self.factory.begin() as db:
            owner = db.scalar(select(Session.farmer_id).order_by(Session.created_at.desc()).limit(1))
            db.execute(update(Farmer).where(Farmer.id == owner).values(role="organisation_admin"))
        self.assertEqual(client.get("/api/v2/me").status_code, 200)

    # ---- Pest Radar -------------------------------------------------------
    def test_radar_warns_only_from_three_consenting_farms_nearby(self):
        me = self.farmer(0, "Asha", "location_processing")
        mine = self.field(me)
        path = f"/api/v2/plots/{mine['id']}/pest-radar"
        self.assertEqual(me.get(path).json()["status"], "watching")
        near = []
        for index in (1, 2):
            other = self.farmer(index, f"Neighbour {index}", "location_processing", "community_alerts")
            near.append(self.field(other, latitude=26.93, longitude=75.80))
            self.photo_check(near[-1])
        # Two farms are not enough to stay anonymous.
        self.assertEqual(me.get(path).json()["alerts"], [])
        # A second photo from the same farm is still one farm.
        self.photo_check(near[0])
        self.assertEqual(me.get(path).json()["alerts"], [])
        with self.factory.begin() as db:
            # A third consenting farmer, created directly: one more account than test phones.
            from db.models import Consent, Farm, Plot

            third = Farmer(display_name="Third")
            db.add(third)
            db.flush()
            db.add(
                Consent(
                    farmer_id=third.id,
                    purpose="community_alerts",
                    categories=[],
                    policy_version="2026-10-03",
                    consent_version="v1",
                    collection_surface="test",
                )
            )
            farm = Farm(farmer_id=third.id, name="F")
            db.add(farm)
            db.flush()
            source = db.get(Plot, UUID(near[0]["id"]))
            plot = Plot(farm_id=farm.id, name="P", approximate_location=source.approximate_location)
            db.add(plot)
            db.flush()
            third_plot = {"id": str(plot.id)}
        self.photo_check(third_plot)
        body = me.get(path).json()
        self.assertEqual(body["status"], "alert")
        alert = body["alerts"][0]
        self.assertEqual((alert["name"], alert["farms_at_least"], alert["urgent"]), ("Late blight (tomato)", 3, True))
        self.assertTrue(alert["steps"])
        self.assertNotIn("Neighbour", str(body))
        self.assertFalse(body["sharing"])
        # Withdrawn sharing, another crop, an old photo and a far field all stop counting.
        self.allow(self.clients[1], "community_alerts", granted=False)
        self.assertEqual(me.get(path).json()["alerts"], [])

    def test_radar_needs_a_located_field_permission_and_a_crop(self):
        me = self.farmer(0, "Asha")
        unlocated = self.field(me, latitude=None)
        self.assertEqual(me.get(f"/api/v2/plots/{unlocated['id']}/pest-radar").json()["status"], "needs_location")
        self.allow(me, "location_processing")
        no_crop = self.field(me, crop=None)
        self.assertEqual(me.get(f"/api/v2/plots/{no_crop['id']}/pest-radar").json()["status"], "needs_crop")
        self.allow(me, "location_processing", granted=False)
        self.assertEqual(me.get(f"/api/v2/plots/{no_crop['id']}/pest-radar").json()["status"], "needs_permission")
        other = self.farmer(1, "Other")
        self.assertEqual(other.get(f"/api/v2/plots/{no_crop['id']}/pest-radar").status_code, 404)

    # ---- Claim Kit --------------------------------------------------------
    def test_claim_kit_gathers_loss_photos_and_satellite_change(self):
        me = self.farmer(0, "Asha", "location_processing")
        plot = self.field(me, crop="wheat", mapped=True, sown_days_ago=70)
        loss_day = india_today() - timedelta(days=12)
        sowing = india_today() - timedelta(days=70)
        self.ndvi(plot, [0.2, 0.2, 0.25, 0.4, 0.55, 0.66, 0.7, 0.71, 0.3, 0.28], sowing)
        body = {
            "operation_id": str(uuid4()),
            "cause": "hailstorm",
            "occurred_on": loss_day.isoformat(),
            "affected_percent": 60,
            "note": "Hail flattened the east half",
        }
        created = me.post(f"/api/v2/plots/{plot['id']}/loss-reports", json=body)
        self.assertEqual(created.status_code, 201, created.text)
        report = created.json()
        self.assertEqual(me.post(f"/api/v2/plots/{plot['id']}/loss-reports", json=body).json()["id"], report["id"])
        self.assertTrue(report["individual_intimation"])
        self.assertEqual(report["intimation_hours_left"], 0)  # twelve days ago
        future = body | {"operation_id": str(uuid4()), "occurred_on": (india_today() + timedelta(days=1)).isoformat()}
        self.assertEqual(me.post(f"/api/v2/plots/{plot['id']}/loss-reports", json=future).status_code, 422)
        photo = {
            "operation_id": str(uuid4()),
            "captured_at": utcnow().isoformat(),
            "latitude": "26.9126",
            "longitude": "75.7876",
            "accuracy_metres": "12",
        }
        files = {"image": ("leaf.jpg", jpeg(), "image/jpeg")}
        saved = me.post(f"/api/v2/loss-reports/{report['id']}/photos", data=photo, files=files)
        self.assertEqual(saved.status_code, 201, saved.text)
        self.assertLess(saved.json()["distance_to_field_metres"], 100)
        self.assertEqual(saved.json()["location"]["latitude"], 26.9126)
        again = me.post(f"/api/v2/loss-reports/{report['id']}/photos", data=photo, files=files)
        self.assertEqual(again.json()["id"], saved.json()["id"])
        kit = me.get(f"/api/v2/loss-reports/{report['id']}").json()
        self.assertEqual(kit["farmer"]["name"], "Asha")
        self.assertEqual((kit["crop"]["name"], kit["report"]["cause"]), ("Wheat", "hailstorm"))
        self.assertEqual(len(kit["photos"]), 1)
        self.assertEqual(len(kit["photos"][0]["sha256"]), 64)
        self.assertEqual(kit["satellite"]["status"], "available")
        self.assertLess(kit["satellite"]["change"], -0.3)
        self.assertEqual(kit["official"]["helpline"], "14447")
        # Evidence photos stay out of leaf-check history and nearby alerts, but can be opened by their owner.
        self.assertEqual(me.get("/api/v2/disease-scans").json()["items"], [])
        self.assertEqual(me.get(f"/api/v2/disease-scans/{saved.json()['id']}/image").status_code, 200)
        self.assertEqual(len(me.get(f"/api/v2/plots/{plot['id']}/loss-reports").json()["items"]), 1)
        other = self.farmer(1, "Other")
        self.assertEqual(other.get(f"/api/v2/loss-reports/{report['id']}").status_code, 404)
        self.assertEqual(
            other.post(f"/api/v2/loss-reports/{report['id']}/photos", data=photo, files=files).status_code, 404
        )
        self.assertEqual(me.delete(f"/api/v2/loss-reports/{report['id']}").status_code, 200)
        with self.factory() as db:
            self.assertEqual(db.scalars(select(ImageAsset)).all(), [])
        self.assertEqual(me.get(f"/api/v2/loss-reports/{report['id']}").status_code, 404)

    def test_claim_photo_location_needs_permission_and_reports_are_capped(self):
        me = self.farmer(0, "Asha")
        plot = self.field(me, crop="wheat", latitude=None)
        report = me.post(
            f"/api/v2/plots/{plot['id']}/loss-reports",
            json={
                "operation_id": str(uuid4()),
                "cause": "drought",
                "occurred_on": india_today().isoformat(),
                "affected_percent": 30,
            },
        ).json()
        self.assertFalse(report["individual_intimation"])
        self.assertGreater(report["intimation_hours_left"], 60)
        files = {"image": ("leaf.jpg", jpeg(), "image/jpeg")}
        located = {
            "operation_id": str(uuid4()),
            "captured_at": utcnow().isoformat(),
            "latitude": "26.9",
            "longitude": "75.7",
        }
        self.assertEqual(
            me.post(f"/api/v2/loss-reports/{report['id']}/photos", data=located, files=files).status_code, 403
        )
        for _ in range(8):
            plain = {"operation_id": str(uuid4()), "captured_at": utcnow().isoformat()}
            saved = me.post(f"/api/v2/loss-reports/{report['id']}/photos", data=plain, files=files)
            self.assertEqual(saved.status_code, 201, saved.text)
            self.assertIsNone(saved.json()["location"])
        plain = {"operation_id": str(uuid4()), "captured_at": utcnow().isoformat()}
        self.assertEqual(
            me.post(f"/api/v2/loss-reports/{report['id']}/photos", data=plain, files=files).status_code, 422
        )
        kit = me.get(f"/api/v2/loss-reports/{report['id']}").json()
        self.assertEqual(kit["satellite"]["status"], "needs_boundary")

    # ---- Krishyak Live ----------------------------------------------------
    def test_live_turn_grounds_the_answer_in_what_the_leaf_model_saw(self):
        me = self.farmer(0, "Asha", "speech_processing", "agronomic_analysis")
        plot = self.field(me, crop="tomato", latitude=None)
        seen = (
            {
                "status": "detected",
                "predicted_class": "Tomato___Late_blight",
                "guidance": {
                    "name": "Tomato late blight",
                    "cause": "water mould",
                    "urgent": True,
                    "steps": ["Remove infected leaves.", "Avoid wetting leaves when irrigating."],
                },
            },
            {},
        )
        reply = AsyncMock(return_value='{"answer": "यह झुलसा रोग लग रहा है।", "action": "scan"}')
        data = {"question": "इस पत्ते को क्या हुआ है?", "language": "hi", "plot_id": plot["id"]}
        files = {"frame": ("frame.jpg", jpeg(), "image/jpeg")}
        with patch("v2.live.classify", return_value=seen) as model, patch("v2.live.complete", reply):
            response = me.post("/api/v2/live/turn", data=data, files=files)
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual((body["action"], body["retention"]), ("scan", "not_stored"))
        self.assertEqual(body["camera"]["likely_problem"], "Tomato late blight")
        self.assertEqual(model.call_args.args[1], "tomato")
        prompt = reply.call_args.args[0][0]["content"]
        self.assertIn("Krishyak's own leaf model", prompt)
        self.assertIn('"likely_problem": "Tomato late blight"', prompt)
        self.assertNotIn("You cannot see the crop", prompt)
        with self.factory() as db:
            self.assertEqual(db.scalars(select(ImageAsset)).all(), [])  # the frame is never kept

    def test_live_needs_permissions_and_handles_missing_pictures(self):
        me = self.farmer(0, "Asha")
        data = {"question": "What is this?", "language": "en"}
        files = {"frame": ("frame.jpg", jpeg(), "image/jpeg")}
        self.assertEqual(me.post("/api/v2/live/turn", data=data, files=files).status_code, 403)
        self.allow(me, "speech_processing")
        self.assertEqual(me.post("/api/v2/live/turn", data=data, files=files).status_code, 403)
        self.allow(me, "agronomic_analysis")
        reply = AsyncMock(return_value='{"answer": "Please show one leaf.", "action": "none"}')
        with patch("v2.live.complete", reply):
            no_field = me.post("/api/v2/live/turn", data=data, files=files)
            no_frame = me.post("/api/v2/live/turn", data=data)
            bad = me.post("/api/v2/live/turn", data=data, files={"frame": ("x.jpg", b"not an image", "image/jpeg")})
            history = me.post("/api/v2/live/turn", data=data | {"history": "{}"})
        self.assertEqual(no_field.json()["camera"], {"status": "needs_crop"})
        self.assertIsNone(no_frame.json()["camera"])
        self.assertIn("did not show a picture", reply.call_args_list[1].args[0][0]["content"])
        self.assertEqual((bad.status_code, history.status_code), (422, 422))

    # ---- Farmer groups ----------------------------------------------------
    def test_group_dashboard_shows_only_what_members_chose_to_share(self):
        fpo = self.farmer(0, "Jaipur FPO")
        self.assertEqual(
            fpo.post("/api/v2/admin/groups", json={"name": "Chomu growers", "district": "Jaipur"}).status_code, 403
        )
        self.make_organiser(fpo)
        group = fpo.post("/api/v2/admin/groups", json={"name": "Chomu growers", "district": "Jaipur"})
        self.assertEqual(group.status_code, 201, group.text)
        code = group.json()["join_code"]
        self.assertEqual(len(code), 8)
        member = self.farmer(1, "Ramesh", "location_processing")
        shared = self.field(member, crop="tomato")
        private = self.field(member, crop="wheat")
        self.photo_check(shared)
        me = member
        self.assertEqual(me.get("/api/v2/groups/lookup", params={"code": "ZZZZZZZZ"}).status_code, 404)
        found = me.get("/api/v2/groups/lookup", params={"code": code.lower()})
        self.assertEqual((found.json()["name"], found.json()["organiser"]), ("Chomu growers", "Jaipur FPO"))
        join = {"code": code, "plot_ids": [shared["id"]]}
        self.assertEqual(me.post("/api/v2/groups/join", json=join).status_code, 403)
        self.allow(me, "organisation_sharing")
        joined = me.post("/api/v2/groups/join", json=join)
        self.assertEqual(joined.status_code, 201, joined.text)
        self.assertEqual(me.get("/api/v2/groups/mine").json()["items"][0]["name"], "Chomu growers")
        self.assertEqual(me.get("/api/v2/pilot-enrollments").json()["items"], [])
        board = fpo.get(f"/api/v2/admin/groups/{group.json()['id']}/dashboard")
        self.assertEqual(board.status_code, 200, board.text)
        body = board.json()
        self.assertEqual(
            body["totals"], body["totals"] | {"members": 1, "fields": 1, "need_attention": 1, "hectares": 1.0}
        )
        row = body["fields"][0]
        self.assertEqual((row["farmer"], row["village"], row["crop"]), ("Ramesh", "Chomu", "Tomato"))
        self.assertEqual(row["photo_check"]["likely_problem"], "Tomato late blight")
        text = board.text
        for hidden in ("+9190", private["id"], shared["id"], "approximate_location", "boundary"):
            self.assertNotIn(hidden, text)
        self.assertEqual(fpo.get("/api/v2/admin/groups").json()["items"][0]["members"], 1)
        stranger = self.farmer(2, "Stranger")
        self.assertEqual(stranger.get(f"/api/v2/admin/groups/{group.json()['id']}/dashboard").status_code, 403)
        # Turning sharing off removes the member at once.
        self.allow(me, "organisation_sharing", granted=False)
        self.assertEqual(fpo.get(f"/api/v2/admin/groups/{group.json()['id']}/dashboard").json()["totals"]["members"], 0)
        self.assertEqual(me.get("/api/v2/groups/mine").json()["items"], [])

    # ---- Verify -----------------------------------------------------------
    def test_verify_shares_one_field_only_after_the_farmer_agrees(self):
        bank = self.farmer(0, "Gramin Bank")
        self.make_organiser(bank)
        created = bank.post("/api/v2/admin/verifications", json={"reference": "KCC-2026-0041", "purpose": "crop_loan"})
        self.assertEqual(created.status_code, 201, created.text)
        code, request_id = created.json()["code"], created.json()["id"]
        waiting = bank.get(f"/api/v2/admin/verifications/{request_id}").json()
        self.assertEqual((waiting["status"], waiting.get("farmer"), waiting["result"]), ("awaiting_farmer", None, None))
        me = self.farmer(1, "Ramesh", "location_processing")
        unmapped = self.field(me, crop="wheat", sown_days_ago=60)
        mapped = self.field(me, crop="wheat", mapped=True, sown_days_ago=60)
        sowing = india_today() - timedelta(days=60)
        self.ndvi(mapped, [0.15, 0.16, 0.15, 0.2, 0.3, 0.45, 0.6, 0.68], sowing)
        seen = me.get(f"/api/v2/verifications/lookup/{code}").json()
        self.assertEqual((seen["requester"], seen["reference"]), ("Gramin Bank", "KCC-2026-0041"))
        self.assertEqual(
            me.post(f"/api/v2/verifications/{code}/accept", json={"plot_id": mapped["id"]}).status_code, 403
        )
        self.allow(me, "satellite_processing")
        self.assertEqual(
            me.post(f"/api/v2/verifications/{code}/accept", json={"plot_id": unmapped["id"]}).status_code, 422
        )
        self.assertEqual(
            bank.post(f"/api/v2/verifications/{code}/accept", json={"plot_id": mapped["id"]}).status_code, 403
        )
        accepted = me.post(f"/api/v2/verifications/{code}/accept", json={"plot_id": mapped["id"]})
        self.assertEqual(accepted.status_code, 201, accepted.text)
        self.assertEqual(accepted.json()["result"]["verdict"], "consistent")
        # A used code cannot be answered twice.
        self.assertEqual(
            me.post(f"/api/v2/verifications/{code}/accept", json={"plot_id": mapped["id"]}).status_code, 404
        )
        report = bank.get(f"/api/v2/admin/verifications/{request_id}").json()
        self.assertEqual(report["status"], "ready")
        self.assertEqual(
            report["farmer"], {"name": "Ramesh", "village": "Chomu", "district": "Jaipur", "state": "Rajasthan"}
        )
        self.assertEqual(report["declared"]["crop"], "Wheat")
        self.assertFalse(report["result"]["human_review"])
        self.assertEqual(len(report["result"]["series"]), 8)
        self.assertNotIn("coordinates", str(report))
        self.assertNotIn("+9190", str(report))
        listed = bank.get("/api/v2/admin/verifications").json()["items"][0]
        self.assertEqual((listed["verdict"], listed["code"]), ("consistent", None))
        mine = me.get("/api/v2/verifications/mine").json()["items"]
        self.assertEqual(mine[0]["requester"], "Gramin Bank")
        self.assertIn("verifications", me.get("/api/v2/me/export").json())
        self.assertEqual(me.delete(f"/api/v2/verifications/{request_id}").status_code, 200)
        gone = bank.get(f"/api/v2/admin/verifications/{request_id}").json()
        self.assertEqual(
            (gone["status"], gone.get("farmer"), gone["result"], gone["declared"]), ("withdrawn", None, None, None)
        )


if __name__ == "__main__":
    unittest.main()

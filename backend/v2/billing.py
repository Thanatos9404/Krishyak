"""Usage statement for institutions: what was used, at the published list price.

Farmers never pay. An institution's statement counts delivered Krishyak Verify
reports and whether it ran a member workspace, month by month in Indian time.
It is a statement, not an invoice: no payment is taken in the app, and no
amount is invoiced until billing is switched on for the deployment
(``V2_BILLING_LIVE``). Prices live in one file, ``data/price_list.json``.
"""

import csv
import io
import json
import re
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import func, select

from db.models import AuditLog, PilotCohort, Verification

from .farm_context.models import india_today
from .groups import organiser
from .router import current_farmer, database

router = APIRouter(prefix="/api/v2", tags=["Usage statement"])
IST = timezone(timedelta(hours=5, minutes=30))
RULES = [
    "A Verify report counts once, in the month it was first delivered.",
    "Requests the farmer has not answered, checks that are still too early to judge and checks where the satellite could not run are not counted.",
    "A report the farmer has withdrawn is not counted.",
    "A workspace counts for each month in which you have at least one member group.",
]


@lru_cache
def price_list():
    return json.loads((Path(__file__).parent / "data" / "price_list.json").read_text(encoding="utf-8"))


def delivered(verdict, job_status):
    """A report was delivered when the satellite record could say something about the field."""
    return verdict in {"consistent", "needs_review"} or (verdict == "not_enough_evidence" and job_status == "completed")


def month_of(moment):
    return moment.astimezone(IST).strftime("%Y-%m")


def reported_month(record):
    stamp = (record.result or {}).get("reported_at")
    return month_of(datetime.fromisoformat(stamp)) if stamp and record.status == "ready" else None


def last_months(count):
    first = india_today().replace(day=1)
    months = []
    for _ in range(count):
        months.append(first.strftime("%Y-%m"))
        first = (first - timedelta(days=1)).replace(day=1)
    return months


def own_requests(db, farmer, since):
    return db.scalars(
        select(Verification)
        .where(Verification.requester_id == farmer.id, Verification.created_at >= since)
        .order_by(Verification.created_at)
        .limit(20000)
    ).all()


def month_start(month):
    year, number = (int(part) for part in month.split("-"))
    return datetime(year, number, 1, tzinfo=IST)


@router.get("/admin/usage")
def statement(
    request: Request,
    months: int = Query(default=6, ge=1, le=24),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    organiser(farmer, request, db, fresh_minutes=720)
    prices = price_list()
    wanted = last_months(months)
    # A report can be delivered months after it was requested; look back one extra season.
    rows = own_requests(db, farmer, month_start(wanted[-1]) - timedelta(days=200))
    first_group = db.scalar(
        select(func.min(PilotCohort.created_at)).where(
            PilotCohort.organisation_admin_id == farmer.id, PilotCohort.kind == "fpo", PilotCohort.status == "active"
        )
    )
    workspace_since = month_of(first_group) if first_group else None
    report_price, workspace_price = prices["items"]["verify_report"]["price"], prices["items"]["fpo_workspace"]["price"]
    lines = []
    for month in wanted:
        requested = [row for row in rows if month_of(row.created_at) == month]
        reports = sum(1 for row in rows if reported_month(row) == month)
        workspace = bool(workspace_since and workspace_since <= month)
        lines.append(
            {
                "month": month,
                "verify": {
                    "requested": len(requested),
                    "delivered": reports,
                    "waiting_for_farmer": sum(1 for row in requested if row.status == "awaiting_farmer"),
                    "withdrawn": sum(1 for row in requested if row.status == "withdrawn"),
                },
                "workspace": workspace,
                "at_list_price": {
                    "verify": reports * report_price,
                    "workspace": workspace_price if workspace else 0,
                    "total": reports * report_price + (workspace_price if workspace else 0),
                },
            }
        )
    return {
        "billing": {
            "live": request.app.state.v2_settings.billing_live,
            "currency": prices["currency"],
            "gst": prices["gst"],
            "effective_from": prices["effective_from"],
            "farmers_pay": prices["farmers_pay"],
        },
        "prices": prices["items"],
        "months": lines,
        "rules": RULES,
    }


def cell(value):
    """Spreadsheet programs run cells that start with a formula character; neutralise them."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in {"=", "+", "-", "@", "\t", "\r"} else text


@router.get("/admin/usage/{month}.csv")
def report_list(month: str, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    organiser(farmer, request, db, fresh_minutes=720)
    if not re.fullmatch(r"20\d\d-(0[1-9]|1[0-2])", month):
        raise HTTPException(422, "Use a month such as 2026-11")
    if date.fromisoformat(month + "-01") > india_today():
        raise HTTPException(422, "That month has not started")
    price = price_list()["items"]["verify_report"]["price"]
    rows = [
        row
        for row in own_requests(db, farmer, month_start(month) - timedelta(days=200))
        if reported_month(row) == month
    ]
    out = io.StringIO()
    sheet = csv.writer(out, lineterminator="\r\n")
    sheet.writerow(
        ["reference", "purpose", "requested_on", "answered_on", "delivered_on", "result", "list_price_inr_before_gst"]
    )
    for row in rows:
        sheet.writerow(
            [
                cell(row.reference),
                row.purpose,
                row.created_at.astimezone(IST).date().isoformat(),
                row.accepted_at.astimezone(IST).date().isoformat() if row.accepted_at else "",
                datetime.fromisoformat(row.result["reported_at"]).astimezone(IST).date().isoformat(),
                row.result.get("verdict", ""),
                price,
            ]
        )
    db.add(AuditLog(actor_id=farmer.id, action="usage_statement_downloaded"))
    return Response(
        out.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="krishyak-verify-{month}.csv"',
            "Cache-Control": "no-store",
        },
    )

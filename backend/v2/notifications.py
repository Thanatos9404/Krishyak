"""Owner-scoped in-app notices. External SMS/email/push delivery is not enabled."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from db.models import Notification, utcnow

from .router import current_farmer, database, serialize

router = APIRouter(prefix="/api/v2", tags=["In-app notifications"])


@router.get("/notifications")
def notifications(
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    records = db.scalars(
        select(Notification)
        .where(Notification.farmer_id == farmer.id)
        .order_by(Notification.created_at.desc(), Notification.id)
        .offset(offset)
        .limit(limit)
    )
    return {"items": [serialize(record) for record in records], "channel": "in_app", "offset": offset, "limit": limit}


@router.post("/notifications/{notification_id}/acknowledge")
def acknowledge(notification_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    record = db.scalar(
        select(Notification)
        .where(Notification.id == notification_id, Notification.farmer_id == farmer.id)
        .with_for_update()
    )
    if record is None:
        raise HTTPException(404, "Notification not found")
    record.acknowledged_at = record.acknowledged_at or utcnow()
    return serialize(record)

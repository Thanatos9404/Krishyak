"""Account export and transactional deletion with durable object cleanup."""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from db.models import (
    Consent,
    CropCycle,
    Farm,
    Feedback,
    ImageAsset,
    Notification,
    ObjectDeletion,
    Observation,
    PilotEnrollment,
    Plot,
)
from repositories.ownership import owned_farm, owned_plot

from .auth import clear_session
from .router import current_farmer, database, profile, serialize

router = APIRouter(prefix="/api/v2", tags=["Farmer data rights"])


def queue_objects(db, assets):
    for asset in assets:
        if not db.scalar(select(ObjectDeletion.id).where(ObjectDeletion.object_key == asset.object_key)):
            db.add(ObjectDeletion(object_key=asset.object_key))


@router.get("/me/export")
def export(request: Request, farmer=Depends(current_farmer)):
    owner = farmer.id
    account = profile(farmer)
    plot_ids = select(Plot.id).join(Farm).where(Farm.farmer_id == owner)
    sections = [
        ("farms", select(Farm).where(Farm.farmer_id == owner), ()),
        ("plots", select(Plot).where(Plot.id.in_(plot_ids)), ()),
        ("crop_cycles", select(CropCycle).where(CropCycle.plot_id.in_(plot_ids)), ()),
        ("observations", select(Observation).where(Observation.plot_id.in_(plot_ids)), ("payload_hash",)),
        ("images", select(ImageAsset).where(ImageAsset.farmer_id == owner), ("object_key",)),
        ("feedback", select(Feedback).where(Feedback.farmer_id == owner), ()),
        ("consents", select(Consent).where(Consent.farmer_id == owner), ()),
        ("pilot_enrollments", select(PilotEnrollment).where(PilotEnrollment.farmer_id == owner), ()),
        ("notifications", select(Notification).where(Notification.farmer_id == owner), ()),
    ]

    def encode(value):
        return json.dumps(jsonable_encoder(value), ensure_ascii=False, allow_nan=False)

    def stream():
        # Separate, read-only snapshot remains open only while streaming. A
        # server-side cursor bounds ORM memory even for long-lived accounts.
        with request.app.state.v2_database() as snapshot:
            snapshot.connection(execution_options={"isolation_level": "REPEATABLE READ"})
            yield '{"profile":' + encode(account)
            for name, query, excluded in sections:
                yield "," + encode(name) + ":["
                first = True
                for record in snapshot.scalars(query.execution_options(yield_per=100)):
                    yield ("" if first else ",") + encode(serialize(record, exclude=excluded))
                    first = False
                yield "]"
            yield (
                ',"limitations":'
                + encode(
                    [
                        "Photo bytes can be downloaded through the authenticated image endpoint",
                        "Provider-side retention is governed by each provider's terms",
                    ]
                )
                + "}"
            )

    return StreamingResponse(
        stream(),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="krishyak-account.json"'},
    )


@router.delete("/plots/{plot_id}")
def delete_plot(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    plot = owned_plot(db, farmer.id, plot_id, lock=True)
    queue_objects(
        db, db.scalars(select(ImageAsset).where(ImageAsset.plot_id == plot.id).execution_options(yield_per=100))
    )
    db.delete(plot)
    return {"status": "deleted", "object_cleanup": "queued"}


@router.delete("/farms/{farm_id}")
def delete_farm(farm_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    farm = owned_farm(db, farmer.id, farm_id)
    plots = select(Plot.id).where(Plot.farm_id == farm.id)
    queue_objects(
        db, db.scalars(select(ImageAsset).where(ImageAsset.plot_id.in_(plots)).execution_options(yield_per=100))
    )
    db.delete(farm)
    return {"status": "deleted", "object_cleanup": "queued"}


@router.delete("/me")
def delete_account(
    request: Request, response: Response, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    queue_objects(
        db, db.scalars(select(ImageAsset).where(ImageAsset.farmer_id == farmer.id).execution_options(yield_per=100))
    )
    # Challenges are pre-account data, so they need an explicit delete.
    from sqlalchemy import delete

    from db.models import AuthChallenge

    db.execute(delete(AuthChallenge).where(AuthChallenge.mobile == farmer.mobile))
    db.delete(farmer)
    clear_session(response, request.app.state.v2_settings)
    return {
        "status": "deleted",
        "object_cleanup": "queued",
        "limitations": [
            "Backups expire according to the operator's retention policy",
            "Provider-side processing records require separate provider retention controls",
        ],
    }

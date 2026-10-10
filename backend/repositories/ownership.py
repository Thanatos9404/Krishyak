from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select

from db.models import Farm, Plot


def owned_farm(db, farmer_id: UUID, farm_id: UUID) -> Farm:
    farm = db.scalar(select(Farm).where(Farm.id == farm_id, Farm.farmer_id == farmer_id))
    if farm is None:
        raise HTTPException(404, "Farm not found")
    return farm


def owned_plot(db, farmer_id: UUID, plot_id: UUID, *, lock=False) -> Plot:
    query = select(Plot).join(Farm).where(Plot.id == plot_id, Farm.farmer_id == farmer_id)
    if lock:
        query = query.with_for_update(of=Plot)
    plot = db.scalar(query)
    if plot is None:
        raise HTTPException(404, "Plot not found")
    return plot

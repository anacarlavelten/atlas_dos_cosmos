from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from atlas.ext.config import Settings, settings_from
from atlas.ext.db import SessionDep
from atlas.ext.nasa import NasaDep
from atlas.spaceweather import services
from atlas.spaceweather.schemas import FlaresOut

router = APIRouter(prefix="/api/space-weather", tags=["clima espacial"])


@router.get("/flares", response_model=FlaresOut, summary="Erupções solares recentes (DONKI)")
async def flares(
    session: SessionDep,
    nasa: NasaDep,
    settings: Settings = Depends(settings_from),
    days: int = Query(default=30, ge=1, le=90),
) -> FlaresOut:
    return await services.get_flares(session, nasa, settings, days)

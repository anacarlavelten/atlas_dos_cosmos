from __future__ import annotations

from fastapi import APIRouter, Depends

from atlas.ext.config import Settings, settings_from
from atlas.ext.db import SessionDep
from atlas.ext.nasa import NasaDep
from atlas.neo import services
from atlas.neo.schemas import NeoWeekOut

router = APIRouter(prefix="/api/neo", tags=["asteroides próximos"])


@router.get(
    "/week", response_model=NeoWeekOut, summary="Asteroides mais próximos nos próximos 7 dias"
)
async def week(
    session: SessionDep, nasa: NasaDep, settings: Settings = Depends(settings_from)
) -> NeoWeekOut:
    return await services.get_week(session, nasa, settings)

from __future__ import annotations

from fastapi import APIRouter, Depends

from atlas.ext.config import Settings, settings_from
from atlas.ext.db import SessionDep
from atlas.ext.nasa import NasaDep
from atlas.orbits import services
from atlas.orbits.schemas import OrbitsOut

router = APIRouter(prefix="/api/orbits", tags=["órbitas"])


@router.get(
    "",
    response_model=OrbitsOut,
    summary="Elementos orbitais (JPL Horizons/SBDB) e posição das sondas",
)
async def orbits(
    session: SessionDep, nasa: NasaDep, settings: Settings = Depends(settings_from)
) -> OrbitsOut:
    return await services.get_orbits(session, nasa, settings)

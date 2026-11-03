from __future__ import annotations

from fastapi import APIRouter, Depends

from atlas.exoplanets import services
from atlas.exoplanets.schemas import ExoplanetHostsOut
from atlas.ext.config import Settings, settings_from
from atlas.ext.db import SessionDep
from atlas.ext.nasa import NasaDep

router = APIRouter(prefix="/api/exoplanets", tags=["exoplanetas"])


@router.get(
    "/hosts", response_model=ExoplanetHostsOut, summary="Estrelas com exoplanetas confirmados"
)
async def hosts(
    session: SessionDep, nasa: NasaDep, settings: Settings = Depends(settings_from)
) -> ExoplanetHostsOut:
    return await services.get_hosts(session, nasa, settings)

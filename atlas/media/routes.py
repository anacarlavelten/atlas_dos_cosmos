from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from atlas.catalog.services import BodyNotFound
from atlas.ext.config import Settings, settings_from
from atlas.ext.db import SessionDep
from atlas.ext.nasa import NasaDep
from atlas.media import services
from atlas.media.schemas import ApodOut, BodyImagesOut, EpicOut

router = APIRouter(prefix="/api/media", tags=["imagens"])


@router.get("/apod", response_model=ApodOut, summary="Foto astronômica do dia (APOD)")
async def apod(
    session: SessionDep, nasa: NasaDep, settings: Settings = Depends(settings_from)
) -> ApodOut:
    return await services.get_apod(session, nasa, settings)


@router.get("/epic", response_model=EpicOut, summary="Últimas fotos da Terra inteira (EPIC)")
async def epic(
    session: SessionDep, nasa: NasaDep, settings: Settings = Depends(settings_from)
) -> EpicOut:
    return await services.get_epic(session, nasa, settings)


@router.get(
    "/images/{slug}",
    response_model=BodyImagesOut,
    summary="Fotos de um astro na NASA Image and Video Library",
)
async def body_images(
    slug: str,
    session: SessionDep,
    nasa: NasaDep,
    settings: Settings = Depends(settings_from),
    limit: int = Query(default=4, ge=1, le=12),
) -> BodyImagesOut:
    try:
        return await services.get_body_images(session, nasa, settings, slug, limit)
    except BodyNotFound:
        raise HTTPException(status_code=404, detail=f"Astro '{slug}' não encontrado.") from None

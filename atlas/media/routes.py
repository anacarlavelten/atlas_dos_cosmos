from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from atlas.catalog.services import BodyNotFound
from atlas.ext.config import Settings, settings_from
from atlas.ext.db import SessionDep
from atlas.ext.nasa import NasaDep
from atlas.media import services
from atlas.media.schemas import ApodOut, BirthImagesOut, BodyImagesOut, EpicOut

router = APIRouter(prefix="/api/media", tags=["imagens"])
APOD_FIRST_DATE = date(1995, 6, 16)


@router.get("/apod", response_model=ApodOut, summary="Foto astronômica do dia (APOD)")
async def apod(
    session: SessionDep,
    nasa: NasaDep,
    settings: Settings = Depends(settings_from),
    day: date | None = Query(default=None, alias="date", description="Data da APOD no formato YYYY-MM-DD"),
) -> ApodOut:
    target_day = day or datetime.now(UTC).date()
    if target_day < APOD_FIRST_DATE:
        raise HTTPException(
            status_code=422,
            detail=f"A APOD está disponível desde {APOD_FIRST_DATE.isoformat()}.",
        )
    if target_day > datetime.now(UTC).date():
        raise HTTPException(status_code=422, detail="A data da APOD não pode ser futura.")
    return await services.get_apod(session, nasa, settings, day)


@router.get("/epic", response_model=EpicOut, summary="Últimas fotos da Terra inteira (EPIC)")
async def epic(
    session: SessionDep, nasa: NasaDep, settings: Settings = Depends(settings_from)
) -> EpicOut:
    return await services.get_epic(session, nasa, settings)


@router.get(
    "/birth-images/{year}",
    response_model=BirthImagesOut,
    summary="Imagens da NASA do ano de nascimento",
)
async def birth_images(
    session: SessionDep,
    nasa: NasaDep,
    settings: Settings = Depends(settings_from),
    year: int = Path(ge=1900, le=datetime.now(UTC).year),
) -> BirthImagesOut:
    return await services.get_birth_images(session, nasa, settings, year)


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

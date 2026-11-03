from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from atlas.catalog import services
from atlas.catalog.schemas import BodyOut, LevelOut
from atlas.ext.db import SessionDep

router = APIRouter(prefix="/api/catalog", tags=["catálogo"])


@router.get("/levels", response_model=list[LevelOut], summary="Os três níveis de escala")
async def levels() -> list[LevelOut]:
    return services.list_levels()


@router.get("/bodies", response_model=list[BodyOut], summary="Lista os astros do catálogo")
async def bodies(
    session: SessionDep,
    level: int | None = Query(default=None, ge=1, le=3, description="Filtra por nível"),
) -> list[BodyOut]:
    return [services.to_out(b) for b in await services.list_bodies(session, level)]


@router.get("/bodies/{slug}", response_model=BodyOut, summary="Detalhes de um astro")
async def body(slug: str, session: SessionDep) -> BodyOut:
    try:
        return services.to_out(await services.get_body(session, slug))
    except services.BodyNotFound:
        raise HTTPException(status_code=404, detail=f"Astro '{slug}' não encontrado.") from None

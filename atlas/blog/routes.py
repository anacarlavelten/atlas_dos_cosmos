from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from atlas.blog import services
from atlas.blog.schemas import FeedOut, LaunchesOut, TechListOut, TopicsOut
from atlas.ext.config import Settings, settings_from
from atlas.ext.db import SessionDep
from atlas.ext.nasa import NasaDep

router = APIRouter(prefix="/api/blog", tags=["blog"])


@router.get("/topics", response_model=TopicsOut, summary="Filtros disponíveis no blog")
async def topics() -> TopicsOut:
    return TopicsOut(**services.topics())


@router.get("/feed", response_model=FeedOut, summary="Linha do tempo de publicações (SNAPI)")
async def feed(
    session: SessionDep,
    nasa: NasaDep,
    settings: Settings = Depends(settings_from),
    kind: str = Query(default="articles", description="articles, blogs ou reports"),
    topic: str = Query(default="tudo", description="chave vinda de /api/blog/topics"),
    q: str | None = Query(default=None, max_length=80, description="busca livre"),
    offset: int = Query(default=0, ge=0, le=2000),
    limit: int = Query(default=20, ge=1, le=40),
) -> FeedOut:
    try:
        return await services.get_feed(
            session, nasa, settings, kind=kind, topic=topic, query=q, offset=offset, limit=limit
        )
    except services.UnknownOption as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None


@router.get(
    "/launches", response_model=LaunchesOut, summary="Próximos lançamentos (Launch Library 2)"
)
async def launches(
    session: SessionDep,
    nasa: NasaDep,
    settings: Settings = Depends(settings_from),
    limit: int = Query(default=6, ge=1, le=12),
) -> LaunchesOut:
    return await services.get_launches(session, nasa, settings, limit)


@router.get(
    "/technologies/{area}",
    response_model=TechListOut,
    summary="Tecnologias da NASA disponíveis para a sociedade (Technology Transfer)",
)
async def technologies(
    area: str,
    session: SessionDep,
    nasa: NasaDep,
    settings: Settings = Depends(settings_from),
    limit: int = Query(default=4, ge=1, le=10),
) -> TechListOut:
    try:
        return await services.get_technologies(session, nasa, settings, area, limit)
    except services.UnknownOption as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None

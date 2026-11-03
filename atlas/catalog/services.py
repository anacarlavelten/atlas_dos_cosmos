"""Regras do catálogo: consulta dos astros e carga inicial (seed).

O texto didático em português não existe em nenhuma API da NASA; ele fica no
arquivo ``data/catalog.json`` e é gravado no banco na primeira execução. Os dados
numéricos que mudam com o tempo (órbitas, asteroides, atividade solar...) vêm da
NASA pelos outros domínios.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from atlas.catalog.models import Body, BodyFact
from atlas.catalog.schemas import BodyOut, LevelOut

SEED_FILE = Path(__file__).parent / "data" / "catalog.json"


class BodyNotFound(LookupError):
    def __init__(self, slug: str) -> None:
        super().__init__(slug)
        self.slug = slug


@lru_cache
def load_seed(path: Path = SEED_FILE) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def list_levels() -> list[LevelOut]:
    return [LevelOut(**lvl) for lvl in load_seed()["levels"]]


def _query():
    return select(Body).options(selectinload(Body.facts), selectinload(Body.parent))


def to_out(body: Body) -> BodyOut:
    return BodyOut(
        slug=body.slug,
        level=body.level,
        category=body.category,
        group=body.list_group,
        name=body.name,
        kind=body.kind,
        summary=body.summary,
        curiosity=body.curiosity,
        color=body.color,
        parent=body.parent.slug if body.parent else None,
        facts=[{"label": f.label, "value": f.value} for f in body.facts],
        render=body.render or {},
        action=body.action,
        live=body.live or [],
        nasa={"horizons": body.horizons_id, "sbdb": body.sbdb_id, "images": body.image_query},
    )


async def list_bodies(session: AsyncSession, level: int | None = None) -> list[Body]:
    stmt = _query().order_by(Body.level, Body.sort_order)
    if level is not None:
        stmt = stmt.where(Body.level == level)
    return list((await session.scalars(stmt)).all())


async def get_body(session: AsyncSession, slug: str) -> Body:
    body = await session.scalar(_query().where(Body.slug == slug))
    if body is None:
        raise BodyNotFound(slug)
    return body


async def count_bodies(session: AsyncSession) -> int:
    return await session.scalar(select(func.count(Body.id))) or 0


async def seed_catalog(
    session: AsyncSession, data: dict[str, Any] | None = None, *, replace: bool = False
) -> int:
    """Grava os astros do arquivo seed. Com ``replace=True`` apaga o catálogo antes
    (as órbitas salvas são apagadas junto, em cascata)."""
    data = data or load_seed()
    if replace:
        await session.execute(delete(Body))
        await session.commit()
    elif await count_bodies(session):
        return 0

    by_slug: dict[str, Body] = {}
    for item in data["bodies"]:
        nasa = item.get("nasa") or {}
        body = Body(
            slug=item["slug"],
            level=item["level"],
            category=item["category"],
            list_group=item["group"],
            sort_order=item.get("sort", 0),
            name=item["name"],
            kind=item.get("kind") or "",
            summary=item["summary"],
            curiosity=item.get("curiosity"),
            color=item.get("color"),
            horizons_id=nasa.get("horizons"),
            sbdb_id=nasa.get("sbdb"),
            image_query=nasa.get("images"),
            render=item.get("render") or {},
            action=item.get("action"),
            live=item.get("live") or [],
            facts=[
                BodyFact(position=i, label=label, value=value)
                for i, (label, value) in enumerate(item.get("facts") or [])
            ],
        )
        by_slug[body.slug] = body
        session.add(body)

    for item in data["bodies"]:
        if item.get("parent"):
            by_slug[item["slug"]].parent = by_slug[item["parent"]]

    await session.commit()
    return len(by_slug)

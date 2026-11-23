"""Regras de negócio do Diário de observação (consultas e gravação via ORM)."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from atlas.catalog.models import Body
from atlas.ext.web import FormError
from atlas.observations.models import INSTRUMENTS, Observation
from atlas.observations.schemas import MIN_DATE, ObservationIn, latest_allowed_date

log = logging.getLogger("atlas.observations")

SKY_QUALITY = {
    1: "1 · Muito ruim (nublado ou muita luz)",
    2: "2 · Ruim",
    3: "3 · Razoável",
    4: "4 · Bom",
    5: "5 · Excelente (céu escuro e limpo)",
}


class ObservationNotFound(LookupError):
    pass


class DeleteForbidden(PermissionError):
    pass


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def options() -> dict[str, Any]:
    return {
        "instruments": [{"key": k, "label": v} for k, v in INSTRUMENTS.items()],
        "sky_quality": [{"key": str(k), "label": v} for k, v in SKY_QUALITY.items()],
        "min_date": MIN_DATE,
        "max_date": latest_allowed_date(),
    }


async def list_observations(
    session: AsyncSession, *, body_slug: str | None = None, offset: int = 0, limit: int = 20
) -> tuple[int, list[Observation]]:
    stmt = select(Observation).join(Observation.body)
    count = select(func.count(Observation.id)).join(Observation.body)
    if body_slug:
        stmt = stmt.where(Body.slug == body_slug)
        count = count.where(Body.slug == body_slug)
    stmt = stmt.order_by(Observation.observed_at.desc(), Observation.id.desc())
    items = list((await session.scalars(stmt.offset(offset).limit(limit))).unique().all())
    return await session.scalar(count) or 0, items


async def get_observation(session: AsyncSession, observation_id: int) -> Observation:
    observation = await session.get(Observation, observation_id)
    if observation is None:
        raise ObservationNotFound(observation_id)
    return observation


async def create_observation(session: AsyncSession, data: ObservationIn) -> tuple[Observation, str]:
    """Grava a observação e devolve também o código para apagá-la.

    O astro é validado aqui (e não no Pydantic) porque depende do banco: se o slug
    não existir, o erro volta no mesmo formato 422 dos outros campos.
    """
    body = await session.scalar(select(Body).where(Body.slug == data.body_slug))
    if body is None:
        raise FormError("body_slug", "Escolha um astro da lista.")

    token = secrets.token_urlsafe(24)
    observation = Observation(
        body=body,
        observer_name=data.observer_name,
        observed_at=data.observed_at,
        location=data.location,
        instrument=data.instrument,
        sky_quality=data.sky_quality,
        notes=data.notes,
        delete_token_hash=_hash(token),
    )
    session.add(observation)
    await session.commit()
    await session.refresh(observation)
    log.info("Observação %s registrada (%s, %s)", observation.id, body.slug, data.observed_at)
    return observation, token


async def delete_observation(session: AsyncSession, observation_id: int, token: str | None) -> None:
    observation = await get_observation(session, observation_id)
    if not token or not hmac.compare_digest(_hash(token), observation.delete_token_hash):
        log.warning("Tentativa de apagar a observação %s sem o código correto", observation_id)
        raise DeleteForbidden(observation_id)
    await session.delete(observation)
    await session.commit()
    log.info("Observação %s apagada", observation_id)


async def snapshot(session: AsyncSession) -> list[dict[str, Any]]:
    """Copia as observações (com o slug do astro) antes de o catálogo ser recriado."""
    rows = (await session.scalars(select(Observation))).unique().all()
    return [
        {
            "slug": o.body.slug,
            "observer_name": o.observer_name,
            "observed_at": o.observed_at,
            "location": o.location,
            "instrument": o.instrument,
            "sky_quality": o.sky_quality,
            "notes": o.notes,
            "delete_token_hash": o.delete_token_hash,
            "created_at": o.created_at,
        }
        for o in rows
    ]


async def restore(session: AsyncSession, saved: list[dict[str, Any]]) -> int:
    """Religa as observações salvas aos astros recriados, pelo slug."""
    if not saved:
        return 0
    ids = {slug: body_id for slug, body_id in await session.execute(select(Body.slug, Body.id))}
    restored = 0
    for item in saved:
        body_id = ids.get(item["slug"])
        if body_id is None:
            log.warning("Observação descartada: o astro '%s' saiu do catálogo", item["slug"])
            continue
        fields = {k: v for k, v in item.items() if k != "slug"}
        session.add(Observation(body_id=body_id, **fields))
        restored += 1
    await session.commit()
    return restored

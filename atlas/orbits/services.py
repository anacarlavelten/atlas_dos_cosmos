"""Órbitas do Sistema Solar.

Fluxo de ``get_orbits``:

1. carrega do banco os astros do nível 1 que orbitam algo (planetas, luas,
   anões, cometas) com seus elementos já salvos;
2. os que não têm elementos, ou cujos elementos passaram de
   ``ORBITS_TTL_HOURS``, são consultados na NASA — JPL SBDB para corpos
   pequenos e JPL Horizons para o resto — em paralelo;
3. o que a NASA não conseguir responder usa a tabela aproximada do JPL
   (``fallback.py``) e aparece com ``source = "aproximado"``;
4. as sondas recebem posição e velocidade do Horizons (tabela ``VECTORS``).
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from atlas.catalog.models import Body
from atlas.ext import cache
from atlas.ext.config import Settings
from atlas.ext.nasa import NasaError, NasaGateway
from atlas.orbits import fallback
from atlas.orbits.models import OrbitalElements
from atlas.orbits.schemas import BodyOrbitOut, OrbitsOut, RefreshReport, SpacecraftOut

ORBITING = ("planet", "dwarf", "moon", "comet")
SUN_CENTER = "500@10"
APPROX = "aproximado"


def _aware(moment: datetime | None) -> datetime | None:
    if moment is None:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


async def _orbiting_bodies(session: AsyncSession) -> list[Body]:
    stmt = (
        select(Body)
        .where(Body.level == 1, Body.category.in_(ORBITING))
        .options(selectinload(Body.orbit), selectinload(Body.parent))
        .order_by(Body.sort_order)
    )
    return list((await session.scalars(stmt)).all())


def _center_for(body: Body) -> str:
    if body.parent is not None and body.parent.horizons_id:
        return f"500@{body.parent.horizons_id}"
    return SUN_CENTER


def _has_nasa_source(body: Body) -> bool:
    return bool(body.sbdb_id or body.horizons_id)


async def _fetch(nasa: NasaGateway, body: Body, day: date) -> tuple[str, str, dict]:
    if body.sbdb_id:
        return "JPL SBDB", SUN_CENTER, await nasa.sbdb.elements(body.sbdb_id)
    center = _center_for(body)
    return "JPL Horizons", center, await nasa.horizons.elements(body.horizons_id, center, day)


async def refresh_elements(
    session: AsyncSession, nasa: NasaGateway, bodies: list[Body]
) -> RefreshReport:
    """Consulta a NASA para os astros informados e grava os elementos."""
    day = datetime.now(UTC).date()
    targets = [b for b in bodies if _has_nasa_source(b)]
    results = await asyncio.gather(
        *(_fetch(nasa, body, day) for body in targets), return_exceptions=True
    )
    report = RefreshReport(updated=[], failed={})
    now = datetime.now(UTC)
    for body, result in zip(targets, results, strict=True):
        if isinstance(result, NasaError):
            report.failed[body.slug] = result.message
            continue
        if isinstance(result, BaseException):
            raise result
        source, center, elements = result
        orbit = body.orbit or OrbitalElements(body=body)
        orbit.source, orbit.center, orbit.fetched_at = source, center, now
        for key, value in elements.items():
            setattr(orbit, key, value)
        session.add(orbit)
        report.updated.append(body.slug)
    await session.commit()
    return report


def _is_stale(body: Body, ttl: timedelta) -> bool:
    fetched = _aware(body.orbit.fetched_at) if body.orbit else None
    return fetched is None or datetime.now(UTC) - fetched > ttl


async def _spacecraft(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, warnings: list[str]
) -> list[SpacecraftOut]:
    stmt = select(Body).where(Body.level == 1, Body.category == "probe").order_by(Body.sort_order)
    probes = list((await session.scalars(stmt)).all())
    ttl = timedelta(hours=settings.orbits_ttl_hours)
    day = datetime.now(UTC).date()
    out: list[SpacecraftOut] = []
    for probe in probes:
        state, source, fetched = None, APPROX, None
        if probe.horizons_id:
            try:
                cached = await cache.remember(
                    session,
                    f"vectors:{probe.slug}",
                    ttl,
                    lambda p=probe: nasa.horizons.vectors(p.horizons_id, SUN_CENTER, day),
                    source="JPL Horizons",
                )
                state, source, fetched = cached.payload, "JPL Horizons", cached.fetched_at
            except NasaError as exc:
                warnings.append(f"{probe.name}: {exc.message}")
        if state is None:
            state = fallback.spacecraft_state(probe.render or {})
        if state is not None:
            out.append(SpacecraftOut(slug=probe.slug, source=source, fetched_at=fetched, **state))
    return out


async def get_orbits(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, *, force: bool = False
) -> OrbitsOut:
    warnings: list[str] = []
    ttl = timedelta(hours=settings.orbits_ttl_hours)

    bodies = await _orbiting_bodies(session)
    stale = [b for b in bodies if _has_nasa_source(b) and (force or _is_stale(b, ttl))]
    if stale:
        async with cache.lock_for("orbits:refresh"):
            # Outra requisição pode ter atualizado enquanto esperávamos a trava.
            session.expire_all()
            bodies = await _orbiting_bodies(session)
            stale = [b for b in bodies if _has_nasa_source(b) and (force or _is_stale(b, ttl))]
            if stale:
                report = await refresh_elements(session, nasa, stale)
                for slug, message in report.failed.items():
                    warnings.append(f"{slug}: {message}")
                bodies = await _orbiting_bodies(session)

    out: list[BodyOrbitOut] = []
    for body in bodies:
        center = body.parent.slug if body.parent else "sol"
        if body.orbit is not None:
            out.append(
                BodyOrbitOut(
                    slug=body.slug,
                    center=center,
                    source=body.orbit.source,
                    fetched_at=_aware(body.orbit.fetched_at),
                    elements=body.orbit.as_dict(),
                )
            )
            continue
        approx = fallback.body_elements(body.slug, body.category, body.render or {})
        if approx is not None:
            out.append(BodyOrbitOut(slug=body.slug, center=center, source=APPROX, elements=approx))

    spacecraft = await _spacecraft(session, nasa, settings, warnings)
    return OrbitsOut(
        generated_at=datetime.now(UTC),
        bodies=out,
        spacecraft=spacecraft,
        warnings=warnings,
    )

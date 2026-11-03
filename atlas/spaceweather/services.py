"""Clima espacial: erupções solares recentes registradas no DONKI.

As erupções são classificadas pela intensidade do pico de raios X: A, B, C, M e X
(cada letra é 10 vezes mais forte que a anterior), seguidas de um número
(M2.5 é 2,5 vezes mais forte que M1).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from atlas.ext import cache
from atlas.ext.config import Settings
from atlas.ext.nasa import NasaGateway
from atlas.spaceweather.schemas import FlaresOut

CLASS_ORDER = "ABCMX"


def flare_strength(class_type: str | None) -> float:
    """Converte 'M2.5' em um número comparável (X1 > M9.9 > M1 > C5...)."""
    if not class_type:
        return 0.0
    letter = class_type[0].upper()
    try:
        magnitude = float(class_type[1:] or 1)
    except ValueError:
        magnitude = 1.0
    index = CLASS_ORDER.find(letter)
    return (10.0**index) * magnitude if index >= 0 else 0.0


def shape_flare(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "class_type": raw.get("classType") or "?",
        "begin_time": raw.get("beginTime"),
        "peak_time": raw.get("peakTime"),
        "active_region": raw.get("activeRegionNum"),
        "source_location": raw.get("sourceLocation"),
        "link": raw.get("link"),
    }


def summarize_flares(raw: list[dict[str, Any]], start: date, end: date) -> dict[str, Any]:
    flares = [shape_flare(f) for f in raw]
    by_class: dict[str, int] = {}
    for flare in flares:
        letter = flare["class_type"][:1].upper()
        by_class[letter] = by_class.get(letter, 0) + 1
    strongest = max(flares, key=lambda f: flare_strength(f["class_type"]), default=None)
    recent = sorted(flares, key=lambda f: f["peak_time"] or f["begin_time"] or "", reverse=True)
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "count": len(flares),
        "by_class": dict(sorted(by_class.items(), key=lambda kv: CLASS_ORDER.find(kv[0]))),
        "strongest": strongest,
        "recent": recent[:5],
    }


async def get_flares(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, days: int = 30
) -> FlaresOut:
    end = datetime.now(UTC).date()
    start = end - timedelta(days=days)

    async def produce() -> dict[str, Any]:
        return summarize_flares(await nasa.donki.flares(start, end), start, end)

    cached = await cache.remember(
        session,
        f"flares:{end.isoformat()}:{days}",
        timedelta(minutes=settings.flares_ttl_minutes),
        produce,
        source="NASA DONKI",
    )
    return FlaresOut(**cached.payload, fetched_at=cached.fetched_at, stale=cached.stale)

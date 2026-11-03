"""Asteroides que passam perto da Terra nesta semana (NASA NeoWs).

O ``feed`` informa a aproximação de cada objeto; para desenhar a órbita, os mais
próximos (``NEO_LIMIT``) são consultados um a um no ``lookup``, que devolve os
elementos orbitais. O resultado inteiro fica em cache por ``NEO_TTL_MINUTES``.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from atlas.ext import cache
from atlas.ext.config import Settings
from atlas.ext.nasa import NasaError, NasaGateway
from atlas.neo.schemas import NeoWeekOut


def _f(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def clean_name(name: str) -> str:
    name = (name or "").strip()
    return name[1:-1] if name.startswith("(") and name.endswith(")") else name


def elements_from_orbital_data(data: dict[str, Any] | None) -> dict[str, float] | None:
    if not data:
        return None
    values = {
        "epoch_jd": _f(data.get("epoch_osculation")),
        "a": _f(data.get("semi_major_axis")),
        "e": _f(data.get("eccentricity")),
        "i": _f(data.get("inclination")),
        "om": _f(data.get("ascending_node_longitude")),
        "w": _f(data.get("perihelion_argument")),
        "ma": _f(data.get("mean_anomaly")),
        "n": _f(data.get("mean_motion")),
    }
    if any(v is None for v in values.values()) or values["e"] >= 1:
        return None
    return values


def _closest_approach(neo: dict[str, Any]) -> dict[str, Any] | None:
    approaches = [
        a for a in neo.get("close_approach_data") or [] if a.get("orbiting_body") == "Earth"
    ]
    return min(
        approaches,
        key=lambda a: _f((a.get("miss_distance") or {}).get("kilometers")) or float("inf"),
        default=None,
    )


def summarize(neo: dict[str, Any]) -> dict[str, Any] | None:
    approach = _closest_approach(neo)
    if approach is None:
        return None
    miss = approach.get("miss_distance") or {}
    speed = approach.get("relative_velocity") or {}
    diameter = (neo.get("estimated_diameter") or {}).get("meters") or {}
    return {
        "id": str(neo.get("id")),
        "name": clean_name(neo.get("name", "")),
        "hazardous": bool(neo.get("is_potentially_hazardous_asteroid")),
        "diameter_min_m": _f(diameter.get("estimated_diameter_min")),
        "diameter_max_m": _f(diameter.get("estimated_diameter_max")),
        "absolute_magnitude": _f(neo.get("absolute_magnitude_h")),
        "approach_date": approach.get("close_approach_date_full")
        or approach.get("close_approach_date", ""),
        "approach_epoch_ms": approach.get("epoch_date_close_approach"),
        "miss_distance_km": _f(miss.get("kilometers")) or 0.0,
        "miss_distance_lunar": _f(miss.get("lunar")) or 0.0,
        "velocity_km_s": _f(speed.get("kilometers_per_second")) or 0.0,
        "jpl_url": neo.get("nasa_jpl_url"),
        "orbit_class": None,
        "elements": None,
    }


async def _build_week(nasa: NasaGateway, start: date, end: date, limit: int) -> dict[str, Any]:
    feed = await nasa.neows.feed(start, end)
    everything = [neo for day in feed["near_earth_objects"].values() for neo in day]
    summaries = [s for s in (summarize(n) for n in everything) if s]
    summaries.sort(key=lambda s: s["miss_distance_km"])
    chosen = summaries[:limit]

    details = await asyncio.gather(
        *(nasa.neows.lookup(s["id"]) for s in chosen), return_exceptions=True
    )
    for summary, detail in zip(chosen, details, strict=True):
        if isinstance(detail, NasaError):
            continue
        if isinstance(detail, BaseException):
            raise detail
        orbital = detail.get("orbital_data") or {}
        summary["elements"] = elements_from_orbital_data(orbital)
        summary["orbit_class"] = (orbital.get("orbit_class") or {}).get("orbit_class_type")

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_in_week": int(feed.get("element_count") or len(everything)),
        "objects": chosen,
    }


async def get_week(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, *, start: date | None = None
) -> NeoWeekOut:
    start = start or datetime.now(UTC).date()
    end = start + timedelta(days=6)
    cached = await cache.remember(
        session,
        f"neo:week:{start.isoformat()}:{settings.neo_limit}",
        timedelta(minutes=settings.neo_ttl_minutes),
        lambda: _build_week(nasa, start, end, settings.neo_limit),
        source="NASA NeoWs",
    )
    return NeoWeekOut(**cached.payload, fetched_at=cached.fetched_at, stale=cached.stale)

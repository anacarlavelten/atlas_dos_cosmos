"""Estrelas com exoplanetas confirmados (NASA Exoplanet Archive).

Cada linha da tabela ``pscomppars`` é um planeta. Agrupamos por estrela, convertemos
a posição para coordenadas galácticas e a distância de parsecs para anos-luz, para
que o mapa da Via Láctea desenhe cada sistema no lugar certo em relação ao Sol.
"""

from __future__ import annotations

from collections import Counter
from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from atlas.exoplanets.astro import PARSEC_LY, equatorial_to_galactic
from atlas.exoplanets.schemas import ExoplanetHostsOut
from atlas.ext import cache
from atlas.ext.config import Settings
from atlas.ext.nasa import NasaGateway


def group_hosts(rows: list[dict[str, Any]]) -> dict[str, Any]:
    hosts: dict[str, dict[str, Any]] = {}
    methods: Counter[str] = Counter()
    for row in rows:
        name, ra, dec, dist = row.get("hostname"), row.get("ra"), row.get("dec"), row.get("sy_dist")
        if not name or ra is None or dec is None or not dist:
            continue
        methods[row.get("discoverymethod") or "Outro"] += 1
        host = hosts.get(name)
        if host is None:
            lon, lat = equatorial_to_galactic(float(ra), float(dec))
            host = hosts[name] = {
                "name": name,
                "distance_ly": round(float(dist) * PARSEC_LY, 2),
                "l": round(lon, 3),
                "b": round(lat, 3),
                "planet_names": [],
            }
        host["planet_names"].append(row.get("pl_name") or "?")

    ordered = sorted(hosts.values(), key=lambda h: h["distance_ly"])
    for host in ordered:
        host["planets"] = len(host["planet_names"])
    return {
        "total_planets": sum(h["planets"] for h in ordered),
        "total_hosts": len(ordered),
        "nearest": [{**h, "planet_names": sorted(h["planet_names"])[:8]} for h in ordered[:8]],
        "by_method": dict(methods.most_common()),
        "hosts": [[h["l"], h["b"], h["distance_ly"], h["planets"]] for h in ordered],
    }


async def get_hosts(
    session: AsyncSession, nasa: NasaGateway, settings: Settings
) -> ExoplanetHostsOut:
    async def produce() -> dict[str, Any]:
        return group_hosts(await nasa.exoplanets.planets_with_hosts())

    cached = await cache.remember(
        session,
        "exoplanets:hosts",
        timedelta(days=settings.exoplanets_ttl_days),
        produce,
        source="NASA Exoplanet Archive",
    )
    return ExoplanetHostsOut(**cached.payload, fetched_at=cached.fetched_at, stale=cached.stale)

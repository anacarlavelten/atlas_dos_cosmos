"""Blog do Atlas: transforma as respostas das APIs abertas no formato que a tela
do blog usa e guarda tudo no cache persistente (ver ``ext/cache``).

Os *tópicos* e as *áreas* abaixo não são conteúdo: são apenas filtros (palavras
buscadas nas APIs). Todo texto exibido no blog vem das próprias APIs.
"""

from __future__ import annotations

import html
import re
from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from atlas.blog.schemas import FeedOut, LaunchesOut, TechListOut
from atlas.ext import cache
from atlas.ext.config import Settings
from atlas.ext.nasa import NasaGateway

KINDS: dict[str, str] = {
    "articles": "Notícias",
    "blogs": "Blogs",
    "reports": "Relatórios",
}

#: chave -> (rótulo, descrição, termos buscados no título). A busca da SNAPI
#: compara trechos de texto, então evitamos siglas curtas ("AI" casaria "Lai").
TOPICS: dict[str, tuple[str, str, list[str]]] = {
    "tudo": ("Tudo", "Todas as publicações, da mais recente para a mais antiga.", []),
    "tecnologia": (
        "Tecnologia",
        "Propulsão, robótica, novos materiais, inteligência artificial e protótipos.",
        [
            "technology",
            "propulsion",
            "robot",
            "artificial intelligence",
            "nuclear",
            "laser",
            "quantum",
            "3D print",
            "engine",
            "prototype",
            "experimental",
            "manufacturing",
            "refuel",
            "reusable",
        ],
    ),
    "lancamentos": (
        "Lançamentos",
        "Foguetes, testes estáticos e janelas de lançamento.",
        ["launch", "rocket", "starship", "falcon", "booster", "liftoff", "new glenn", "ariane"],
    ),
    "lua-marte": (
        "Lua e Marte",
        "Programa Artemis, módulos lunares e missões a Marte.",
        ["moon", "lunar", "artemis", "mars", "martian"],
    ),
    "astronomia": (
        "Astronomia",
        "Telescópios, galáxias, exoplanetas, buracos negros e o Sistema Solar.",
        [
            "telescope",
            "webb",
            "hubble",
            "galaxy",
            "galaxies",
            "exoplanet",
            "black hole",
            "asteroid",
            "comet",
            "supernova",
            "jupiter",
            "saturn",
            "solar",
        ],
    ),
    "astronautas": (
        "Astronautas",
        "Estações espaciais, caminhadas no espaço e voos tripulados.",
        ["space station", "astronaut", "spacewalk", "crew", "tiangong", "cosmonaut"],
    ),
}

#: chave -> (rótulo, descrição, termo buscado no catálogo Technology Transfer).
TECH_AREAS: dict[str, tuple[str, str, str]] = {
    "propulsao": ("Propulsão", "Motores e sistemas de propulsão.", "propulsion"),
    "robotica": ("Robótica", "Robôs, automação e sistemas autônomos.", "robot"),
    "materiais": ("Materiais", "Ligas, compósitos e revestimentos.", "composite"),
    "sensores": ("Sensores", "Instrumentos e detectores.", "sensor"),
    "energia": ("Energia", "Baterias, painéis solares e geração de energia.", "battery"),
    "saude": ("Saúde", "Tecnologias médicas nascidas no programa espacial.", "medical"),
}

LAUNCH_PAGE = "https://spacelaunchnow.me/launch"

_APPEARED_FIRST = re.compile(r"\s*The post .*? appeared first on .*$", re.S)


class UnknownOption(ValueError):
    """Tópico, tipo de publicação ou área de tecnologia inexistente."""


def topics() -> dict[str, Any]:
    return {
        "kinds": [{"key": k, "label": v} for k, v in KINDS.items()],
        "topics": [{"key": k, "label": v[0], "description": v[1]} for k, v in TOPICS.items()],
        "tech_areas": [
            {"key": k, "label": v[0], "description": v[1]} for k, v in TECH_AREAS.items()
        ],
    }


def clean_summary(text: str | None) -> str:
    """Remove o rodapé automático dos feeds WordPress e espaços repetidos."""
    text = _APPEARED_FIRST.sub("", html.unescape(text or "").strip())
    return re.sub(r"\s+", " ", text).strip()


def shape_post(raw: dict[str, Any], kind: str) -> dict[str, Any]:
    return {
        "id": int(raw.get("id") or 0),
        "kind": kind,
        "title": html.unescape(raw.get("title") or "").strip(),
        "summary": clean_summary(raw.get("summary")),
        "url": raw.get("url") or "",
        "image_url": raw.get("image_url") or None,
        "news_site": raw.get("news_site") or "",
        "authors": [a.get("name") for a in raw.get("authors") or [] if a.get("name")],
        "published_at": raw.get("published_at") or "",
        "featured": bool(raw.get("featured")),
        "launches": len(raw.get("launches") or []),
        "events": len(raw.get("events") or []),
    }


def normalize_query(query: str | None) -> str | None:
    query = re.sub(r"\s+", " ", query or "").strip()[:80]
    return query or None


async def get_feed(
    session: AsyncSession,
    nasa: NasaGateway,
    settings: Settings,
    *,
    kind: str = "articles",
    topic: str = "tudo",
    query: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> FeedOut:
    if kind not in KINDS:
        raise UnknownOption(f"Tipo de publicação '{kind}' não existe.")
    if topic not in TOPICS:
        raise UnknownOption(f"Tópico '{topic}' não existe.")
    query = normalize_query(query)
    terms = TOPICS[topic][2]

    async def produce() -> dict[str, Any]:
        data = await nasa.news.list(
            kind, limit=limit, offset=offset, title_terms=terms or None, search=query
        )
        posts = [shape_post(item, kind) for item in data.get("results") or []]
        return {"total": int(data.get("count") or 0), "posts": [p for p in posts if p["title"]]}

    cached = await cache.remember(
        session,
        f"blog:{kind}:{topic}:{(query or '').lower()}:{offset}:{limit}",
        timedelta(minutes=settings.news_ttl_minutes),
        produce,
        source="Spaceflight News API",
    )
    total = cached.payload["total"]
    return FeedOut(
        kind=kind,
        topic=topic,
        query=query,
        total=total,
        offset=offset,
        limit=limit,
        has_more=offset + limit < total,
        posts=cached.payload["posts"],
        fetched_at=cached.fetched_at,
        stale=cached.stale,
    )


def _dig(obj: Any, *path: str) -> Any:
    for key in path:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(key)
    return obj


def shape_launch(raw: dict[str, Any]) -> dict[str, Any]:
    image = raw.get("image")
    image_url = (
        (image.get("thumbnail_url") or image.get("image_url")) if isinstance(image, dict) else image
    )
    slug = raw.get("slug")
    return {
        "id": str(raw.get("id") or ""),
        "name": raw.get("name") or "",
        "net": raw.get("net"),
        "net_precision": _dig(raw, "net_precision", "name"),
        "status": _dig(raw, "status", "name"),
        "status_abbrev": _dig(raw, "status", "abbrev"),
        "provider": _dig(raw, "launch_service_provider", "name"),
        "rocket": _dig(raw, "rocket", "configuration", "full_name")
        or _dig(raw, "rocket", "configuration", "name"),
        "mission": _dig(raw, "mission", "name"),
        "mission_type": _dig(raw, "mission", "type"),
        "orbit": _dig(raw, "mission", "orbit", "name"),
        "pad": _dig(raw, "pad", "name"),
        "location": _dig(raw, "pad", "location", "name"),
        "image_url": image_url if isinstance(image_url, str) else None,
        # Space Launch Now é o site público da The Space Devs (mesma base de dados).
        "page_url": f"{LAUNCH_PAGE}/{slug}" if slug else LAUNCH_PAGE,
    }


async def get_launches(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, limit: int = 6
) -> LaunchesOut:
    async def produce() -> list[dict[str, Any]]:
        return [shape_launch(item) for item in await nasa.launches.upcoming(limit)]

    cached = await cache.remember(
        session,
        f"blog:launches:{limit}",
        timedelta(minutes=settings.launches_ttl_minutes),
        produce,
        source="Launch Library 2",
    )
    return LaunchesOut(launches=cached.payload, fetched_at=cached.fetched_at, stale=cached.stale)


async def get_technologies(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, area: str, limit: int = 4
) -> TechListOut:
    if area not in TECH_AREAS:
        raise UnknownOption(f"Área '{area}' não existe.")
    term = TECH_AREAS[area][2]

    async def produce() -> list[dict[str, Any]]:
        return await nasa.techtransfer.search("patent", term, limit=limit)

    cached = await cache.remember(
        session,
        f"blog:tech:{area}:{limit}",
        timedelta(hours=settings.tech_ttl_hours),
        produce,
        source="NASA Technology Transfer",
    )
    return TechListOut(
        area=area, items=cached.payload, fetched_at=cached.fetched_at, stale=cached.stale
    )

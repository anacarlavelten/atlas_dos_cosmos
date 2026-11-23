"""Imagens da NASA: foto astronômica do dia (APOD), fotos de cada astro (NASA
Image and Video Library) e a Terra inteira vista pela câmera EPIC."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from atlas.catalog.services import get_body
from atlas.ext import cache
from atlas.ext.config import Settings
from atlas.ext.nasa import NasaGateway
from atlas.ext.nasa.apod import is_apod_payload
from atlas.ext.nasa.http import NasaError, NasaRateLimited
from atlas.media.schemas import ApodOut, BirthImagesOut, BodyImagesOut, EpicOut

log = logging.getLogger("atlas.media")


def apod_page_url(day: str) -> str:
    d = date.fromisoformat(day)
    return f"https://apod.nasa.gov/apod/ap{d:%y%m%d}.html"


def shape_apod(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "date": data.get("date", ""),
        "title": data.get("title", ""),
        "explanation": data.get("explanation", ""),
        "media_type": data.get("media_type", "image"),
        "url": data.get("url"),
        "hdurl": data.get("hdurl"),
        "thumbnail_url": data.get("thumbnail_url"),
        "copyright": (data.get("copyright") or "").strip() or None,
        "page_url": data.get("page_url")
        or (apod_page_url(data["date"]) if data.get("date") else "https://apod.nasa.gov"),
    }


_MONTHS = (
    "January February March April May June July August September October November December"
).split()


async def apod_from_news(nasa: NasaGateway, day: date) -> dict[str, Any] | None:
    """Plano B quando a NASA está fora do ar: a Spaceflight News API republica a APOD
    de cada dia com o título "APOD: 2026 November 16 – <título>", a imagem e o
    link oficial no science.nasa.gov. O texto explicativo não vem junto."""
    prefix = f"APOD: {day.year} {_MONTHS[day.month - 1]} {day.day}"
    try:
        data = await nasa.news.list("articles", limit=5, title_terms=[prefix])
    except NasaError:
        return None
    for item in data.get("results") or []:
        title = (item.get("title") or "").strip()
        rest = title.removeprefix(prefix)
        if rest == title or not item.get("image_url") or rest[:1] not in {" ", "–", "-", ":"}:
            continue
        clean_title = rest.lstrip(" –-:").strip()
        if not clean_title:
            continue
        log.info("APOD de %s obtida pela Spaceflight News API (NASA indisponível)", day)
        return {
            "date": day.isoformat(),
            "title": clean_title,
            "explanation": "",
            "media_type": "image",
            "url": item["image_url"],
            "hdurl": item["image_url"],
            "page_url": item.get("url"),
        }
    return None


async def get_apod(
    session: AsyncSession,
    nasa: NasaGateway,
    settings: Settings,
    day: date | None = None,
) -> ApodOut:
    target_day = day or datetime.now(UTC).date()

    async def produce() -> dict[str, Any]:
        try:
            return shape_apod(await nasa.apod.picture(target_day if day else None))
        except NasaRateLimited:
            raise
        except NasaError:
            republished = await apod_from_news(nasa, target_day)
            if republished is None:
                raise
            return shape_apod(republished)

    cached = await cache.remember(
        session,
        f"apod:{target_day.isoformat()}",
        timedelta(minutes=settings.apod_ttl_minutes),
        produce,
        source="NASA APOD",
        validate=lambda payload: is_apod_payload(payload, day),
    )
    return ApodOut(**cached.payload, fetched_at=cached.fetched_at, stale=cached.stale)


async def get_body_images(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, slug: str, limit: int = 4
) -> BodyImagesOut:
    body = await get_body(session, slug)
    query = body.image_query or body.name

    async def produce() -> list[dict[str, Any]]:
        return await nasa.images.search(query, limit=limit)

    cached = await cache.remember(
        session,
        f"images:{slug}:{limit}",
        timedelta(days=settings.images_ttl_days),
        produce,
        source="NASA Image and Video Library",
    )
    return BodyImagesOut(
        slug=slug,
        query=query,
        images=cached.payload,
        fetched_at=cached.fetched_at,
        stale=cached.stale,
    )


async def get_birth_images(
    session: AsyncSession, nasa: NasaGateway, settings: Settings, year: int
) -> BirthImagesOut:
    async def produce() -> list[dict[str, Any]]:
        return await nasa.images.search_by_year(year, limit=40)

    cached = await cache.remember(
        session,
        f"birth-images:{year}",
        timedelta(days=settings.images_ttl_days),
        produce,
        source="NASA Image and Video Library",
    )
    return BirthImagesOut(
        year=year,
        images=cached.payload,
        fetched_at=cached.fetched_at,
        stale=cached.stale,
    )


async def get_epic(session: AsyncSession, nasa: NasaGateway, settings: Settings) -> EpicOut:
    async def produce() -> list[dict[str, Any]]:
        items = await nasa.epic.latest_natural()
        out = []
        for item in items[:3]:
            centroid = item.get("centroid_coordinates") or {}
            out.append(
                {
                    "date": item.get("date", ""),
                    "caption": item.get("caption", ""),
                    "image_url": nasa.epic.image_url(item, "png"),
                    "thumbnail_url": nasa.epic.image_url(item, "jpg"),
                    "centroid_lat": centroid.get("lat"),
                    "centroid_lon": centroid.get("lon"),
                }
            )
        return out

    cached = await cache.remember(
        session,
        "epic:latest",
        timedelta(minutes=settings.epic_ttl_minutes),
        produce,
        source="NASA EPIC",
    )
    return EpicOut(images=cached.payload, fetched_at=cached.fetched_at, stale=cached.stale)

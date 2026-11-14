"""Imagens da NASA: foto astronômica do dia (APOD), fotos de cada astro (NASA
Image and Video Library) e a Terra inteira vista pela câmera EPIC."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from atlas.catalog.services import get_body
from atlas.ext import cache
from atlas.ext.config import Settings
from atlas.ext.nasa import NasaGateway
from atlas.ext.nasa.apod import is_apod_payload
from atlas.media.schemas import ApodOut, BirthImagesOut, BodyImagesOut, EpicOut


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
        "page_url": apod_page_url(data["date"]) if data.get("date") else "https://apod.nasa.gov",
    }


async def get_apod(
    session: AsyncSession,
    nasa: NasaGateway,
    settings: Settings,
    day: date | None = None,
) -> ApodOut:
    target_day = day or datetime.now(UTC).date()

    async def produce() -> dict[str, Any]:
        return shape_apod(await nasa.apod.picture(target_day if day else None))

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
    body = await get_body(session, slug)  # levanta BodyNotFound se não existir
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

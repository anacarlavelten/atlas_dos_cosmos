from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ApodOut(BaseModel):
    date: str
    title: str
    explanation: str
    media_type: str
    url: str | None = None
    hdurl: str | None = None
    thumbnail_url: str | None = None
    copyright: str | None = None
    page_url: str
    language: str = "en"
    fetched_at: datetime
    stale: bool = False


class NasaImageOut(BaseModel):
    nasa_id: str
    title: str
    description: str
    date_created: str | None = None
    center: str | None = None
    thumbnail: str
    page_url: str


class BodyImagesOut(BaseModel):
    slug: str
    query: str
    images: list[NasaImageOut]
    fetched_at: datetime
    stale: bool = False


class EpicImageOut(BaseModel):
    date: str
    caption: str
    image_url: str
    thumbnail_url: str
    centroid_lat: float | None = None
    centroid_lon: float | None = None


class EpicOut(BaseModel):
    images: list[EpicImageOut]
    fetched_at: datetime
    stale: bool = False

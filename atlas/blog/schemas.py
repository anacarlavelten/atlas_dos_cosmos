from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class OptionOut(BaseModel):
    key: str
    label: str
    description: str = ""


class TopicsOut(BaseModel):
    kinds: list[OptionOut]
    topics: list[OptionOut]
    tech_areas: list[OptionOut]


class PostOut(BaseModel):
    id: int
    kind: str
    title: str
    summary: str
    url: str
    image_url: str | None = None
    news_site: str
    authors: list[str]
    published_at: str
    featured: bool = False
    launches: int = 0
    events: int = 0


class FeedOut(BaseModel):
    kind: str
    topic: str
    query: str | None = None
    total: int
    offset: int
    limit: int
    has_more: bool
    posts: list[PostOut]
    source: str = "Spaceflight News API"
    fetched_at: datetime
    stale: bool = False


class LaunchOut(BaseModel):
    id: str
    name: str
    net: str | None = None
    net_precision: str | None = None
    status: str | None = None
    status_abbrev: str | None = None
    provider: str | None = None
    rocket: str | None = None
    mission: str | None = None
    mission_type: str | None = None
    orbit: str | None = None
    pad: str | None = None
    location: str | None = None
    image_url: str | None = None
    page_url: str


class LaunchesOut(BaseModel):
    launches: list[LaunchOut]
    source: str = "Launch Library 2 (The Space Devs)"
    fetched_at: datetime
    stale: bool = False


class TechOut(BaseModel):
    id: str
    code: str
    title: str
    summary: str
    category: str | None = None
    center: str | None = None
    image_url: str | None = None
    page_url: str
    collection: str


class TechListOut(BaseModel):
    area: str
    items: list[TechOut]
    source: str = "NASA Technology Transfer"
    fetched_at: datetime
    stale: bool = False

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class FlareOut(BaseModel):
    class_type: str
    begin_time: str | None = None
    peak_time: str | None = None
    active_region: int | None = None
    source_location: str | None = None
    link: str | None = None


class FlaresOut(BaseModel):
    start: date
    end: date
    count: int
    by_class: dict[str, int]
    strongest: FlareOut | None = None
    recent: list[FlareOut]
    source: str = "NASA DONKI"
    fetched_at: datetime
    stale: bool = False

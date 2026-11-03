from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

from atlas.orbits.schemas import ElementsOut


class NeoOut(BaseModel):
    id: str
    name: str
    hazardous: bool
    diameter_min_m: float | None = None
    diameter_max_m: float | None = None
    absolute_magnitude: float | None = None
    approach_date: str
    approach_epoch_ms: int | None = None
    miss_distance_km: float
    miss_distance_lunar: float
    velocity_km_s: float
    orbit_class: str | None = None
    jpl_url: str | None = None
    elements: ElementsOut | None = None


class NeoWeekOut(BaseModel):
    start: date
    end: date
    total_in_week: int
    objects: list[NeoOut]
    source: str = "NASA NeoWs"
    fetched_at: datetime
    stale: bool = False

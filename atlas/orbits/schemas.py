from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ElementsOut(BaseModel):
    epoch_jd: float = Field(description="Época dos elementos (data juliana, TDB)")
    a: float = Field(description="Semieixo maior (UA)")
    e: float = Field(description="Excentricidade")
    i: float = Field(description="Inclinação em relação à eclíptica (°)")
    om: float = Field(description="Longitude do nó ascendente Ω (°)")
    w: float = Field(description="Argumento do periélio ω (°)")
    ma: float = Field(description="Anomalia média na época (°)")
    n: float = Field(description="Movimento médio (°/dia)")


class BodyOrbitOut(BaseModel):
    slug: str
    center: str = Field(description="Astro em torno do qual orbita (slug)")
    source: str = Field(description="JPL Horizons, JPL SBDB ou 'aproximado'")
    fetched_at: datetime | None = None
    elements: ElementsOut


class SpacecraftOut(BaseModel):
    slug: str
    source: str
    fetched_at: datetime | None = None
    epoch_jd: float
    position: list[float] = Field(description="x, y, z eclípticos heliocêntricos (UA)")
    velocity: list[float] = Field(description="vx, vy, vz (UA/dia)")


class OrbitsOut(BaseModel):
    generated_at: datetime
    bodies: list[BodyOrbitOut]
    spacecraft: list[SpacecraftOut]
    warnings: list[str] = []


class RefreshReport(BaseModel):
    updated: list[str]
    failed: dict[str, str]

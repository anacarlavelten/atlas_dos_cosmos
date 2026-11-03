from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class HostStarOut(BaseModel):
    name: str
    distance_ly: float
    planets: int
    planet_names: list[str]
    l: float  # noqa: E741 - longitude galáctica (nome usado na astronomia)
    b: float


class ExoplanetHostsOut(BaseModel):
    total_planets: int
    total_hosts: int
    nearest: list[HostStarOut] = Field(description="As estrelas com planetas mais próximas do Sol")
    by_method: dict[str, int] = Field(description="Planetas por método de descoberta")
    hosts: list[list[float]] = Field(
        description="Todas as estrelas, em formato compacto: [l (°), b (°), distância (anos-luz), nº de planetas]"
    )
    source: str = "NASA Exoplanet Archive"
    fetched_at: datetime
    stale: bool = False

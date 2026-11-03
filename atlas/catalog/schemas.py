"""Esquemas Pydantic: definem (e documentam no /api/docs) o formato JSON que a
API devolve. Separam o modelo do banco (``models.py``) da representação HTTP."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class LevelOut(BaseModel):
    level: int
    name: str
    unit: str
    description: str


class FactOut(BaseModel):
    label: str
    value: str


class ActionOut(BaseModel):
    label: str
    level: int


class NasaIdsOut(BaseModel):
    horizons: str | None = None
    sbdb: str | None = None
    images: str | None = None


class BodyOut(BaseModel):
    slug: str
    level: int
    category: str
    group: str
    name: str
    kind: str
    summary: str
    curiosity: str | None = None
    color: str | None = None
    parent: str | None = None
    facts: list[FactOut]
    render: dict[str, Any]
    action: ActionOut | None = None
    live: list[str]
    nasa: NasaIdsOut

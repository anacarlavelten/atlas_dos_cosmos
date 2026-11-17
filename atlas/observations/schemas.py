"""Esquemas Pydantic do Diário de observação.

``ObservationIn`` é o "formulário" do lado do servidor: cada campo tem tipo,
tamanho e faixa de valores, e os validadores abaixo cobrem as regras que não cabem
em ``Field`` (data no futuro, texto sem letras). Se algo falhar, o FastAPI devolve
HTTP 422 e ``ext/web`` traduz os erros para português, campo a campo.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Instrument = Literal["olho-nu", "binoculo", "telescopio", "camera"]

#: A data mínima aceita (registros históricos são permitidos, datas absurdas não).
MIN_DATE = date(1900, 1, 1)


def latest_allowed_date() -> date:
    """Hoje em UTC + 1 dia: quem está a leste de Greenwich já pode estar no "amanhã" UTC."""
    return datetime.now(UTC).date() + timedelta(days=1)


class ObservationIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    body_slug: str = Field(min_length=1, max_length=60, description="slug do astro no catálogo")
    observer_name: str = Field(min_length=2, max_length=80)
    observed_at: date
    location: str = Field(min_length=2, max_length=120)
    instrument: Instrument
    sky_quality: int = Field(ge=1, le=5, description="1 = céu ruim, 5 = céu excelente")
    notes: str = Field(default="", max_length=1000)

    @field_validator("observed_at")
    @classmethod
    def _date_in_range(cls, value: date) -> date:
        if value < MIN_DATE:
            raise ValueError("Use uma data a partir de 01/01/1900.")
        if value > latest_allowed_date():
            raise ValueError("A data da observação não pode estar no futuro.")
        return value

    @field_validator("observer_name", "location")
    @classmethod
    def _has_letters(cls, value: str) -> str:
        if not any(char.isalpha() for char in value):
            raise ValueError("Use letras, não apenas números ou símbolos.")
        return " ".join(value.split())


class ObservationBodyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    category: str
    kind: str


class ObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body: ObservationBodyOut
    observer_name: str
    observed_at: date
    location: str
    instrument: Instrument
    instrument_label: str
    sky_quality: int
    notes: str
    created_at: datetime


class ObservationCreatedOut(ObservationOut):
    #: Código para apagar a observação. Só aparece nesta resposta.
    delete_token: str


class ObservationListOut(BaseModel):
    total: int
    offset: int
    limit: int
    items: list[ObservationOut]


class OptionOut(BaseModel):
    key: str
    label: str


class ObservationOptionsOut(BaseModel):
    instruments: list[OptionOut]
    sky_quality: list[OptionOut]
    min_date: date
    max_date: date

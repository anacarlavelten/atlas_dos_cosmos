from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from atlas.ext.db import Base

if TYPE_CHECKING:
    from atlas.catalog.models import Body

INSTRUMENTS: dict[str, str] = {
    "olho-nu": "A olho nu",
    "binoculo": "Binóculo",
    "telescopio": "Telescópio",
    "camera": "Câmera / astrofotografia",
}


class Observation(Base):
    """Uma observação do céu registrada por um visitante pelo formulário do blog.

    Cada observação aponta para um astro do catálogo (``bodies``). A integridade é
    garantida em duas camadas: o Pydantic valida a entrada na API e as restrições
    ``CHECK`` abaixo impedem valores inválidos mesmo se alguém gravar direto no banco.
    """

    __tablename__ = "observations"
    __table_args__ = (
        CheckConstraint("sky_quality BETWEEN 1 AND 5", name="ck_observations_sky_quality"),
        CheckConstraint(
            "instrument IN ({})".format(", ".join(f"'{key}'" for key in INSTRUMENTS)),
            name="ck_observations_instrument",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    body_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bodies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    observer_name: Mapped[str] = mapped_column(String(80), nullable=False)
    observed_at: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    instrument: Mapped[str] = mapped_column(String(20), nullable=False)
    #: Qualidade do céu de 1 (muito poluído/nublado) a 5 (céu escuro e limpo).
    sky_quality: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    #: Hash SHA-256 do código que permite apagar o registro. O código em si só é
    #: entregue a quem criou a observação (o navegador dele o guarda).
    delete_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    body: Mapped[Body] = relationship(back_populates="observations", lazy="joined")

    @property
    def instrument_label(self) -> str:
        return INSTRUMENTS.get(self.instrument, self.instrument)

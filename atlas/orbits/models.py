from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from atlas.ext.db import Base

if TYPE_CHECKING:
    from atlas.catalog.models import Body


# === OrbitalElements (órbita de um astro, vinda do JPL) ===
class OrbitalElements(Base):
    """Elementos orbitais osculadores numa época. Com eles o frontend calcula a
    posição do astro em qualquer data pela equação de Kepler."""

    __tablename__ = "orbital_elements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    body_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("bodies.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ======================================================
    # ORIGEM
    # ======================================================
    #: "JPL Horizons" ou "JPL SBDB"
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    #: Centro de referência (ex.: "500@10" = Sol, "500@599" = Júpiter).
    center: Mapped[str] = mapped_column(String(30), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # ======================================================
    # ELEMENTOS (UA, graus, dias)
    # ======================================================
    epoch_jd: Mapped[float] = mapped_column(Float, nullable=False)
    a: Mapped[float] = mapped_column(Float, nullable=False)  # semieixo maior (UA)
    e: Mapped[float] = mapped_column(Float, nullable=False)  # excentricidade
    i: Mapped[float] = mapped_column(Float, nullable=False)  # inclinação (°)
    om: Mapped[float] = mapped_column(Float, nullable=False)  # longitude do nó ascendente Ω (°)
    w: Mapped[float] = mapped_column(Float, nullable=False)  # argumento do periélio ω (°)
    ma: Mapped[float] = mapped_column(Float, nullable=False)  # anomalia média na época (°)
    n: Mapped[float] = mapped_column(Float, nullable=False)  # movimento médio (°/dia)

    body: Mapped[Body] = relationship("Body", back_populates="orbit")

    def as_dict(self) -> dict[str, float]:
        return {k: getattr(self, k) for k in ("epoch_jd", "a", "e", "i", "om", "w", "ma", "n")}

    def __repr__(self) -> str:
        return f"<OrbitalElements body_id={self.body_id} source='{self.source}' a={self.a:.4f}>"

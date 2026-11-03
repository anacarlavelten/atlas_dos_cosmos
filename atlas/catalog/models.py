from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from atlas.ext.db import Base

if TYPE_CHECKING:
    from atlas.orbits.models import OrbitalElements


# === Body (astro do catálogo) ===
class Body(Base):
    __tablename__ = "bodies"

    # ======================================================
    # IDENTIFICAÇÃO
    # ======================================================
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), nullable=False, unique=True, index=True)

    # ======================================================
    # CLASSIFICAÇÃO
    # ======================================================
    #: 1 = Sistema Solar, 2 = Via Láctea, 3 = Universo
    level: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    #: star, planet, moon, dwarf, comet, probe, region, neo, galaxy, arm, ...
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    #: Grupo exibido na lista lateral (ex.: "Planetas", "Nebulosas").
    list_group: Mapped[str] = mapped_column(String(60), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ======================================================
    # CONTEÚDO DIDÁTICO (exibido no card)
    # ======================================================
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    curiosity: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(9))

    # ======================================================
    # HIERARQUIA (lua -> planeta)
    # ======================================================
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bodies.id", ondelete="SET NULL"), index=True
    )

    # ======================================================
    # IDENTIFICADORES NAS APIs DA NASA
    # ======================================================
    #: COMMAND do JPL Horizons (ex.: "499" = Marte, "-31" = Voyager 1).
    horizons_id: Mapped[str | None] = mapped_column(String(20))
    #: Busca no JPL Small-Body Database (ex.: "Ceres", "1P").
    sbdb_id: Mapped[str | None] = mapped_column(String(40))
    #: Termo de busca na NASA Image and Video Library.
    image_query: Mapped[str | None] = mapped_column(String(120))

    # ======================================================
    # PARÂMETROS DE CENA E EXTRAS
    # ======================================================
    #: Dados que o motor 3D usa para desenhar o astro (raio, textura, l/b/d...).
    render: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    #: Botão de ação do card, ex.: {"label": "Ver o Sol na Via Láctea", "level": 2}.
    action: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    #: Painéis com dados ao vivo no card: "flares", "epic", "neos", "exoplanets".
    live: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    # ======================================================
    # AUDITORIA
    # ======================================================
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # ------------------------------------------------------
    # RELACIONAMENTOS
    # ------------------------------------------------------
    parent: Mapped[Body | None] = relationship("Body", remote_side=[id], back_populates="children")
    children: Mapped[list[Body]] = relationship("Body", back_populates="parent")

    facts: Mapped[list[BodyFact]] = relationship(
        "BodyFact",
        back_populates="body",
        cascade="all, delete-orphan",
        order_by="BodyFact.position",
    )

    orbit: Mapped[OrbitalElements | None] = relationship(
        "OrbitalElements",
        back_populates="body",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Body id={self.id} slug='{self.slug}' level={self.level} category='{self.category}'>"
        )


# === BodyFact (linha da tabela de dados do card) ===
class BodyFact(Base):
    __tablename__ = "body_facts"
    __table_args__ = (UniqueConstraint("body_id", "position", name="uq_body_fact_position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    body_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bodies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)

    body: Mapped[Body] = relationship("Body", back_populates="facts")

    def __repr__(self) -> str:
        return f"<BodyFact body_id={self.body_id} label='{self.label}'>"

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from atlas.ext.db import Base

if TYPE_CHECKING:
    from atlas.observations.models import Observation
    from atlas.orbits.models import OrbitalElements


class Body(Base):
    __tablename__ = "bodies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), nullable=False, unique=True, index=True)

    #: 1 = Sistema Solar, 2 = Via Láctea, 3 = Universo
    level: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    list_group: Mapped[str] = mapped_column(String(60), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    curiosity: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(9))

    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bodies.id", ondelete="SET NULL"), index=True
    )

    #: COMMAND do JPL Horizons (ex.: "499" = Marte, "-31" = Voyager 1).
    horizons_id: Mapped[str | None] = mapped_column(String(20))
    sbdb_id: Mapped[str | None] = mapped_column(String(40))
    image_query: Mapped[str | None] = mapped_column(String(120))

    render: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    action: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    live: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

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

    observations: Mapped[list[Observation]] = relationship(
        "Observation",
        back_populates="body",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return (
            f"<Body id={self.id} slug='{self.slug}' level={self.level} category='{self.category}'>"
        )


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

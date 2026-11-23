from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from atlas.ext.db import Base


class CacheEntry(Base):
    __tablename__ = "cache_entries"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)

    payload: Mapped[Any] = mapped_column(JSON, nullable=False)
    source: Mapped[str] = mapped_column(String(60), nullable=False)

    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def __repr__(self) -> str:
        return f"<CacheEntry key='{self.key}' source='{self.source}' expires_at={self.expires_at}>"

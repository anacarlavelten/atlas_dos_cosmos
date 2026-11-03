"""DONKI — Space Weather Database Of Notifications, Knowledge, Information
(https://api.nasa.gov, exige chave). Usamos o endpoint de erupções solares (FLR)."""

from __future__ import annotations

from datetime import date
from typing import Any

from atlas.ext.nasa.http import KeyedClient


class DonkiClient(KeyedClient):
    service = "DONKI"

    async def flares(self, start: date, end: date) -> list[dict[str, Any]]:
        data = await self.get_json(
            self.url("DONKI/FLR"),
            self.keyed(startDate=start.isoformat(), endDate=end.isoformat()),
        )
        # O DONKI devolve corpo vazio quando não há eventos no período.
        return data if isinstance(data, list) else []

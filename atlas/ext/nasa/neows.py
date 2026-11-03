"""NeoWs — Near Earth Object Web Service (https://api.nasa.gov, exige chave).

``feed`` lista os asteroides que passam perto da Terra num intervalo de até 7
dias; ``lookup`` traz os detalhes de um objeto, incluindo os elementos orbitais.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from atlas.ext.nasa.http import KeyedClient, NasaError


class NeoWsClient(KeyedClient):
    service = "NeoWs"

    async def feed(self, start: date, end: date) -> dict[str, Any]:
        if (end - start).days > 7:
            raise ValueError("O NeoWs aceita no máximo 7 dias por consulta.")
        data = await self.get_json(
            self.url("neo/rest/v1/feed"),
            self.keyed(start_date=start.isoformat(), end_date=end.isoformat()),
        )
        if not isinstance(data, dict) or "near_earth_objects" not in data:
            raise NasaError(self.service, "resposta sem a lista de asteroides")
        return data

    async def lookup(self, neo_id: str) -> dict[str, Any]:
        data = await self.get_json(self.url(f"neo/rest/v1/neo/{neo_id}"), self.keyed())
        if not isinstance(data, dict):
            raise NasaError(self.service, f"objeto {neo_id} sem dados")
        return data

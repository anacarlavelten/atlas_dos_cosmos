"""APOD — Astronomy Picture of the Day (https://api.nasa.gov, exige chave)."""

from __future__ import annotations

from datetime import date
from typing import Any

from atlas.ext.nasa.http import KeyedClient, NasaError


class ApodClient(KeyedClient):
    service = "APOD"

    async def picture(self, day: date | None = None) -> dict[str, Any]:
        params = self.keyed(thumbs="true")
        if day:
            params["date"] = day.isoformat()
        data = await self.get_json(self.url("planetary/apod"), params)
        if not isinstance(data, dict) or "title" not in data:
            raise NasaError(self.service, "resposta sem a foto do dia")
        return data

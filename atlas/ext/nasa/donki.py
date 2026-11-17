"""DONKI — Space Weather Database Of Notifications, Knowledge, Information
(https://api.nasa.gov, exige chave). Usamos o endpoint de erupções solares (FLR)."""

from __future__ import annotations

from datetime import date
from typing import Any

from atlas.ext.nasa.http import KeyedClient, NasaError


class DonkiClient(KeyedClient):
    service = "DONKI"

    async def flares(self, start: date, end: date) -> list[dict[str, Any]]:
        try:
            data = await self.get_json(
                self.url("DONKI/FLR"),
                self.keyed(startDate=start.isoformat(), endDate=end.isoformat()),
            )
        except NasaError as exc:
            # Em nov/2026 a NASA passou a responder 404 neste endpoint (os outros do
            # DONKI seguem no ar). "Requisição recusada" daria a entender que o erro é
            # do Atlas; a mensagem abaixo diz o que de fato acontece.
            if exc.status == 404:
                raise NasaError(
                    self.service,
                    "o serviço de erupções solares da NASA está fora do ar (HTTP 404)",
                    404,
                ) from exc
            raise
        # O DONKI devolve corpo vazio quando não há eventos no período.
        return data if isinstance(data, list) else []

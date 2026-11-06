"""Launch Library 2 — The Space Devs (https://ll.thespacedevs.com, sem chave).

Agenda de lançamentos orbitais do mundo todo. O plano gratuito permite poucas
requisições por hora, por isso a resposta fica em cache no servidor.
"""

from __future__ import annotations

from typing import Any

from atlas.ext.nasa.http import NasaError, ServiceClient


class LaunchLibraryClient(ServiceClient):
    service = "Launch Library 2"

    async def upcoming(self, limit: int = 8) -> list[dict[str, Any]]:
        base = self.settings.launch_library_url.rstrip("/")
        data = await self.get_json(
            f"{base}/launches/upcoming/",
            {"limit": limit, "mode": "normal", "hide_recent_previous": "true"},
        )
        if not isinstance(data, dict) or "results" not in data:
            raise NasaError(self.service, "resposta sem a lista de lançamentos")
        return data["results"]

"""Spaceflight News API — SNAPI (https://api.spaceflightnewsapi.net, sem chave).

Agrega notícias, posts de blogs e relatórios de dezenas de sites de espaço
(NASA, ESA, SpaceNews, Spaceflight Now, Ars Technica...). Usamos as três
coleções: ``articles``, ``blogs`` e ``reports``.
"""

from __future__ import annotations

from typing import Any

from atlas.ext.nasa.http import NasaError, ServiceClient

KINDS = ("articles", "blogs", "reports")


class SpaceflightNewsClient(ServiceClient):
    service = "Spaceflight News API"

    async def list(
        self,
        kind: str,
        *,
        limit: int = 20,
        offset: int = 0,
        title_terms: list[str] | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        if kind not in KINDS:
            raise ValueError(f"coleção desconhecida: {kind}")
        params: dict[str, Any] = {"limit": limit, "offset": offset, "ordering": "-published_at"}
        if title_terms:
            params["title_contains_one"] = ",".join(title_terms)
        if search:
            params["search"] = search
        base = self.settings.spaceflight_news_url.rstrip("/")
        data = await self.get_json(f"{base}/{kind}/", params)
        if not isinstance(data, dict) or "results" not in data:
            raise NasaError(self.service, "resposta sem a lista de publicações")
        return data

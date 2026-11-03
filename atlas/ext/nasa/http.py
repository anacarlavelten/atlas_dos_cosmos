"""Base comum dos clientes da NASA: requisição com tentativas, limite de
concorrência e erros padronizados.

Importante: a chave da NASA vai na *query string* (``api_key=...``) apenas nas
chamadas que o backend faz. Ela nunca é devolvida ao navegador e as mensagens de
erro não incluem a URL completa.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

import httpx

if TYPE_CHECKING:
    from atlas.ext.nasa import NasaGateway


class NasaError(Exception):
    """Falha ao consultar um serviço da NASA (rede, HTTP ou formato inesperado)."""

    def __init__(self, service: str, message: str, status: int | None = None) -> None:
        super().__init__(f"{service}: {message}")
        self.service = service
        self.message = message
        self.status = status


class NasaRateLimited(NasaError):
    """A cota da chave da API foi excedida (HTTP 429)."""


class ServiceClient:
    """Cliente base. Cada subclasse define ``service`` (nome legível) e usa
    ``get_json``/``get_text`` para conversar com a API correspondente."""

    service = "NASA"
    #: Quantas tentativas extras em erros transitórios (timeout, 5xx).
    retries = 1

    def __init__(self, gateway: NasaGateway) -> None:
        self.gateway = gateway
        self.settings = gateway.settings
        self._sem = asyncio.Semaphore(gateway.settings.nasa_concurrency)

    @property
    def http(self) -> httpx.AsyncClient:
        return self.gateway.http

    async def _request(self, url: str, params: dict[str, Any] | None = None) -> httpx.Response:
        last_error = "sem resposta"
        for attempt in range(self.retries + 1):
            try:
                async with self._sem:
                    response = await self.http.get(url, params=params)
            except httpx.TimeoutException:
                last_error = "tempo de resposta esgotado"
            except httpx.TransportError as exc:
                last_error = f"falha de rede ({exc.__class__.__name__})"
            else:
                self.gateway.observe(response)
                if response.status_code == 429:
                    raise NasaRateLimited(
                        self.service,
                        "limite de requisições da chave excedido (HTTP 429)",
                        429,
                    )
                if response.status_code >= 500:
                    last_error = f"serviço indisponível (HTTP {response.status_code})"
                elif response.status_code >= 400:
                    raise NasaError(
                        self.service,
                        f"requisição recusada (HTTP {response.status_code})",
                        response.status_code,
                    )
                else:
                    return response
            if attempt < self.retries:
                await asyncio.sleep(0.6 * (attempt + 1))
        raise NasaError(self.service, last_error)

    async def get_json(self, url: str, params: dict[str, Any] | None = None) -> Any:
        response = await self._request(url, params)
        if not response.content.strip():
            return None
        try:
            return response.json()
        except ValueError as exc:
            raise NasaError(self.service, "resposta em formato inesperado") from exc

    async def get_text(self, url: str, params: dict[str, Any] | None = None) -> str:
        response = await self._request(url, params)
        return response.text


class KeyedClient(ServiceClient):
    """Clientes de https://api.nasa.gov, que exigem a chave ``api_key``."""

    def keyed(self, **params: Any) -> dict[str, Any]:
        return {"api_key": self.settings.nasa_api_key or "DEMO_KEY", **params}

    def url(self, path: str) -> str:
        return f"{self.settings.nasa_api_base.rstrip('/')}/{path.lstrip('/')}"

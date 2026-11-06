"""Extensão NASA: um *gateway* que reúne os clientes de todas as APIs usadas.

* Com a chave de https://api.nasa.gov: APOD, NeoWs, DONKI e EPIC.
* Sem chave (serviços públicos da NASA/JPL/IPAC): Horizons, SBDB, Biblioteca de
  Imagens, Exoplanet Archive e Technology Transfer.
* Fontes abertas de notícias do setor espacial (usadas pelo blog): Spaceflight
  News API e Launch Library 2 (The Space Devs).

O cliente HTTP (``httpx.AsyncClient``) é criado no startup e fechado no
shutdown da aplicação; todas as requisições reaproveitam suas conexões.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Request

from atlas.ext.config import Settings
from atlas.ext.nasa.apod import ApodClient
from atlas.ext.nasa.donki import DonkiClient
from atlas.ext.nasa.epic import EpicClient
from atlas.ext.nasa.exoplanet_archive import ExoplanetArchiveClient
from atlas.ext.nasa.horizons import HorizonsClient
from atlas.ext.nasa.http import NasaError, NasaRateLimited
from atlas.ext.nasa.images import ImagesClient
from atlas.ext.nasa.launch_library import LaunchLibraryClient
from atlas.ext.nasa.neows import NeoWsClient
from atlas.ext.nasa.sbdb import SbdbClient
from atlas.ext.nasa.spaceflight_news import SpaceflightNewsClient
from atlas.ext.nasa.techtransfer import TechTransferClient

__all__ = ["NasaError", "NasaGateway", "NasaRateLimited", "NasaDep", "init_app"]

# O httpx registra cada URL em nível INFO — e a URL das APIs com chave contém a
# própria chave. Subimos o nível para que ela nunca vá parar nos logs.
logging.getLogger("httpx").setLevel(logging.WARNING)


class NasaGateway:
    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self.settings = settings
        self.http = httpx.AsyncClient(
            timeout=settings.http_timeout,
            transport=transport,
            follow_redirects=True,
            headers={"User-Agent": "AtlasDoCosmos/2.0 (projeto academico)"},
        )
        self.rate_limit: dict[str, Any] = {"limit": None, "remaining": None}

        self.apod = ApodClient(self)
        self.neows = NeoWsClient(self)
        self.donki = DonkiClient(self)
        self.epic = EpicClient(self)
        self.horizons = HorizonsClient(self)
        self.sbdb = SbdbClient(self)
        self.images = ImagesClient(self)
        self.exoplanets = ExoplanetArchiveClient(self)
        self.news = SpaceflightNewsClient(self)
        self.launches = LaunchLibraryClient(self)
        self.techtransfer = TechTransferClient(self)

    def observe(self, response: httpx.Response) -> None:
        """Guarda a cota restante informada pelos cabeçalhos do api.nasa.gov."""
        remaining = response.headers.get("X-RateLimit-Remaining")
        if remaining is not None:
            self.rate_limit = {
                "limit": response.headers.get("X-RateLimit-Limit"),
                "remaining": remaining,
            }

    async def aclose(self) -> None:
        await self.http.aclose()


def init_app(app: FastAPI, transport: httpx.AsyncBaseTransport | None = None) -> None:
    async def startup(app: FastAPI) -> None:
        app.state.nasa = NasaGateway(app.state.settings, transport)

    async def shutdown(app: FastAPI) -> None:
        await app.state.nasa.aclose()

    app.state.startup_hooks.append(startup)
    app.state.shutdown_hooks.append(shutdown)


def get_nasa(request: Request) -> NasaGateway:
    return request.app.state.nasa


NasaDep = Annotated[NasaGateway, Depends(get_nasa)]

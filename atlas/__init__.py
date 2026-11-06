"""Atlas do Cosmos — backend.

Application Factory: nenhum objeto ``app`` é criado na importação do pacote.
``create_app`` monta a aplicação sob demanda, aplica a configuração, inicializa
as extensões (``ext/``) e registra os domínios (cada um com seu ``init_app``).
"""

from __future__ import annotations

import httpx
from fastapi import FastAPI

from atlas import blog, catalog, exoplanets, media, neo, orbits, spaceweather
from atlas.ext import cache, config, db, nasa, web
from atlas.ext.config import Settings, get_settings
from atlas.ext.lifecycle import lifespan, prepare_hooks

__version__ = "2.0.0"

#: Domínios da aplicação, na ordem em que suas rotas são registradas.
DOMAINS = (catalog, orbits, neo, exoplanets, media, spaceweather, blog)


def create_app(
    settings: Settings | None = None,
    *,
    nasa_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    """Cria e configura uma instância do Atlas do Cosmos.

    Args:
        settings: configuração a usar; por padrão lê ``.env``/variáveis de ambiente.
        nasa_transport: transporte HTTP alternativo para as chamadas à NASA
            (usado nos testes para simular as respostas sem acessar a internet).
    """
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="API do Atlas do Cosmos: catálogo didático + dados ao vivo da NASA.",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    prepare_hooks(app)

    # ----------------------------------------------------------
    # Extensões (infraestrutura)
    # ----------------------------------------------------------
    config.init_app(app, settings)
    db.init_app(app)
    cache.init_app(app)
    nasa.init_app(app, transport=nasa_transport)
    web.init_app(app)

    # ----------------------------------------------------------
    # Domínios (cada um registra seu APIRouter e seus hooks)
    # ----------------------------------------------------------
    for domain in DOMAINS:
        domain.init_app(app)

    # O frontend é montado por último para não "engolir" as rotas da API.
    web.mount_frontend(app)
    return app

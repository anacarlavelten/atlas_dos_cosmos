"""Extensão web: middlewares, tratamento de erros, rota de saúde e o frontend.

* CORS: libera as origens configuradas (útil quando o frontend roda em outro
  servidor, ex.: ``python -m http.server 5173`` dentro de ``frontend/``).
* GZip: comprime respostas grandes (a lista de exoplanetas tem milhares de itens).
* ``NasaError`` → HTTP 503 com uma mensagem amigável, sem expor a chave.
* ``mount_frontend``: serve a pasta ``frontend/`` na raiz ``/``.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from atlas.ext.nasa.http import NasaError, NasaRateLimited

router = APIRouter(prefix="/api", tags=["sistema"])


@router.get("/health", summary="Estado da API e da configuração da NASA")
async def health(request: Request) -> dict:
    settings = request.app.state.settings
    nasa = getattr(request.app.state, "nasa", None)
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": request.app.version,
        "environment": settings.environment,
        "nasa_key_configured": not settings.using_demo_key,
        "using_demo_key": settings.using_demo_key,
        "nasa_rate_limit": nasa.rate_limit if nasa else None,
    }


async def nasa_error_handler(_request: Request, exc: NasaError) -> JSONResponse:
    status = 429 if isinstance(exc, NasaRateLimited) else 503
    return JSONResponse(
        status_code=status,
        content={
            "detail": f"Não foi possível obter dados de {exc.service}: {exc.message}.",
            "service": exc.service,
        },
    )


def init_app(app: FastAPI) -> None:
    settings = app.state.settings
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.add_exception_handler(NasaError, nasa_error_handler)
    app.include_router(router)


def mount_frontend(app: FastAPI) -> None:
    settings = app.state.settings
    if settings.serve_frontend and settings.frontend_dir.is_dir():
        app.mount(
            "/",
            StaticFiles(directory=settings.frontend_dir, html=True),
            name="frontend",
        )

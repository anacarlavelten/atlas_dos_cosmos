"""Extensão web: middlewares, tratamento de erros, rota de saúde e o frontend.

* CORS: libera as origens configuradas (útil quando o frontend roda em outro
  servidor, ex.: ``python -m http.server 5173`` dentro de ``frontend/``).
* GZip: comprime respostas grandes (a lista de exoplanetas tem milhares de itens).
* Log de acesso: cada requisição à API vira uma linha de log com status e tempo.
* Erros com o mesmo formato JSON em toda a API:
  - validação (HTTP 422) → ``{"detail": "...", "errors": [{"field", "message"}]}``,
    com mensagens em português para o formulário mostrar ao lado de cada campo;
  - ``NasaError`` → HTTP 503 (ou 429) com uma mensagem amigável, sem expor a chave;
  - qualquer outra exceção → HTTP 500 genérico, com o detalhe só no log.
* ``mount_frontend``: serve a pasta ``frontend/`` na raiz ``/``.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from atlas.ext.nasa.http import NasaError, NasaRateLimited

log = logging.getLogger("atlas.web")
access_log = logging.getLogger("atlas.access")

router = APIRouter(prefix="/api", tags=["sistema"])


class FormError(Exception):
    """Erro de validação que só o serviço consegue detectar (ex.: depende do banco).
    Vira um 422 no mesmo formato dos erros do Pydantic."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(f"{field}: {message}")
        self.field = field
        self.message = message


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


# ----------------------------------------------------------------------
# Mensagens de validação em português
# ----------------------------------------------------------------------
_MESSAGES: dict[str, str] = {
    "missing": "Campo obrigatório.",
    "string_type": "Informe um texto.",
    "string_too_short": "Use pelo menos {min_length} caracteres.",
    "string_too_long": "Use no máximo {max_length} caracteres.",
    "int_type": "Informe um número inteiro.",
    "int_parsing": "Informe um número inteiro.",
    "greater_than_equal": "O valor mínimo é {ge}.",
    "less_than_equal": "O valor máximo é {le}.",
    "greater_than": "O valor deve ser maior que {gt}.",
    "less_than": "O valor deve ser menor que {lt}.",
    "date_type": "Informe uma data válida (AAAA-MM-DD).",
    "date_parsing": "Informe uma data válida (AAAA-MM-DD).",
    "date_from_datetime_parsing": "Informe uma data válida (AAAA-MM-DD).",
    "literal_error": "Escolha uma das opções: {expected}.",
    "extra_forbidden": "Campo não reconhecido.",
    "json_invalid": "O corpo da requisição não é um JSON válido.",
    "model_attributes_type": "Envie os dados do formulário em JSON.",
}


def translate_error(error: dict[str, Any]) -> dict[str, str]:
    """Converte um erro do Pydantic em ``{"field": ..., "message": ...}``."""
    location = [str(part) for part in error.get("loc", ())]
    # O primeiro item diz onde o valor estava (body, query, path...).
    field = ".".join(location[1:]) or (location[0] if location else "")
    kind = error.get("type", "")
    if kind == "value_error":
        message = str(error.get("msg", "")).removeprefix("Value error, ")
    elif kind in _MESSAGES:
        ctx = {k: str(v).replace(" or ", " ou ") for k, v in (error.get("ctx") or {}).items()}
        try:
            message = _MESSAGES[kind].format(**ctx)
        except (KeyError, IndexError):
            message = _MESSAGES[kind]
    else:
        message = str(error.get("msg", "Valor inválido."))
    return {"field": field, "message": message}


def _validation_response(errors: list[dict[str, str]]) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": "Confira os campos destacados.", "errors": errors},
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [translate_error(e) for e in exc.errors()]
    log.info("Validação recusou %s %s: %s", request.method, request.url.path, errors)
    return _validation_response(errors)


async def form_error_handler(request: Request, exc: FormError) -> JSONResponse:
    log.info("Formulário recusado em %s: %s", request.url.path, exc)
    return _validation_response([{"field": exc.field, "message": exc.message}])


async def nasa_error_handler(request: Request, exc: NasaError) -> JSONResponse:
    status = 429 if isinstance(exc, NasaRateLimited) else 503
    log.warning("%s indisponível em %s: %s", exc.service, request.url.path, exc.message)
    return JSONResponse(
        status_code=status,
        content={
            "detail": f"Não foi possível obter dados de {exc.service}: {exc.message}.",
            "service": exc.service,
        },
    )


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Erro inesperado em %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno no servidor do Atlas. Tente novamente em instantes."},
    )


def init_app(app: FastAPI) -> None:
    settings = app.state.settings

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            elapsed_ms = (time.perf_counter() - start) * 1000
            access_log.info(
                "%s %s -> %s (%.0f ms)",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
            )
        return response

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
    )
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(FormError, form_error_handler)
    app.add_exception_handler(NasaError, nasa_error_handler)
    app.add_exception_handler(Exception, unexpected_error_handler)
    app.include_router(router)


class FrontendFiles(StaticFiles):
    """Arquivos do frontend com ``Cache-Control: no-cache``.

    Sem esse cabeçalho o navegador pode reaproveitar por conta própria uma versão
    antiga de um módulo JS depois de uma atualização (o frontend não tem etapa de
    build que mude o nome dos arquivos). Com ``no-cache`` ele sempre pergunta ao
    servidor, que responde 304 pelo ETag quando nada mudou: continua barato."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


def mount_frontend(app: FastAPI) -> None:
    settings = app.state.settings
    if settings.serve_frontend and settings.frontend_dir.is_dir():
        app.mount(
            "/",
            FrontendFiles(directory=settings.frontend_dir, html=True),
            name="frontend",
        )

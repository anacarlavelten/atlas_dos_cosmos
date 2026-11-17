"""Extensão de logging.

Configura o ``logging`` da biblioteca padrão uma única vez, com o nível vindo do
``.env`` (``LOG_LEVEL``). Cada módulo usa seu próprio logger com o prefixo
``atlas.`` (ex.: ``atlas.web``, ``atlas.cache``, ``atlas.observations``), o que
permite filtrar as mensagens por área.

Segurança: a chave da NASA vai na URL das chamadas externas. Por isso o logger do
``httpx`` fica em WARNING (ver ``ext/nasa``) e nenhum log do Atlas registra URLs
externas completas; a senha do banco também nunca é registrada.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI

FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"


def configure(level: str = "INFO") -> None:
    root = logging.getLogger("atlas")
    root.setLevel(level.upper())
    if not any(getattr(h, "_atlas", False) for h in root.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(FORMAT, datefmt="%H:%M:%S"))
        handler._atlas = True  # marca para não duplicar ao criar várias apps (testes)
        root.addHandler(handler)


def init_app(app: FastAPI) -> None:
    settings = app.state.settings
    configure(settings.log_level)
    logging.getLogger("atlas").debug("Logging configurado em %s", settings.log_level)

"""Ciclo de vida da aplicação.

Cada extensão ou domínio registra, no seu ``init_app``, funções de *startup* e
*shutdown* em ``app.state``. O ``lifespan`` do FastAPI executa essas funções ao
subir e ao desligar o servidor. ``app_context`` faz o mesmo fora de um servidor
(CLI, scripts, testes) — é o equivalente ao ``with app.app_context():`` do Flask.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI


def prepare_hooks(app: FastAPI) -> None:
    app.state.startup_hooks = []
    app.state.shutdown_hooks = []


@asynccontextmanager
async def app_context(app: FastAPI) -> AsyncIterator[FastAPI]:
    for hook in app.state.startup_hooks:
        await hook(app)
    try:
        yield app
    finally:
        for hook in reversed(app.state.shutdown_hooks):
            await hook(app)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with app_context(app):
        yield

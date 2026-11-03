"""Domínio *orbits*: elementos orbitais dos astros do Sistema Solar (JPL)."""

from __future__ import annotations

import asyncio
import contextlib
import logging

from fastapi import FastAPI

from atlas.orbits.routes import router

log = logging.getLogger("atlas.orbits")


def init_app(app: FastAPI) -> None:
    app.include_router(router)

    async def prefetch(app: FastAPI) -> None:
        """Busca as órbitas na NASA em segundo plano assim que o servidor sobe,
        para que o primeiro visitante não espere pelas consultas ao JPL."""
        from atlas.orbits.services import get_orbits

        try:
            async with app.state.db.sessionmaker() as session:
                result = await get_orbits(session, app.state.nasa, app.state.settings)
            log.info(
                "Órbitas prontas (%d astros, %d avisos)", len(result.bodies), len(result.warnings)
            )
        except Exception:  # noqa: BLE001 - nunca derrubar o servidor por causa do prefetch
            log.exception("Falha ao pré-carregar as órbitas")

    async def startup(app: FastAPI) -> None:
        if app.state.settings.prefetch_on_startup:
            app.state.orbits_prefetch = asyncio.create_task(prefetch(app))

    async def shutdown(app: FastAPI) -> None:
        task = getattr(app.state, "orbits_prefetch", None)
        if task and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    app.state.startup_hooks.append(startup)
    app.state.shutdown_hooks.append(shutdown)

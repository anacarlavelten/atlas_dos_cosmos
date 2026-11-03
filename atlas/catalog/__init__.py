"""Domínio *catalog*: os astros (planetas, estrelas, galáxias...) e seus textos."""

from __future__ import annotations

from fastapi import FastAPI

from atlas.catalog.routes import router


def init_app(app: FastAPI) -> None:
    app.include_router(router)

    async def seed_if_empty(app: FastAPI) -> None:
        if not app.state.settings.auto_seed:
            return
        from atlas.catalog.services import seed_catalog

        async with app.state.db.sessionmaker() as session:
            await seed_catalog(session)

    app.state.startup_hooks.append(seed_if_empty)

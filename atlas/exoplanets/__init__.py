"""Domínio *exoplanets*: estrelas com planetas confirmados (NASA Exoplanet Archive)."""

from __future__ import annotations

from fastapi import FastAPI

from atlas.exoplanets.routes import router


def init_app(app: FastAPI) -> None:
    app.include_router(router)

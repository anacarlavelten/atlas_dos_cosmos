"""Domínio *neo*: asteroides próximos da Terra (NASA NeoWs)."""

from __future__ import annotations

from fastapi import FastAPI

from atlas.neo.routes import router


def init_app(app: FastAPI) -> None:
    app.include_router(router)

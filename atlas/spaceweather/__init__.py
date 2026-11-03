"""Domínio *spaceweather*: atividade solar recente (NASA DONKI)."""

from __future__ import annotations

from fastapi import FastAPI

from atlas.spaceweather.routes import router


def init_app(app: FastAPI) -> None:
    app.include_router(router)

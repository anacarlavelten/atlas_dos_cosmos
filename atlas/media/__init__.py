"""Domínio *media*: APOD, NASA Image and Video Library e EPIC."""

from __future__ import annotations

from fastapi import FastAPI

from atlas.media.routes import router


def init_app(app: FastAPI) -> None:
    app.include_router(router)

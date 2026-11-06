"""Domínio *blog*: linha do tempo de notícias do espaço e da tecnologia espacial,
agenda de lançamentos e tecnologias da NASA — tudo vindo de APIs abertas."""

from __future__ import annotations

from fastapi import FastAPI

from atlas.blog.routes import router


def init_app(app: FastAPI) -> None:
    app.include_router(router)

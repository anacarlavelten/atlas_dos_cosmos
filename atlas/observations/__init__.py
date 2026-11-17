"""Domínio *observations*: Diário de observação do céu.

É a parte do Atlas em que o visitante envia dados: um formulário validado no
servidor (Pydantic) grava registros no banco (SQLAlchemy), ligados aos astros do
catálogo por chave estrangeira.
"""

from __future__ import annotations

from fastapi import FastAPI

from atlas.observations.routes import router


def init_app(app: FastAPI) -> None:
    app.include_router(router)

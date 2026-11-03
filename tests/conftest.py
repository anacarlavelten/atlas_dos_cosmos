"""Fixtures do PyTest.

Cada teste recebe uma aplicação nova criada pela factory, com banco SQLite
temporário e a NASA simulada (``nasa_mock``) — nenhum teste acessa a internet.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from nasa_mock import make_transport

from atlas import create_app
from atlas.ext.config import Settings


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,  # ignora o .env do desenvolvedor
        environment="testing",
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        nasa_api_key="TEST-KEY-123",
        prefetch_on_startup=False,
    )


@pytest.fixture
def make_client(settings):
    """Cria clientes HTTP de teste. Todos compartilham o mesmo banco temporário,
    o que permite testar o cache entre "reinícios" do servidor."""
    opened: list[TestClient] = []

    def factory(fail: set[str] | None = None, **overrides) -> TestClient:
        app = create_app(settings.model_copy(update=overrides), nasa_transport=make_transport(fail))
        client = TestClient(app)
        client.__enter__()  # executa o lifespan (cria tabelas, carrega o catálogo)
        opened.append(client)
        return client

    yield factory
    for client in opened:
        client.__exit__(None, None, None)


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()

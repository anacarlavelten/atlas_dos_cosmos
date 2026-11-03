"""Extensão de banco de dados (SQLAlchemy 2.x assíncrono).

Mesmo padrão da Unidade 6: o objeto de banco é criado desacoplado da aplicação e
ligado a ela em ``init_app``. ``register_models`` importa os módulos de modelos
dentro da função (import tardio) para registrar as tabelas no ``MetaData`` sem
criar dependências circulares.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Annotated, Any
from uuid import uuid4

from fastapi import Depends, FastAPI, Request
from sqlalchemy import URL, event, make_url, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Classe base de todos os modelos ORM do projeto."""


class Database:
    """Agrupa o engine e a fábrica de sessões de uma instância da aplicação."""

    def __init__(self, url: str) -> None:
        if url.startswith("sqlite"):
            _ensure_sqlite_dir(url)
            self.engine: AsyncEngine = create_async_engine(url)
            # O SQLite só aplica chaves estrangeiras (e ON DELETE CASCADE) com este PRAGMA.
            event.listen(self.engine.sync_engine, "connect", _sqlite_pragmas)
        elif url.startswith("postgresql"):
            pg_url, connect_args = _postgres_options(url)
            self.engine = create_async_engine(pg_url, connect_args=connect_args, pool_pre_ping=True)
        else:
            self.engine = create_async_engine(url)
        self.url = url
        self.sessionmaker = async_sessionmaker(self.engine, expire_on_commit=False)

    @property
    def safe_url(self) -> str:
        """URL para exibir em logs e no terminal, com a senha escondida."""
        return self.engine.url.render_as_string(hide_password=True)

    async def create_all(self) -> None:
        register_models()
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            if conn.dialect.name == "postgresql":
                # No Supabase, as tabelas do schema public ficam expostas na API REST
                # pública (anon key). Com RLS ligado e sem policies, essa API não lê nem
                # escreve nada; o backend conecta como dono das tabelas e não é afetado.
                for table in Base.metadata.sorted_tables:
                    await conn.execute(
                        text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY')
                    )

    async def drop_all(self) -> None:
        register_models()
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def dispose(self) -> None:
        await self.engine.dispose()


def _sqlite_pragmas(dbapi_connection, _record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _postgres_options(url: str) -> tuple[URL, dict[str, Any]]:
    """Ajusta uma URL do PostgreSQL (ex.: Supabase) para o driver ``asyncpg``.

    - ``sslmode`` é o parâmetro do libpq (o que o painel do Supabase mostra); o
      asyncpg não o entende e recebe o equivalente em ``ssl``.
    - O pooler do Supabase na porta 6543 (modo *transaction*, PgBouncer/Supavisor)
      não suporta *prepared statements* em cache: desligamos o cache e damos um
      nome único a cada statement, como recomenda a documentação do SQLAlchemy.
    """
    parsed = make_url(url)
    query = dict(parsed.query)
    ssl = query.pop("sslmode", None) or query.pop("ssl", None)
    parsed = parsed.set(query=query)
    connect_args: dict[str, Any] = {}
    if ssl and ssl != "disable":
        connect_args["ssl"] = ssl
    if parsed.port == 6543:
        connect_args |= {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__atlas_{uuid4()}__",
        }
    return parsed, connect_args


def _ensure_sqlite_dir(url: str) -> None:
    path = url.split("///", 1)[-1]
    if path and path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)


def register_models() -> None:
    """Importa os módulos que definem modelos para registrá-los no metadata."""
    import atlas.catalog.models  # noqa: F401
    import atlas.ext.cache.models  # noqa: F401
    import atlas.orbits.models  # noqa: F401


def init_app(app: FastAPI) -> None:
    settings = app.state.settings
    app.state.db = Database(settings.database_url)

    async def startup(app: FastAPI) -> None:
        await app.state.db.create_all()

    async def shutdown(app: FastAPI) -> None:
        await app.state.db.dispose()

    app.state.startup_hooks.append(startup)
    app.state.shutdown_hooks.append(shutdown)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Dependência do FastAPI: abre uma sessão por requisição e a fecha no fim."""
    async with request.app.state.db.sessionmaker() as session:
        yield session


#: Atalho para declarar a sessão nos parâmetros das rotas.
SessionDep = Annotated[AsyncSession, Depends(get_session)]

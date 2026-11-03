"""Comandos de terminal do projeto (``atlas --help``).

Funcionam fora de um servidor web usando ``app_context``: a aplicação é criada
pela factory, os hooks de startup rodam (banco, cliente da NASA) e no fim os de
shutdown — o mesmo papel do ``flask shell`` e dos comandos ``flask ...``.
"""

from __future__ import annotations

import asyncio
import code
from typing import Annotated

import typer

cli = typer.Typer(help="Atlas do Cosmos — comandos de manutenção.", no_args_is_help=True)


def _app(**overrides):
    from atlas import create_app
    from atlas.ext.config import Settings

    settings = Settings(prefetch_on_startup=False, **overrides)
    return create_app(settings)


@cli.command("init-db")
def init_db(
    reset: Annotated[bool, typer.Option(help="Apaga todas as tabelas antes")] = False,
) -> None:
    """Cria as tabelas do banco (e popula o catálogo)."""
    from atlas.ext.lifecycle import app_context

    async def run() -> None:
        app = _app(auto_seed=False)
        if reset:
            await app.state.db.drop_all()
        async with app_context(app):
            from atlas.catalog.services import seed_catalog

            async with app.state.db.sessionmaker() as session:
                n = await seed_catalog(session)
        typer.echo(f"Banco pronto em {app.state.db.safe_url} ({n} astros inseridos).")

    asyncio.run(run())


@cli.command()
def seed(
    replace: Annotated[bool, typer.Option(help="Substitui o catálogo existente")] = False,
) -> None:
    """Carrega o catálogo de astros (atlas/catalog/data/catalog.json)."""
    from atlas.catalog.services import seed_catalog
    from atlas.ext.lifecycle import app_context

    async def run() -> None:
        app = _app(auto_seed=False)
        async with app_context(app):
            async with app.state.db.sessionmaker() as session:
                n = await seed_catalog(session, replace=replace)
        typer.echo(f"{n} astros gravados." if n else "Catálogo já existia (use --replace).")

    asyncio.run(run())


@cli.command()
def refresh() -> None:
    """Atualiza agora as órbitas e a posição das sondas a partir do JPL."""
    from atlas.ext.lifecycle import app_context
    from atlas.orbits.services import get_orbits

    async def run() -> None:
        app = _app()
        async with app_context(app):
            async with app.state.db.sessionmaker() as session:
                result = await get_orbits(session, app.state.nasa, app.state.settings, force=True)
        sources: dict[str, int] = {}
        for body in result.bodies:
            sources[body.source] = sources.get(body.source, 0) + 1
        typer.echo(f"Órbitas: {sources}")
        typer.echo(f"Sondas: {[f'{s.slug} ({s.source})' for s in result.spacecraft]}")
        for warning in result.warnings:
            typer.secho(f"  aviso: {warning}", fg=typer.colors.YELLOW)

    asyncio.run(run())


@cli.command("check-nasa")
def check_nasa() -> None:
    """Testa a chave da NASA consultando a foto do dia (APOD)."""
    from atlas.ext.lifecycle import app_context
    from atlas.ext.nasa import NasaError

    async def run() -> None:
        app = _app()
        settings = app.state.settings
        if settings.using_demo_key:
            typer.secho(
                "Usando DEMO_KEY. Coloque sua chave em NASA_API_KEY no arquivo .env.",
                fg=typer.colors.YELLOW,
            )
        async with app_context(app):
            try:
                apod = await app.state.nasa.apod.picture()
            except NasaError as exc:
                typer.secho(f"Falhou: {exc}", fg=typer.colors.RED)
                raise typer.Exit(code=1) from exc
            typer.secho(f"OK! Foto do dia: {apod['title']}", fg=typer.colors.GREEN)
            typer.echo(f"Cota restante da chave: {app.state.nasa.rate_limit}")

    asyncio.run(run())


@cli.command()
def shell() -> None:
    """Abre um console Python com a aplicação, uma sessão e os modelos já importados."""
    from atlas.catalog.models import Body, BodyFact
    from atlas.ext.cache.models import CacheEntry
    from atlas.ext.lifecycle import app_context
    from atlas.orbits.models import OrbitalElements

    app = _app()
    loop = asyncio.new_event_loop()
    ctx = app_context(app)
    loop.run_until_complete(ctx.__aenter__())
    session = app.state.db.sessionmaker()

    def run(coro):
        """Executa uma corrotina no console, ex.: run(session.scalars(select(Body)))."""
        return loop.run_until_complete(coro)

    from sqlalchemy import select

    banner = (
        "Atlas do Cosmos — shell\n"
        "Objetos: app, session, nasa, run(), select, Body, BodyFact, OrbitalElements, CacheEntry\n"
        "Exemplo: run(session.scalars(select(Body).where(Body.level == 1))).all()"
    )
    namespace = {
        "app": app,
        "session": session,
        "nasa": app.state.nasa,
        "run": run,
        "select": select,
        "Body": Body,
        "BodyFact": BodyFact,
        "OrbitalElements": OrbitalElements,
        "CacheEntry": CacheEntry,
    }
    try:
        code.interact(banner=banner, local=namespace)
    finally:
        loop.run_until_complete(session.close())
        loop.run_until_complete(ctx.__aexit__(None, None, None))
        loop.close()


def main() -> None:
    cli()

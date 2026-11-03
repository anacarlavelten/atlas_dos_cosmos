"""Extensão de configuração.

Segue o fator III da metodologia 12-Factor App: toda configuração que muda entre
ambientes (chave da NASA, banco de dados, CORS...) vem de variáveis de ambiente
ou do arquivo ``.env`` na raiz do projeto. Os valores abaixo são apenas padrões
seguros para desenvolvimento.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Request
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: Raiz do projeto (pasta que contém ``app.py``, ``pyproject.toml`` e ``.env``).
BASE_DIR = Path(__file__).resolve().parents[3]
INSTANCE_DIR = BASE_DIR / "instance"


class Settings(BaseSettings):
    """Parâmetros da aplicação. Cada atributo pode ser sobrescrito por uma
    variável de ambiente com o mesmo nome em maiúsculas (ex.: ``NASA_API_KEY``)."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Atlas do Cosmos"
    environment: Literal["development", "production", "testing"] = "development"
    debug: bool = False

    # ------------------------------------------------------------------
    # NASA
    # ------------------------------------------------------------------
    #: Chave pessoal de https://api.nasa.gov. Sem ela, usa-se a DEMO_KEY
    #: (limite baixo: ~30 requisições/hora e 50/dia por IP).
    nasa_api_key: str = "DEMO_KEY"
    nasa_api_base: str = "https://api.nasa.gov"
    horizons_url: str = "https://ssd.jpl.nasa.gov/api/horizons.api"
    sbdb_url: str = "https://ssd-api.jpl.nasa.gov/sbdb.api"
    images_url: str = "https://images-api.nasa.gov/search"
    exoplanet_tap_url: str = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
    epic_archive_url: str = "https://epic.gsfc.nasa.gov/archive"
    http_timeout: float = 25.0
    #: Quantas requisições simultâneas cada serviço externo pode receber.
    nasa_concurrency: int = 4

    # ------------------------------------------------------------------
    # Cache (tempo de vida dos dados vindos da NASA)
    # ------------------------------------------------------------------
    orbits_ttl_hours: int = 24
    neo_ttl_minutes: int = 180
    apod_ttl_minutes: int = 360
    epic_ttl_minutes: int = 180
    flares_ttl_minutes: int = 60
    images_ttl_days: int = 7
    exoplanets_ttl_days: int = 7
    neo_limit: int = Field(default=10, ge=1, le=25)

    # ------------------------------------------------------------------
    # Persistência
    # ------------------------------------------------------------------
    database_url: str = f"sqlite+aiosqlite:///{INSTANCE_DIR / 'atlas.db'}"
    auto_seed: bool = True
    #: Ao subir o servidor, já busca as órbitas na NASA em segundo plano.
    prefetch_on_startup: bool = True

    # ------------------------------------------------------------------
    # Web
    # ------------------------------------------------------------------
    serve_frontend: bool = True
    frontend_dir: Path = BASE_DIR / "frontend"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("database_url")
    @classmethod
    def _async_driver(cls, url: str) -> str:
        """Aceita a URL como o Supabase/Heroku mostram (``postgresql://`` ou
        ``postgres://``) e escolhe o driver assíncrono ``asyncpg``."""
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url.removeprefix(prefix)
        return url

    @property
    def using_demo_key(self) -> bool:
        return not self.nasa_api_key or self.nasa_api_key.strip().upper() == "DEMO_KEY"


@lru_cache
def get_settings() -> Settings:
    """Lê o ambiente uma única vez por processo."""
    return Settings()


def init_app(app: FastAPI, settings: Settings) -> None:
    """Associa a configuração à instância da aplicação (equivalente ao
    ``app.config.from_object`` do Flask)."""
    app.state.settings = settings
    app.debug = settings.debug


def settings_from(request: Request) -> Settings:
    """Dependência: devolve a configuração da aplicação que está atendendo a
    requisição (o papel do ``current_app.config`` no Flask)."""
    return request.app.state.settings

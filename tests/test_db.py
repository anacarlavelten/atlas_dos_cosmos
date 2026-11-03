import pytest

from atlas.ext.config import Settings
from atlas.ext.db import Database, _postgres_options

SUPABASE = "postgresql://postgres.abc:segredo@aws-0-sa-east-1.pooler.supabase.com:{port}/postgres"


@pytest.mark.parametrize("prefix", ["postgres://", "postgresql://"])
def test_settings_choose_asyncpg_driver(prefix):
    settings = Settings(_env_file=None, database_url=f"{prefix}u:p@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://u:p@host:5432/db"


def test_settings_keep_other_urls():
    url = "sqlite+aiosqlite:///./instance/atlas.db"
    assert Settings(_env_file=None, database_url=url).database_url == url


def _db(url: str) -> Database:
    return Database(Settings(_env_file=None, database_url=url).database_url)


def test_supabase_transaction_pooler_disables_statement_cache():
    db = _db(SUPABASE.format(port=6543) + "?sslmode=require")
    assert db.engine.url.drivername == "postgresql+asyncpg"
    assert "sslmode" not in db.engine.url.query
    _, args = _postgres_options(db.url)
    assert args["ssl"] == "require"
    assert args["statement_cache_size"] == 0
    assert args["prepared_statement_cache_size"] == 0
    assert args["prepared_statement_name_func"]() != args["prepared_statement_name_func"]()


def test_supabase_session_pooler_keeps_statement_cache():
    _, args = _postgres_options(_db(SUPABASE.format(port=5432)).url)
    assert args == {}


def test_safe_url_hides_password():
    db = _db(SUPABASE.format(port=6543))
    assert "segredo" not in db.safe_url
    assert "***" in db.safe_url

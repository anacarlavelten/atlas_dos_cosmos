from typer.testing import CliRunner

from atlas.ext.cli import cli


def test_cli_seed_and_init_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'cli.db'}")
    runner = CliRunner()
    result = runner.invoke(cli, ["init-db"])
    assert result.exit_code == 0, result.output
    assert "astros inseridos" in result.output
    again = runner.invoke(cli, ["seed"])
    assert again.exit_code == 0
    assert "já existia" in again.output


def test_cli_help():
    result = CliRunner().invoke(cli, ["--help"])
    assert result.exit_code == 0
    for command in ("init-db", "seed", "refresh", "check-nasa", "shell"):
        assert command in result.output

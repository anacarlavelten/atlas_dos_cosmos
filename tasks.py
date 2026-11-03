"""Automação de tarefas com Invoke (``invoke --list``)."""

import os

from invoke import task

#: Terminal "interativo" (cores, Ctrl+C) só existe fora do Windows.
PTY = os.name != "nt"


@task
def install(c):
    """Instala o projeto em modo editável com as dependências de desenvolvimento e teste."""
    c.run('pip install -e ".[dev,test]"', echo=True)


@task
def run(c, host="127.0.0.1", port=8000):
    """Sobe o servidor de desenvolvimento (recarrega ao salvar arquivos)."""
    c.run(f"uvicorn app:app --reload --host {host} --port {port}", pty=PTY)


@task
def test(c):
    """Executa os testes automatizados."""
    c.run("pytest -v", echo=True, pty=PTY)


@task
def cov(c):
    """Executa os testes medindo a cobertura do pacote atlas."""
    c.run("pytest --cov=atlas --cov-report=term-missing", echo=True, pty=PTY)


@task
def lint(c):
    """Verifica estilo e possíveis erros com o Ruff."""
    c.run("ruff check atlas tests", echo=True)


@task(name="format")
def format_(c):
    """Formata o código com o Ruff."""
    c.run("ruff format atlas tests", echo=True)


@task
def seed(c, replace=False):
    """Carrega o catálogo de astros no banco."""
    c.run(f"atlas seed{' --replace' if replace else ''}", echo=True)


@task
def refresh(c):
    """Atualiza as órbitas a partir do JPL Horizons/SBDB."""
    c.run("atlas refresh", echo=True)


@task(name="check-nasa")
def check_nasa(c):
    """Confere se a chave da NASA está funcionando."""
    c.run("atlas check-nasa", echo=True)

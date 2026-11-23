"""Automação de tarefas com Invoke (``invoke --list``)."""

import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

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
    """Executa os testes automatizados do backend (pytest) e do frontend (node:test)."""
    c.run("pytest -v", echo=True, pty=PTY)
    if shutil.which("node"):
        c.run('node --test "frontend/tests/**/*.test.js"', echo=True, pty=PTY)
    else:
        print("Node.js não encontrado: testes do frontend ignorados.")


@task
def cov(c):
    """Executa os testes medindo a cobertura do pacote atlas."""
    c.run("pytest --cov=atlas --cov-report=term-missing", echo=True, pty=PTY)


@task
def lint(c):
    """Verifica estilo, possíveis erros e formatação com o Ruff."""
    c.run("ruff check atlas tests", echo=True)
    c.run("ruff format --check atlas tests", echo=True)


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


def _find_browser() -> str | None:
    """Chrome, Edge ou Chromium instalado (usado para imprimir o PDF)."""
    for name in ("chrome", "google-chrome", "chromium", "chromium-browser", "msedge"):
        if found := shutil.which(name):
            return found
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    return next((path for path in candidates if Path(path).exists()), None)


@task
def pdf(c, saida="dist/Documentacao.pdf"):
    """Gera o PDF da entrega a partir do Documentacao.md (precisa de internet e Chrome/Edge)."""
    root = Path(__file__).parent
    browser = _find_browser()
    if browser is None:
        raise SystemExit("Chrome ou Edge não encontrado. Instale um deles para gerar o PDF.")
    markdown = (root / "Documentacao.md").read_text(encoding="utf-8")
    template = (root / "docs" / "pdf" / "template.html").read_text(encoding="utf-8")
    html = root / "dist" / "Documentacao.html"
    html.parent.mkdir(exist_ok=True)
    # "</script" dentro do Markdown fecharia a tag que guarda o texto.
    html.write_text(
        template.replace("__MARKDOWN__", markdown.replace("</script", "<\\/script")),
        encoding="utf-8",
    )
    target = (root / saida).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    # Se o PDF antigo estiver aberto num visualizador, o Windows bloqueia o arquivo e o
    # Chrome falha sem dizer nada. Apagamos antes para detectar isso com clareza.
    try:
        target.unlink(missing_ok=True)
    except PermissionError:
        raise SystemExit(
            f"Não foi possível substituir {target}: o PDF está aberto em outro programa. "
            "Feche-o e rode `invoke pdf` de novo."
        ) from None

    # Perfil temporário: não interfere no Chrome/Edge que você usa no dia a dia.
    with tempfile.TemporaryDirectory(prefix="atlas-pdf-") as profile:
        command = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={profile}",
            "--no-pdf-header-footer",
            "--virtual-time-budget=20000",
            f"--print-to-pdf={target}",
            html.resolve().as_uri(),
        ]
        print("Gerando o PDF com", Path(browser).name, "...")
        result = subprocess.run(command, capture_output=True, text=True, timeout=180)

    if not target.exists() or target.stat().st_size == 0:
        detail = (result.stderr or result.stdout or "").strip()[-800:]
        raise SystemExit(
            "O navegador não gerou o PDF.\n"
            f"Código de saída: {result.returncode}\n{detail}\n"
            "Confira se há internet (os diagramas usam bibliotecas da CDN jsDelivr)."
        )
    print(f"PDF gerado em {target} ({target.stat().st_size // 1024} KB)")


PACKAGE_SKIP_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    ".pytest_cache",
    ".ruff_cache",
    "htmlcov",
    "instance",
    "build",
    "dist",
    "atlas_cosmos.egg-info",
}
PACKAGE_SKIP_FILES = {".env", ".coverage"}


@task
def package(c, grupo="X", produto="AtlasDoCosmos"):
    """Gera o .zip da entrega: GrupoX_NomeDoProduto.zip (sem venv, __pycache__ e .env)."""
    root = Path(__file__).parent
    target = root / "dist" / f"Grupo{grupo}_{produto}.zip"
    target.parent.mkdir(exist_ok=True)
    count = 0
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob("*")):
            relative = path.relative_to(root)
            if any(part in PACKAGE_SKIP_DIRS for part in relative.parts):
                continue
            if path.is_file() and path.name not in PACKAGE_SKIP_FILES and not path.suffix == ".db":
                zf.write(path, Path(produto) / relative)
                count += 1
    print(f"{target} criado com {count} arquivos (o .env com a sua chave NÃO foi incluído).")

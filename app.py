"""Ponto de entrada (entry point) do Atlas do Cosmos.

Servidores ASGI como o Uvicorn apontam para o objeto ``app`` deste arquivo:

    uvicorn app:app --reload

Também é possível executar diretamente: ``python app.py``.
"""

from atlas import create_app

app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

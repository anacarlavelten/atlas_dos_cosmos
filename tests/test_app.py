from atlas import create_app


def test_factory_creates_independent_apps(settings):
    a, b = create_app(settings), create_app(settings)
    assert a is not b
    assert a.state.settings is settings


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["nasa_key_configured"] is True
    assert body["using_demo_key"] is False


def test_api_key_is_never_exposed(client):
    for path in ["/api/health", "/api/media/apod", "/api/media/epic", "/api/neo/week"]:
        assert "TEST-KEY-123" not in client.get(path).text


def test_demo_key_is_reported(make_client):
    client = make_client(nasa_api_key="DEMO_KEY")
    assert client.get("/api/health").json()["using_demo_key"] is True


def test_frontend_is_served(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Atlas do Cosmos" in r.text


def test_frontend_files_are_always_revalidated(client):
    """Sem etapa de build, o navegador não pode reaproveitar JS antigo após uma
    atualização: ``no-cache`` + ETag (304 quando nada mudou)."""
    first = client.get("/js/main.js")
    assert first.headers["cache-control"] == "no-cache"
    again = client.get("/js/main.js", headers={"If-None-Match": first.headers["etag"]})
    assert again.status_code == 304


def test_unexpected_errors_return_a_generic_500(make_client, monkeypatch):
    from fastapi.testclient import TestClient

    from atlas.catalog import services

    async def boom(*_args, **_kwargs):
        raise RuntimeError("detalhe interno que não pode vazar")

    monkeypatch.setattr(services, "list_bodies", boom)
    client = make_client()
    safe = TestClient(client.app, raise_server_exceptions=False)
    r = safe.get("/api/catalog/bodies")
    assert r.status_code == 500
    assert "detalhe interno" not in r.text
    assert r.json()["detail"].startswith("Erro interno")


def test_openapi_docs(client):
    assert client.get("/api/docs").status_code == 200
    paths = client.get("/api/openapi.json").json()["paths"]
    assert "/api/orbits" in paths and "/api/catalog/bodies" in paths

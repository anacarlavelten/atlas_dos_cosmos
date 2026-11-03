"""Dados ao vivo: asteroides, exoplanetas, imagens e clima espacial."""

import pytest


def test_neo_week(client):
    data = client.get("/api/neo/week").json()
    objects = data["objects"]
    assert data["total_in_week"] == 21
    assert len(objects) == 10  # NEO_LIMIT padrão
    distances = [o["miss_distance_km"] for o in objects]
    assert distances == sorted(distances)
    assert all(o["elements"] for o in objects)
    assert not any(o["name"].startswith("(") for o in objects)
    assert data["stale"] is False


def test_neo_limit_setting(make_client):
    assert len(make_client(neo_limit=3).get("/api/neo/week").json()["objects"]) == 3


def test_neo_unavailable_without_cache(make_client):
    r = make_client(fail={"neows"}).get("/api/neo/week")
    assert r.status_code == 503
    assert "NeoWs" in r.json()["detail"]


def test_stale_cache_is_served_when_nasa_fails(make_client):
    # TTL zero: a resposta é salva, mas já nasce vencida.
    assert make_client(neo_ttl_minutes=0).get("/api/neo/week").status_code == 200
    data = make_client(neo_ttl_minutes=0, fail={"neows"}).get("/api/neo/week").json()
    assert data["stale"] is True
    assert len(data["objects"]) == 10


def test_exoplanet_hosts(client):
    data = client.get("/api/exoplanets/hosts").json()
    nearest = data["nearest"][0]
    assert nearest["name"] == "Proxima Cen"
    assert nearest["planets"] == 2
    assert nearest["distance_ly"] == pytest.approx(4.24, abs=0.01)
    assert data["total_hosts"] == len(data["hosts"])
    assert data["total_planets"] >= data["total_hosts"]
    assert len(data["hosts"][0]) == 4


def test_apod(client):
    data = client.get("/api/media/apod").json()
    assert data["title"] == "Uma Galáxia de Exemplo"
    assert data["copyright"] == "Fulano de Tal"
    assert data["page_url"] == "https://apod.nasa.gov/apod/ap261026.html"


def test_epic_uses_public_archive_url(client):
    image = client.get("/api/media/epic").json()["images"][0]
    assert image["thumbnail_url"].startswith(
        "https://epic.gsfc.nasa.gov/archive/natural/2026/10/25/jpg/"
    )
    assert "api_key" not in image["image_url"]


def test_body_images(client):
    data = client.get("/api/media/images/jupiter").json()
    assert data["query"] == "Jupiter Juno"
    assert len(data["images"]) == 4
    assert data["images"][0]["page_url"].startswith("https://images.nasa.gov/details/")
    assert client.get("/api/media/images/nao-existe").status_code == 404


def test_flares_summary(client):
    data = client.get("/api/space-weather/flares").json()
    assert data["count"] == 4
    assert data["strongest"]["class_type"] == "X1.2"
    assert data["by_class"] == {"C": 1, "M": 2, "X": 1}
    assert data["recent"][0]["class_type"] == "M5.6"

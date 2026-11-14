"""Dados ao vivo: asteroides, exoplanetas, imagens e clima espacial."""

import json
import sqlite3
from datetime import UTC, datetime, timedelta

import pytest
from nasa_mock import APOD_REQUESTS, NASA_IMAGE_REQUESTS


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


def test_apod_accepts_date_and_caches_each_day(client):
    APOD_REQUESTS.clear()
    first = client.get("/api/media/apod?date=2001-02-03")
    second = client.get("/api/media/apod?date=2001-02-03")
    assert first.status_code == second.status_code == 200
    assert first.json()["date"] == "2001-02-03"
    assert first.json()["page_url"] == "https://apod.nasa.gov/apod/ap010203.html"
    assert len(APOD_REQUESTS) == 1
    assert APOD_REQUESTS[0]["date"] == "2001-02-03"
    assert "TEST-KEY-123" not in first.text


def test_apod_rejects_nasa_logo_payload_and_does_not_cache_it(make_client):
    APOD_REQUESTS.clear()
    response = make_client(fail={"apod-logo"}).get("/api/media/apod?date=2001-02-03")
    assert response.status_code == 200
    assert response.json()["title"] == "A Test Galaxy"
    assert response.json()["url"] == "https://assets.science.nasa.gov/apod/test-galaxy.jpg"
    assert "nasa-logo" not in response.json()["url"]
    assert len(APOD_REQUESTS) == 1


def test_apod_discards_invalid_logo_from_existing_cache(make_client):
    APOD_REQUESTS.clear()
    client = make_client()
    db_path = client.app.state.settings.database_url.removeprefix("sqlite+aiosqlite:///")
    now = datetime.now(UTC)
    invalid_payload = {
        "date": "2001-02-03",
        "title": "NASA Science",
        "explanation": "NASA Science",
        "media_type": "image",
        "url": "https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png",
        "hdurl": "https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png",
        "thumbnail_url": None,
        "copyright": None,
        "page_url": "https://apod.nasa.gov/apod/ap010203.html",
    }
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO cache_entries "
            "(key, payload, source, fetched_at, expires_at) VALUES (?, ?, ?, ?, ?)",
            (
                "apod:2001-02-03",
                json.dumps(invalid_payload),
                "NASA APOD",
                now.isoformat(),
                (now + timedelta(hours=1)).isoformat(),
            ),
        )

    response = client.get("/api/media/apod?date=2001-02-03")
    assert response.status_code == 200
    assert response.json()["title"] == "Uma Galáxia de Exemplo"
    assert len(APOD_REQUESTS) == 1


@pytest.mark.parametrize("day", ["1995-06-15", "2999-01-01"])
def test_apod_rejects_dates_outside_supported_range(client, day):
    response = client.get(f"/api/media/apod?date={day}")
    assert response.status_code == 422


def test_apod_rate_limit_is_reported_as_429(make_client):
    response = make_client(fail={"apod429"}).get("/api/media/apod?date=2001-02-03")
    assert response.status_code == 429
    assert "limite" in response.json()["detail"].lower()


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


def test_birth_images_searches_and_caches_by_year(client):
    NASA_IMAGE_REQUESTS.clear()
    first = client.get("/api/media/birth-images/1990")
    second = client.get("/api/media/birth-images/1990")
    assert first.status_code == second.status_code == 200
    data = first.json()
    assert data["year"] == 1990
    assert len(data["images"]) == 8
    assert data["images"][0]["date_created"] == "1990-06-15T00:00:00Z"
    assert data["images"][0]["center"] == "JPL"
    assert len(NASA_IMAGE_REQUESTS) == 1
    assert NASA_IMAGE_REQUESTS[0]["year_start"] == "1990"
    assert NASA_IMAGE_REQUESTS[0]["year_end"] == "1990"


def test_birth_images_can_return_no_results(client):
    response = client.get("/api/media/birth-images/1900")
    assert response.status_code == 200
    assert response.json()["images"] == []


def test_birth_images_reports_unavailable_without_cache(make_client):
    response = make_client(fail={"images"}).get("/api/media/birth-images/1990")
    assert response.status_code == 503
    assert "NASA Images" in response.json()["detail"]


def test_flares_summary(client):
    data = client.get("/api/space-weather/flares").json()
    assert data["count"] == 4
    assert data["strongest"]["class_type"] == "X1.2"
    assert data["by_class"] == {"C": 1, "M": 2, "X": 1}
    assert data["recent"][0]["class_type"] == "M5.6"

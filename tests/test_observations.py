"""Diário de observação: formulário validado no servidor + persistência via ORM."""

import asyncio
from datetime import UTC, date, datetime, timedelta

import pytest

from atlas.catalog.services import seed_catalog

VALID = {
    "body_slug": "jupiter",
    "observer_name": "Ana Carla",
    "observed_at": "2026-11-10",
    "location": "Florianópolis, SC",
    "instrument": "telescopio",
    "sky_quality": 4,
    "notes": "Vi as quatro luas galileanas alinhadas.",
}


def errors_by_field(response) -> dict[str, str]:
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Confira os campos destacados."
    return {e["field"]: e["message"] for e in body["errors"]}


# ---------------------------------------------------------------- opções
def test_form_options_come_from_the_api(client):
    data = client.get("/api/observations/options").json()
    assert [i["key"] for i in data["instruments"]] == [
        "olho-nu",
        "binoculo",
        "telescopio",
        "camera",
    ]
    assert [q["key"] for q in data["sky_quality"]] == ["1", "2", "3", "4", "5"]
    assert data["min_date"] == "1900-01-01"


# ---------------------------------------------------------------- criação
def test_create_observation(client):
    r = client.post("/api/observations", json=VALID)
    assert r.status_code == 201
    data = r.json()
    assert data["id"] > 0
    assert data["body"] == {
        "slug": "jupiter",
        "name": "Júpiter",
        "category": data["body"]["category"],
        "kind": data["body"]["kind"],
    }
    assert data["instrument_label"] == "Telescópio"
    assert len(data["delete_token"]) >= 20
    assert "delete_token_hash" not in data


def test_text_is_trimmed_and_collapsed(client):
    payload = VALID | {"observer_name": "  Ana    Carla  ", "location": " Floripa "}
    data = client.post("/api/observations", json=payload).json()
    assert data["observer_name"] == "Ana Carla"
    assert data["location"] == "Floripa"


def test_list_is_newest_first_and_filterable(client):
    client.post("/api/observations", json=VALID | {"observed_at": "2026-01-01"})
    client.post("/api/observations", json=VALID | {"observed_at": "2026-03-01"})
    client.post("/api/observations", json=VALID | {"body_slug": "lua", "observed_at": "2026-02-01"})

    everything = client.get("/api/observations").json()
    assert everything["total"] == 3
    assert [o["observed_at"] for o in everything["items"]] == [
        "2026-03-01",
        "2026-02-01",
        "2026-01-01",
    ]
    only_moon = client.get("/api/observations", params={"body": "lua"}).json()
    assert only_moon["total"] == 1 and only_moon["items"][0]["body"]["slug"] == "lua"
    page = client.get("/api/observations", params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 3 and len(page["items"]) == 1
    assert "delete_token" not in page["items"][0]


def test_get_one_and_404(client):
    created = client.post("/api/observations", json=VALID).json()
    assert client.get(f"/api/observations/{created['id']}").json()["notes"] == VALID["notes"]
    r = client.get("/api/observations/9999")
    assert r.status_code == 404 and r.json()["detail"] == "Observação não encontrada."


# ---------------------------------------------------------------- validação
def test_missing_fields_are_reported_one_by_one(client):
    fields = errors_by_field(client.post("/api/observations", json={}))
    assert set(fields) == {
        "body_slug",
        "observer_name",
        "observed_at",
        "location",
        "instrument",
        "sky_quality",
    }
    assert all(message == "Campo obrigatório." for message in fields.values())


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("observer_name", "A", "Use pelo menos 2 caracteres."),
        ("observer_name", "x" * 81, "Use no máximo 80 caracteres."),
        ("observer_name", "12345", "Use letras, não apenas números ou símbolos."),
        ("location", "   ", "Use pelo menos 2 caracteres."),
        ("sky_quality", 0, "O valor mínimo é 1."),
        ("sky_quality", 6, "O valor máximo é 5."),
        ("sky_quality", "muito", "Informe um número inteiro."),
        ("observed_at", "10/11/2026", "Informe uma data válida (AAAA-MM-DD)."),
        ("observed_at", "1899-12-31", "Use uma data a partir de 01/01/1900."),
        ("notes", "x" * 1001, "Use no máximo 1000 caracteres."),
    ],
)
def test_field_validation_messages(client, field, value, message):
    fields = errors_by_field(client.post("/api/observations", json=VALID | {field: value}))
    assert fields == {field: message}


def test_future_date_is_rejected(client):
    future = (datetime.now(UTC).date() + timedelta(days=3)).isoformat()
    fields = errors_by_field(client.post("/api/observations", json=VALID | {"observed_at": future}))
    assert fields == {"observed_at": "A data da observação não pode estar no futuro."}


def test_invalid_instrument_lists_the_options(client):
    fields = errors_by_field(client.post("/api/observations", json=VALID | {"instrument": "radar"}))
    assert fields["instrument"].startswith("Escolha uma das opções:")
    assert "'telescopio' ou 'camera'" in fields["instrument"]


def test_unknown_body_is_a_field_error(client):
    fields = errors_by_field(client.post("/api/observations", json=VALID | {"body_slug": "x"}))
    assert fields == {"body_slug": "Escolha um astro da lista."}


def test_unexpected_fields_are_rejected(client):
    fields = errors_by_field(client.post("/api/observations", json=VALID | {"admin": True}))
    assert fields == {"admin": "Campo não reconhecido."}


def test_nothing_is_saved_when_validation_fails(client):
    client.post("/api/observations", json=VALID | {"sky_quality": 9})
    assert client.get("/api/observations").json()["total"] == 0


# ---------------------------------------------------------------- exclusão
def test_delete_requires_the_token_from_creation(client):
    created = client.post("/api/observations", json=VALID).json()
    url = f"/api/observations/{created['id']}"

    assert client.delete(url).status_code == 403
    assert client.delete(url, headers={"X-Delete-Token": "errado"}).status_code == 403
    assert (
        client.delete(url, headers={"X-Delete-Token": created["delete_token"]}).status_code == 204
    )
    assert client.get(url).status_code == 404
    assert (
        client.delete(url, headers={"X-Delete-Token": created["delete_token"]}).status_code == 404
    )


# ---------------------------------------------------------------- integridade
def test_observations_survive_catalog_reseed(client):
    created = client.post("/api/observations", json=VALID).json()

    async def reseed():
        async with client.app.state.db.sessionmaker() as session:
            await seed_catalog(session, replace=True)

    asyncio.run(reseed())
    items = client.get("/api/observations").json()["items"]
    assert len(items) == 1
    assert items[0]["body"]["slug"] == "jupiter"
    assert items[0]["observed_at"] == VALID["observed_at"]
    # O código de exclusão continua valendo depois do reseed.
    r = client.delete(
        f"/api/observations/{items[0]['id']}", headers={"X-Delete-Token": created["delete_token"]}
    )
    assert r.status_code == 204


def test_database_check_constraint_blocks_invalid_rows(client):
    """Mesmo gravando direto pelo ORM (sem a API), o banco recusa nota fora de 1..5."""
    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError

    from atlas.catalog.models import Body
    from atlas.observations.models import Observation

    async def insert_invalid():
        async with client.app.state.db.sessionmaker() as session:
            body = await session.scalar(select(Body).where(Body.slug == "lua"))
            session.add(
                Observation(
                    body=body,
                    observer_name="Teste",
                    observed_at=date(2026, 1, 1),
                    location="Lab",
                    instrument="telescopio",
                    sky_quality=42,
                    delete_token_hash="0" * 64,
                )
            )
            await session.commit()

    with pytest.raises(IntegrityError):
        asyncio.run(insert_invalid())


# ---------------------------------------------------------------- outras rotas
def test_query_validation_uses_the_same_format(client):
    fields = errors_by_field(client.get("/api/catalog/bodies", params={"level": 9}))
    assert fields == {"level": "O valor máximo é 3."}

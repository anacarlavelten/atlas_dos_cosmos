import asyncio

from atlas.catalog.services import load_seed, seed_catalog


def test_levels(client):
    levels = client.get("/api/catalog/levels").json()
    assert [lv["name"] for lv in levels] == ["Sistema Solar", "Via Láctea", "Universo"]


def test_all_bodies_are_seeded(client):
    bodies = client.get("/api/catalog/bodies").json()
    assert len(bodies) == len(load_seed()["bodies"])
    slugs = {b["slug"] for b in bodies}
    assert {"sol", "terra", "fobos", "voyager2", "exoplanetas", "m31", "universo"} <= slugs


def test_filter_by_level(client):
    level1 = client.get("/api/catalog/bodies", params={"level": 1}).json()
    assert level1 and all(b["level"] == 1 for b in level1)
    assert client.get("/api/catalog/bodies", params={"level": 9}).status_code == 422


def test_body_detail_with_parent_and_facts(client):
    lua = client.get("/api/catalog/bodies/lua").json()
    assert lua["parent"] == "terra"
    assert lua["facts"][0] == {"label": "Diâmetro", "value": "3.474 km"}
    assert lua["nasa"]["horizons"] == "301"


def test_unknown_body_returns_404(client):
    r = client.get("/api/catalog/bodies/planeta-x")
    assert r.status_code == 404
    assert "planeta-x" in r.json()["detail"]


def test_seed_is_idempotent(client):
    app = client.app

    async def run():
        async with app.state.db.sessionmaker() as session:
            return await seed_catalog(session)

    assert asyncio.run(run()) == 0  # já existia

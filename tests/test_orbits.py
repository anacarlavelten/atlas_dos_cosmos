import pytest


def _by_slug(data):
    return {b["slug"]: b for b in data["bodies"]}


def test_orbits_come_from_jpl(client):
    data = client.get("/api/orbits").json()
    bodies = _by_slug(data)
    assert bodies["marte"]["source"] == "JPL Horizons"
    assert bodies["ceres"]["source"] == "JPL SBDB"
    assert bodies["lua"]["center"] == "terra"
    assert bodies["caronte"]["center"] == "plutao"
    assert data["warnings"] == []
    assert pytest.approx(bodies["terra"]["elements"]["a"], abs=0.01) == 1.0


def test_halley_missing_elements_are_derived(client):
    halley = _by_slug(client.get("/api/orbits").json())["halley"]["elements"]
    # A fixture do SBDB não traz 'a' nem 'ma' (época fora do padrão): a = q / (1 − e).
    assert halley["a"] == pytest.approx(0.5748638313743413 / (1 - 0.9679221169240834))
    assert 0 <= halley["ma"] < 360


def test_spacecraft_positions(client):
    craft = {s["slug"]: s for s in client.get("/api/orbits").json()["spacecraft"]}
    assert set(craft) == {"voyager", "voyager2", "newhorizons"}
    v1 = craft["voyager"]
    assert v1["source"] == "JPL Horizons"
    distance = sum(c * c for c in v1["position"]) ** 0.5
    assert 150 < distance < 200  # UA


def test_falls_back_to_approximate_elements(make_client):
    client = make_client(fail={"horizons", "sbdb"})
    r = client.get("/api/orbits")
    assert r.status_code == 200
    data = r.json()
    assert {b["source"] for b in data["bodies"]} == {"aproximado"}
    assert data["warnings"]
    assert all(s["source"] == "aproximado" for s in data["spacecraft"])


def test_elements_are_persisted_between_restarts(make_client):
    make_client().get("/api/orbits")
    # Novo "servidor" com a NASA fora do ar: os elementos salvos continuam valendo.
    data = make_client(fail={"horizons", "sbdb"}).get("/api/orbits").json()
    assert _by_slug(data)["jupiter"]["source"] == "JPL Horizons"
    assert data["warnings"] == []

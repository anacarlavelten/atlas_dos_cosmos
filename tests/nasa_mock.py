"""NASA simulada para os testes.

Responde no mesmo formato das APIs reais (JSON do api.nasa.gov, texto CSV do
Horizons, JSON do SBDB, TAP do Exoplanet Archive...), sem acessar a internet.
Permite também simular falhas de um serviço específico com ``fail={...}``.
"""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import parse_qs

import httpx

from atlas.orbits import fallback

FIXTURES = Path(__file__).parent / "fixtures"
CATALOG = json.loads(
    (Path(__file__).parents[1] / "atlas" / "catalog" / "data" / "catalog.json").read_text("utf-8")
)

ELEMENTS_HEADER = (
    "            JDTDB,            Calendar Date (TDB),                     EC,"
    "                     QR,                     IN,                     OM,"
    "                      W,                     Tp,                      N,"
    "                     MA,                     TA,                      A,"
    "                     AD,                     PR,"
)
VECTORS_HEADER = (
    "            JDTDB,            Calendar Date (TDB),                      X,"
    "                      Y,                      Z,                     VX,"
    "                     VY,                     VZ,"
)


NEWS_REQUESTS: list[dict[str, str]] = []
APOD_REQUESTS: list[dict[str, str]] = []
NASA_IMAGE_REQUESTS: list[dict[str, str]] = []


def fixture(name: str):
    return json.loads((FIXTURES / name).read_text("utf-8"))


def _bodies_by_horizons() -> dict[str, dict]:
    return {b["nasa"]["horizons"]: b for b in CATALOG["bodies"] if b["nasa"].get("horizons")}


def horizons_result(header: str, row: str, target: str) -> str:
    """Texto no formato devolvido pelo Horizons em ``result``."""
    return "\n".join(
        [
            "API VERSION: 1.2",
            "API SOURCE: NASA/JPL Horizons API",
            "",
            "*******************************************************************************",
            f"Target body name: {target}",
            "*******************************************************************************",
            header,
            "*" * 120,
            "$$SOE",
            row,
            "$$EOE",
            "*" * 120,
        ]
    )


def elements_row(el: dict, jd: float) -> str:
    a, e = el["a"], el["e"]
    ma = (el["ma"] + el["n"] * (jd - el["epoch_jd"])) % 360
    vals = [
        jd,
        "A.D. 2026-Oct-26 00:00:00.0000",
        e,
        a * (1 - e),
        el["i"],
        el["om"],
        el["w"],
        jd - ma / el["n"],
        el["n"],
        ma,
        ma,
        a,
        a * (1 + e),
        360 / el["n"],
    ]
    return ", ".join(v if isinstance(v, str) else f"{v:.15E}" for v in vals) + ","


def _horizons(params: dict[str, str]) -> httpx.Response:
    command = params["COMMAND"].strip("'")
    start = date.fromisoformat(params["START_TIME"].strip("'"))
    jd = 2440587.5 + (start - date(1970, 1, 1)).days
    body = _bodies_by_horizons().get(command)
    if body is None:
        return httpx.Response(
            200, json={"signature": {"version": "1.2"}, "error": "No matches found."}
        )
    if params["EPHEM_TYPE"].strip("'") == "VECTORS":
        st = fallback.spacecraft_state(body["render"])
        vals = [jd, "A.D. 2026-Oct-26 00:00:00.0000", *st["position"], *st["velocity"]]
        row = ", ".join(v if isinstance(v, str) else f"{v:.15E}" for v in vals) + ","
        text = horizons_result(VECTORS_HEADER, row, body["name"])
    else:
        el = fallback.body_elements(body["slug"], body["category"], body["render"])
        text = horizons_result(ELEMENTS_HEADER, elements_row(el, jd), body["name"])
    return httpx.Response(
        200,
        json={"signature": {"source": "NASA/JPL Horizons API", "version": "1.2"}, "result": text},
    )


def _sbdb(params: dict[str, str]) -> httpx.Response:
    data = fixture("sbdb_1P.json") if params["sstr"] == "1P" else fixture("sbdb_ceres.json")
    return httpx.Response(200, json=data)


def _neo_feed(params: dict[str, str]) -> httpx.Response:
    start = date.fromisoformat(params["start_date"])
    data = fixture("neo_feed.json")
    days = list(data["near_earth_objects"].values())
    data["near_earth_objects"] = {
        (start + timedelta(days=i)).isoformat(): objs for i, objs in enumerate(days)
    }
    return httpx.Response(200, json=data)


def _neo_lookup(neo_id: str) -> httpx.Response:
    data = fixture("neo_lookup.json")
    data["id"] = neo_id
    k = int(neo_id) % 7
    od = data["orbital_data"]
    od["mean_anomaly"] = str((float(od["mean_anomaly"]) + 37 * k) % 360)
    od["ascending_node_longitude"] = str((float(od["ascending_node_longitude"]) + 41 * k) % 360)
    return httpx.Response(200, json=data)


def _exoplanets() -> httpx.Response:
    rows = fixture("exoplanets_sample.json")
    for i in range(300):
        ra = (i * 137.508) % 360
        dec = math.degrees(math.asin(((i * 0.618) % 2) - 1))
        rows.append(
            {
                "pl_name": f"Teste-{i} b",
                "hostname": f"Teste-{i}",
                "ra": ra,
                "dec": dec,
                "sy_dist": 5 + (i * 3.1) % 900,
                "sy_pnum": 1,
                "disc_year": 2015,
                "discoverymethod": "Transit",
            }
        )
    return httpx.Response(200, json=rows)


def make_transport(fail: set[str] | None = None) -> httpx.MockTransport:
    """``fail`` pode conter: horizons, sbdb, neows, apod, donki, epic, images, exoplanets,
    news, launches, techtransfer, donki404, apod-page, apod429, apod-logo."""
    fail = fail or set()

    def handler(request: httpx.Request) -> httpx.Response:
        host, path = request.url.host, request.url.path
        params = {k: v[0] for k, v in parse_qs(request.url.query.decode()).items()}

        def down(name: str) -> bool:
            return name in fail

        if host == "ssd.jpl.nasa.gov":
            return httpx.Response(503) if down("horizons") else _horizons(params)
        if host == "ssd-api.jpl.nasa.gov":
            return httpx.Response(503) if down("sbdb") else _sbdb(params)
        if host == "images-api.nasa.gov":
            if down("images"):
                return httpx.Response(503)
            if "year_start" in params:
                NASA_IMAGE_REQUESTS.append(params)
                data = fixture("images.json")
                if params["year_start"] == "1900":
                    data["collection"]["items"] = []
                else:
                    for item in data["collection"]["items"]:
                        item["data"][0]["date_created"] = f"{params['year_start']}-06-15T00:00:00Z"
                return httpx.Response(200, json=data)
            return httpx.Response(200, json=fixture("images.json"))
        if host == "exoplanetarchive.ipac.caltech.edu":
            return httpx.Response(503) if down("exoplanets") else _exoplanets()
        if host == "api.spaceflightnewsapi.net":
            if down("news"):
                return httpx.Response(503)
            NEWS_REQUESTS.append(params)
            terms = params.get("title_contains_one", "")
            if terms.startswith("APOD: "):
                # A SNAPI republica a APOD do dia: usada como plano B quando a NASA cai.
                return httpx.Response(
                    200,
                    json={
                        "count": 1,
                        "results": [
                            {
                                "id": 1,
                                "title": f"{terms} – Nebulosa Republicada",
                                "url": "https://science.nasa.gov/image-article/apod-teste/",
                                "image_url": "https://assets.science.nasa.gov/apod/republicada.jpg",
                                "news_site": "NASA",
                                "summary": "",
                                "published_at": "2026-11-16T05:00:00Z",
                            }
                        ],
                    },
                )
            return httpx.Response(200, json=fixture("snapi_articles.json"))
        if host == "ll.thespacedevs.com":
            return (
                httpx.Response(503)
                if down("launches")
                else httpx.Response(200, json=fixture("ll2_upcoming.json"))
            )
        if host == "technology.nasa.gov":
            return (
                httpx.Response(503)
                if down("techtransfer")
                else httpx.Response(200, json=fixture("techtransfer_patent.json"))
            )
        if host == "api.nasa.gov":
            if params.get("api_key") in (None, ""):
                return httpx.Response(403, json={"error": {"code": "API_KEY_MISSING"}})
            headers = {"X-RateLimit-Limit": "1000", "X-RateLimit-Remaining": "987"}
            if path == "/planetary/apod":
                APOD_REQUESTS.append(params)
                if down("apod429"):
                    return httpx.Response(429)
                if down("apod"):
                    return httpx.Response(503)
                data = fixture("apod.json")
                data["date"] = params.get("date", data["date"])
                if down("apod-logo"):
                    data.update(
                        title="NASA Science",
                        url="https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png",
                        hdurl="https://science.nasa.gov/wp-content/themes/nasa-child/assets/images/nasa-logo@2x.png",
                    )
                return httpx.Response(200, json=data, headers=headers)
            if path == "/neo/rest/v1/feed":
                return httpx.Response(503) if down("neows") else _neo_feed(params)
            if path.startswith("/neo/rest/v1/neo/"):
                return (
                    httpx.Response(503) if down("neows") else _neo_lookup(path.rsplit("/", 1)[-1])
                )
            if path == "/DONKI/FLR":
                if down("donki404"):
                    return httpx.Response(404, json={"status": 404, "error": "Not Found"})
                return (
                    httpx.Response(503)
                    if down("donki")
                    else httpx.Response(200, json=fixture("donki_flr.json"), headers=headers)
                )
            if path == "/EPIC/api/natural":
                return (
                    httpx.Response(503)
                    if down("epic")
                    else httpx.Response(200, json=fixture("epic.json"), headers=headers)
                )
        if host == "apod.nasa.gov" and path.startswith("/apod/ap"):
            if down("apod-page"):
                return httpx.Response(503)
            filename = path.rsplit("/", 1)[-1]
            year = int(filename[2:4])
            requested_date = date(
                (1900 if year >= 95 else 2000) + year,
                int(filename[4:6]),
                int(filename[6:8]),
            )
            return httpx.Response(
                200,
                text=f"""
                <html><head>
                <meta property="article:published_time" content="{requested_date.isoformat()}T00:00:00Z">
                <meta property="og:title" content="APOD: {requested_date:%Y %B} {requested_date.day} - A Test Galaxy - NASA Science">
                <meta property="og:image" content="https://assets.science.nasa.gov/apod/test-galaxy.jpg">
                </head></html>
                """,
                headers={"Content-Type": "text/html"},
            )
        return httpx.Response(404, json={"error": "rota não simulada"})

    return httpx.MockTransport(handler)

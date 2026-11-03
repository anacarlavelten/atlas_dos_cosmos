"""Testes de unidade das funções que interpretam as respostas da NASA."""

import pytest
from nasa_mock import ELEMENTS_HEADER, horizons_result

from atlas.exoplanets.astro import equatorial_to_galactic
from atlas.ext.nasa import NasaError
from atlas.ext.nasa.horizons import elements_from_row, parse_csv_table
from atlas.ext.nasa.sbdb import parse_sbdb_elements
from atlas.neo.services import clean_name, elements_from_orbital_data
from atlas.spaceweather.services import flare_strength

ROW = (
    "2461339.500000000, A.D. 2026-Oct-26 00:00:00.0000,  9.339554150531624E-02,  1.381297412628373E+00,"
    "  1.847724566339651E+00,  4.948838286815567E+01,  2.866432014934215E+02,  2.461144128226339E+06,"
    "  5.240420003958236E-01,  1.024079543022068E+02,  1.125440102041437E+02,  1.523606218047283E+00,"
    "  1.665915023466193E+00,  6.869674138618744E+02,"
)


def test_parse_horizons_elements():
    rows = parse_csv_table(horizons_result(ELEMENTS_HEADER, ROW, "Mars (499)"))
    el = elements_from_row(rows[0])
    assert el["a"] == pytest.approx(1.5236062)
    assert el["e"] == pytest.approx(0.0933955)
    assert el["n"] == pytest.approx(0.52404200)
    assert el["epoch_jd"] == 2461339.5


def test_horizons_without_table_raises():
    with pytest.raises(NasaError):
        parse_csv_table('No ephemeris for target "Planeta X"')


def test_sbdb_derives_a_and_mean_anomaly():
    data = {
        "orbit": {
            "epoch": "2460000.5",
            "elements": [
                {"name": "e", "value": "0.5"},
                {"name": "q", "value": "1.0"},
                {"name": "i", "value": "10"},
                {"name": "om", "value": "20"},
                {"name": "w", "value": "30"},
                {"name": "tp", "value": "2459990.5"},
            ],
        }
    }
    el = parse_sbdb_elements(data)
    assert el["a"] == pytest.approx(2.0)
    assert el["n"] == pytest.approx(0.9856076686 / 2**1.5, rel=1e-6)
    assert el["ma"] == pytest.approx(el["n"] * 10)


@pytest.mark.parametrize(
    ("ra", "dec", "lon", "lat"),
    [
        (266.40499, -28.93617, 0.0, 0.0),  # centro galáctico (Sgr A*)
        (192.85948, 27.12825, None, 90.0),  # polo norte galáctico
    ],
)
def test_equatorial_to_galactic(ra, dec, lon, lat):
    lon_deg, b = equatorial_to_galactic(ra, dec)
    assert b == pytest.approx(lat, abs=0.01)
    if lon is not None:
        assert min(lon_deg, 360 - lon_deg) == pytest.approx(lon, abs=0.01)


def test_flare_strength_order():
    classes = ["C9.9", "X1.0", "M1.0", "B5", "M9.9", "X2.3"]
    assert sorted(classes, key=flare_strength) == ["B5", "C9.9", "M1.0", "M9.9", "X1.0", "X2.3"]


def test_neo_helpers():
    assert clean_name("(2026 TK3)") == "2026 TK3"
    assert clean_name("2088 Sahara (1975 YB)") == "2088 Sahara (1975 YB)"
    assert elements_from_orbital_data({"eccentricity": "1.2"}) is None

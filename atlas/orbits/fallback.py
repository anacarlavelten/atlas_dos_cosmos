"""Elementos orbitais aproximados, usados só quando a NASA não pode ser consultada
(sem internet, servidor fora do ar...).

Planetas: tabela "Keplerian Elements for Approximate Positions of the Major
Planets" do JPL/NASA (E. M. Standish), válida de 1800 a 2050, na forma
[a (UA), e, I (°), L (°), ϖ (°), Ω (°), dL/dt (°/século)] na época J2000.
"""

from __future__ import annotations

import hashlib
import math
from typing import Any

J2000 = 2451545.0
AU_KM = 149_597_870.7
GAUSS_DEG_PER_DAY = math.degrees(0.01720209895)

# fmt: off
JPL_APPROX: dict[str, list[float]] = {
    #            a (UA)       e            I (°)         L (°)          ϖ (°)          Ω (°)          dL/dt (°/século)
    "mercurio": [0.38709927,  0.20563593,  7.00497902,   252.25032350,  77.45779628,   48.33076593,   149472.67411175],
    "venus":    [0.72333566,  0.00677672,  3.39467605,   181.97909950,  131.60246718,  76.67984255,   58517.81538729],
    "terra":    [1.00000261,  0.01671123,  -0.00001531,  100.46457166,  102.93768193,  0.0,           35999.37244981],
    "marte":    [1.52371034,  0.09339410,  1.84969142,   -4.55343205,   -23.94362959,  49.55953891,   19140.30268499],
    "jupiter":  [5.20288700,  0.04838624,  1.30439695,   34.39644051,   14.72847983,   100.47390909,  3034.74612775],
    "saturno":  [9.53667594,  0.05386179,  2.48599187,   49.95424423,   92.59887831,   113.66242448,  1222.49362201],
    "urano":    [19.18916464, 0.04725744,  0.77263783,   313.23810451,  170.95427630,  74.01692503,   428.48202785],
    "netuno":   [30.06992276, 0.00859048,  1.77004347,   -55.12002969,  44.96476227,   131.78422574,  218.45945325],
    "plutao":   [39.48211675, 0.24882730,  17.14001206,  238.92903833,  224.06891629,  110.30393684,  145.20780515],
    "ceres":    [2.7675,      0.0758,      10.594,       60.0,          153.9,         80.3,          7827.0],
}
# fmt: on

#: Cometa Halley: elementos da passagem de 1986 (periélio em 9/fev/1986).
HALLEY = {
    "epoch_jd": 2446470.95,
    "a": 17.93,
    "e": 0.9679,
    "i": 162.19,
    "om": 59.1,
    "w": 112.24,
    "ma": 0.0,
}


def from_jpl_table(row: list[float]) -> dict[str, float]:
    a, e, inc, L, varpi, node, rate = row
    return {
        "epoch_jd": J2000,
        "a": a,
        "e": e,
        "i": inc,
        "om": node,
        "w": varpi - node,
        "ma": (L - varpi) % 360.0,
        "n": rate / 36525.0,
    }


def _phase(slug: str) -> float:
    """Fase inicial estável (sempre a mesma para cada lua)."""
    return int(hashlib.sha1(slug.encode()).hexdigest()[:6], 16) % 360


def body_elements(slug: str, category: str, render: dict[str, Any]) -> dict[str, float] | None:
    if slug in JPL_APPROX:
        return from_jpl_table(JPL_APPROX[slug])
    if slug == "halley":
        return {**HALLEY, "n": GAUSS_DEG_PER_DAY / HALLEY["a"] ** 1.5}
    fb = render.get("fallback") or {}
    if category == "moon" and fb:
        return {
            "epoch_jd": J2000,
            "a": fb["a_km"] / AU_KM,
            "e": 0.0,
            "i": fb.get("inc_deg", 0.0),
            "om": 0.0,
            "w": 0.0,
            "ma": float(_phase(slug)),
            "n": 360.0 / fb["period_days"],
        }
    return None


def spacecraft_state(render: dict[str, Any]) -> dict[str, Any] | None:
    """Posição aproximada de uma sonda a partir de direção (eclíptica),
    distância numa época e velocidade radial média."""
    fb = render.get("fallback")
    if not fb:
        return None
    lon, lat = math.radians(fb["lon_deg"]), math.radians(fb["lat_deg"])
    u = [math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)]
    speed = fb["au_per_year"] / 365.25
    return {
        "epoch_jd": fb["epoch_jd"],
        "position": [c * fb["r_au"] for c in u],
        "velocity": [c * speed for c in u],
    }

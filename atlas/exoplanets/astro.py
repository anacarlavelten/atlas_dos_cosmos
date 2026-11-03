"""Conversão de coordenadas equatoriais (J2000) para galácticas.

O Exoplanet Archive informa a posição das estrelas em ascensão reta e declinação;
o mapa da Via Láctea usa longitude (l) e latitude (b) galácticas, medidas a
partir do centro da galáxia. A conversão é uma rotação fixa (matriz da IAU,
época J2000).
"""

from __future__ import annotations

import math

PARSEC_LY = 3.261563777

_EQ_TO_GAL = (
    (-0.0548755604, -0.8734370902, -0.4838350155),
    (0.4941094279, -0.4448296300, 0.7469822445),
    (-0.8676661490, -0.1980763734, 0.4559837762),
)


def equatorial_to_galactic(ra_deg: float, dec_deg: float) -> tuple[float, float]:
    """Devolve (l, b) em graus, com l em [0, 360)."""
    ra, dec = math.radians(ra_deg), math.radians(dec_deg)
    v = (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))
    x, y, z = (sum(row[k] * v[k] for k in range(3)) for row in _EQ_TO_GAL)
    lon = math.degrees(math.atan2(y, x)) % 360.0
    lat = math.degrees(math.asin(max(-1.0, min(1.0, z))))
    return lon, lat

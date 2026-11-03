"""JPL Small-Body Database (https://ssd-api.jpl.nasa.gov/sbdb.api, sem chave).

Usado para corpos pequenos (Ceres, cometa Halley): devolve elementos orbitais e
parâmetros físicos. Para órbitas cuja época não é a padrão do MPC, a API pode
omitir alguns elementos (como ``a`` ou ``ma``); nesse caso eles são derivados
dos demais (``a = q / (1 − e)``; ``M = n · (época − tp)``).
"""

from __future__ import annotations

import math
from typing import Any

from atlas.ext.nasa.http import NasaError, ServiceClient

#: Constante gravitacional de Gauss em graus/dia (n = K / a^1,5).
GAUSS_DEG_PER_DAY = math.degrees(0.01720209895)


def _num(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_sbdb_elements(data: dict[str, Any]) -> dict[str, float]:
    orbit = data.get("orbit") or {}
    raw = {el.get("name"): _num(el.get("value")) for el in orbit.get("elements", [])}
    epoch = _num(orbit.get("epoch"))
    e, i, om, w = raw.get("e"), raw.get("i"), raw.get("om"), raw.get("w")
    if None in (epoch, e, i, om, w):
        raise NasaError("JPL SBDB", "elementos orbitais incompletos")

    a = raw.get("a")
    if a is None and raw.get("q") is not None and e < 1:
        a = raw["q"] / (1 - e)
    if a is None or a <= 0:
        raise NasaError("JPL SBDB", "semieixo maior indisponível")

    n = raw.get("n") or GAUSS_DEG_PER_DAY / a**1.5
    ma = raw.get("ma")
    if ma is None:
        tp = raw.get("tp")
        if tp is None:
            raise NasaError("JPL SBDB", "anomalia média indisponível")
        ma = (n * (epoch - tp)) % 360.0

    return {"epoch_jd": epoch, "a": a, "e": e, "i": i, "om": om, "w": w, "ma": ma, "n": n}


def parse_sbdb_physical(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for item in data.get("phys_par") or []:
        name = item.get("name")
        if name:
            out[name] = {"value": item.get("value"), "units": item.get("units")}
    return out


class SbdbClient(ServiceClient):
    service = "JPL SBDB"

    async def lookup(self, sstr: str) -> dict[str, Any]:
        data = await self.get_json(self.settings.sbdb_url, {"sstr": sstr, "phys-par": "1"})
        if not isinstance(data, dict) or "orbit" not in data:
            raise NasaError(self.service, f"objeto '{sstr}' não encontrado")
        return data

    async def elements(self, sstr: str) -> dict[str, float]:
        return parse_sbdb_elements(await self.lookup(sstr))

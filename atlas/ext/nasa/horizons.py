"""JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api, sem chave).

Sistema de efemérides do Jet Propulsion Laboratory da NASA. Usamos dois tipos de
tabela:

* ``ELEMENTS``: elementos orbitais osculadores (a, e, i, Ω, ω, M, n) de planetas,
  luas e planetas-anões numa data — o frontend propaga a órbita a partir deles;
* ``VECTORS``: posição e velocidade cartesianas, usadas para as sondas
  (Voyager 1 e 2, New Horizons), que não seguem uma órbita fechada.

A resposta JSON traz o texto da tabela no campo ``result``; as linhas de dados
ficam entre os marcadores ``$$SOE`` e ``$$EOE`` e, com ``CSV_FORMAT='YES'``, o
cabeçalho das colunas aparece logo antes de ``$$SOE``.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from atlas.ext.nasa.http import NasaError, ServiceClient

AU_KM = 149_597_870.7


def _q(value: str) -> str:
    """O Horizons espera valores de texto entre aspas simples."""
    return f"'{value}'"


def parse_csv_table(result: str) -> list[dict[str, str]]:
    """Extrai as linhas entre ``$$SOE`` e ``$$EOE`` como dicionários
    ``{coluna: valor}``, usando o cabeçalho CSV que precede ``$$SOE``."""
    lines = result.splitlines()
    try:
        soe = next(i for i, line in enumerate(lines) if line.strip() == "$$SOE")
        eoe = next(i for i, line in enumerate(lines) if line.strip() == "$$EOE")
    except StopIteration as exc:
        hint = next((ln.strip() for ln in lines if ln.strip()), "resposta vazia")
        raise NasaError("JPL Horizons", f"tabela não encontrada ({hint[:120]})") from exc

    header_line = next(
        (lines[i] for i in range(soe - 1, -1, -1) if "JDTDB" in lines[i]),
        None,
    )
    if header_line is None:
        raise NasaError("JPL Horizons", "cabeçalho CSV não encontrado")
    header = [h.strip() for h in header_line.split(",")]

    rows: list[dict[str, str]] = []
    for line in lines[soe + 1 : eoe]:
        if not line.strip():
            continue
        values = [v.strip() for v in line.split(",")]
        rows.append({h: v for h, v in zip(header, values, strict=False) if h})
    if not rows:
        raise NasaError("JPL Horizons", "tabela sem linhas")
    return rows


def elements_from_row(row: dict[str, str]) -> dict[str, float]:
    """Converte uma linha de ``EPHEM_TYPE=ELEMENTS`` (unidades AU-D) para o
    formato interno do Atlas."""
    try:
        return {
            "epoch_jd": float(row["JDTDB"]),
            "e": float(row["EC"]),
            "i": float(row["IN"]),
            "om": float(row["OM"]),
            "w": float(row["W"]),
            "ma": float(row["MA"]),
            "n": float(row["N"]),
            "a": float(row["A"]),
        }
    except (KeyError, ValueError) as exc:
        raise NasaError("JPL Horizons", f"coluna ausente ou inválida: {exc}") from exc


def vectors_from_row(row: dict[str, str]) -> dict[str, Any]:
    try:
        return {
            "epoch_jd": float(row["JDTDB"]),
            "position": [float(row["X"]), float(row["Y"]), float(row["Z"])],
            "velocity": [float(row["VX"]), float(row["VY"]), float(row["VZ"])],
        }
    except (KeyError, ValueError) as exc:
        raise NasaError("JPL Horizons", f"coluna ausente ou inválida: {exc}") from exc


class HorizonsClient(ServiceClient):
    service = "JPL Horizons"

    async def _table(self, command: str, center: str, day: date, ephem_type: str) -> str:
        params = {
            "format": "json",
            "COMMAND": _q(command),
            "OBJ_DATA": _q("NO"),
            "MAKE_EPHEM": _q("YES"),
            "EPHEM_TYPE": _q(ephem_type),
            "CENTER": _q(center),
            "START_TIME": _q(day.isoformat()),
            "STOP_TIME": _q((day + timedelta(days=1)).isoformat()),
            "STEP_SIZE": _q("1 d"),
            "REF_PLANE": _q("ECLIPTIC"),
            "REF_SYSTEM": _q("ICRF"),
            "OUT_UNITS": _q("AU-D"),
            "CSV_FORMAT": _q("YES"),
        }
        if ephem_type == "VECTORS":
            params["VEC_TABLE"] = _q("2")
        data = await self.get_json(self.settings.horizons_url, params)
        if not isinstance(data, dict):
            raise NasaError(self.service, "resposta vazia")
        if data.get("error"):
            raise NasaError(self.service, str(data["error"])[:160])
        return str(data.get("result", ""))

    async def elements(self, command: str, center: str, day: date) -> dict[str, float]:
        """Elementos orbitais osculadores de ``command`` em relação a ``center``
        (ex.: ``'500@10'`` = centro do Sol; ``'500@599'`` = centro de Júpiter)."""
        result = await self._table(command, center, day, "ELEMENTS")
        return elements_from_row(parse_csv_table(result)[0])

    async def vectors(self, command: str, center: str, day: date) -> dict[str, Any]:
        result = await self._table(command, center, day, "VECTORS")
        return vectors_from_row(parse_csv_table(result)[0])

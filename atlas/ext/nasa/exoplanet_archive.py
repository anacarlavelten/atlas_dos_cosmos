"""NASA Exoplanet Archive — serviço TAP (consultas ADQL), sem chave.

A tabela ``pscomppars`` tem uma linha por planeta confirmado, com a posição da
estrela hospedeira (RA/Dec, em graus) e a distância do sistema (``sy_dist``, em
parsecs).
"""

from __future__ import annotations

from typing import Any

from atlas.ext.nasa.http import NasaError, ServiceClient

HOSTS_QUERY = (
    "select pl_name,hostname,ra,dec,sy_dist,sy_pnum,disc_year,discoverymethod "
    "from pscomppars where sy_dist is not null"
)


class ExoplanetArchiveClient(ServiceClient):
    service = "NASA Exoplanet Archive"

    async def query(self, adql: str) -> list[dict[str, Any]]:
        data = await self.get_json(
            self.settings.exoplanet_tap_url, {"query": adql, "format": "json"}
        )
        if not isinstance(data, list):
            raise NasaError(self.service, "resposta TAP inesperada")
        return data

    async def planets_with_hosts(self) -> list[dict[str, Any]]:
        return await self.query(HOSTS_QUERY)

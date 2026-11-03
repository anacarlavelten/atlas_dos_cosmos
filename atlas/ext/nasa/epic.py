"""EPIC — Earth Polychromatic Imaging Camera (https://api.nasa.gov, exige chave).

Os metadados vêm da API com chave; as imagens em si são servidas pelo arquivo
público ``epic.gsfc.nasa.gov``, para que a chave nunca apareça numa URL de imagem
entregue ao navegador.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from atlas.ext.nasa.http import KeyedClient


class EpicClient(KeyedClient):
    service = "EPIC"

    async def latest_natural(self) -> list[dict[str, Any]]:
        data = await self.get_json(self.url("EPIC/api/natural"), self.keyed())
        return data if isinstance(data, list) else []

    def image_url(self, item: dict[str, Any], kind: str = "jpg") -> str:
        moment = datetime.fromisoformat(item["date"].replace(" ", "T"))
        base = self.settings.epic_archive_url.rstrip("/")
        return f"{base}/natural/{moment:%Y/%m/%d}/{kind}/{item['image']}.{kind}"

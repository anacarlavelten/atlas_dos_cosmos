"""NASA Technology Transfer (https://technology.nasa.gov/api, sem chave).

Catálogo de tecnologias criadas pela NASA e disponíveis para licenciamento:
patentes, softwares e "spinoffs". A busca devolve linhas (listas) e não objetos;
``parse_tech_rows`` converte cada linha para um dicionário.
"""

from __future__ import annotations

import html
import re
from typing import Any

from atlas.ext.nasa.http import ServiceClient

COLLECTIONS = ("patent", "software", "spinoff")
_TAGS = re.compile(r"<[^>]+>")


def strip_html(text: str | None) -> str:
    return html.unescape(_TAGS.sub("", text or "")).strip()


def _page_url(collection: str, code: str) -> str:
    if collection == "software":
        return f"https://software.nasa.gov/software/{code}"
    if collection == "spinoff":
        return "https://spinoff.nasa.gov/"
    return f"https://technology.nasa.gov/patent/{code}"


def parse_tech_rows(collection: str, data: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in (data or {}).get("results") or []:
        if not isinstance(row, list) or len(row) < 10:
            continue
        code = str(row[1] or row[0])
        title = strip_html(row[2])
        if not title:
            continue
        image = row[10] if len(row) > 10 and str(row[10]).startswith("http") else None
        out.append(
            {
                "id": str(row[0]),
                "code": code,
                "title": title,
                "summary": strip_html(row[3])[:420],
                "category": strip_html(row[5]) or None,
                "center": strip_html(row[9]) or None,
                "image_url": image,
                "page_url": _page_url(collection, code),
                "collection": collection,
            }
        )
        if len(out) >= limit:
            break
    return out


class TechTransferClient(ServiceClient):
    service = "NASA Technology Transfer"

    async def search(self, collection: str, query: str, limit: int = 6) -> list[dict[str, Any]]:
        if collection not in COLLECTIONS:
            raise ValueError(f"coleção desconhecida: {collection}")
        base = self.settings.techtransfer_url.rstrip("/")
        data = await self.get_json(f"{base}/{collection}/{query}")
        return parse_tech_rows(collection, data or {}, limit)

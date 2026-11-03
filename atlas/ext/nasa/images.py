"""NASA Image and Video Library (https://images-api.nasa.gov, sem chave)."""

from __future__ import annotations

from typing import Any

from atlas.ext.nasa.http import ServiceClient


def parse_image_items(data: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    items = ((data or {}).get("collection") or {}).get("items") or []
    out: list[dict[str, Any]] = []
    for item in items:
        meta = (item.get("data") or [{}])[0]
        preview = next(
            (link.get("href") for link in item.get("links") or [] if link.get("rel") == "preview"),
            None,
        )
        nasa_id = meta.get("nasa_id")
        if not preview or not nasa_id:
            continue
        out.append(
            {
                "nasa_id": nasa_id,
                "title": meta.get("title") or nasa_id,
                "description": (meta.get("description") or "")[:400],
                "date_created": meta.get("date_created"),
                "center": meta.get("center"),
                "thumbnail": preview,
                "page_url": f"https://images.nasa.gov/details/{nasa_id}",
            }
        )
        if len(out) >= limit:
            break
    return out


class ImagesClient(ServiceClient):
    service = "NASA Images"

    async def search(self, query: str, limit: int = 6) -> list[dict[str, Any]]:
        data = await self.get_json(
            self.settings.images_url,
            {"q": query, "media_type": "image", "page_size": max(limit * 3, 12)},
        )
        return parse_image_items(data or {}, limit)

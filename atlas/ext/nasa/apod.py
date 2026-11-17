"""APOD — Astronomy Picture of the Day (https://api.nasa.gov, exige chave)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

from atlas.ext.nasa.http import KeyedClient, NasaError, NasaRateLimited


class _ApodPageMetadata(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.values: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() != "meta":
            return
        attributes = dict(attrs)
        name = (attributes.get("property") or attributes.get("name") or "").casefold()
        content = attributes.get("content")
        if name and content:
            self.values[name] = content


def is_apod_payload(data: Any, expected_date: date | None = None) -> bool:
    if not isinstance(data, dict):
        return False

    image_date = data.get("date")
    title = data.get("title")
    media_type = data.get("media_type")
    url = data.get("url")
    if not isinstance(image_date, str) or not isinstance(title, str) or not title.strip():
        return False
    try:
        parsed_date = date.fromisoformat(image_date)
    except ValueError:
        return False
    if parsed_date.isoformat() != image_date or (expected_date and parsed_date != expected_date):
        return False
    if not isinstance(media_type, str) or media_type not in {"image", "video"}:
        return False
    if not isinstance(url, str):
        return False

    parsed_url = urlparse(url)
    return (
        parsed_url.scheme in {"http", "https"}
        and bool(parsed_url.netloc)
        and not parsed_url.path.casefold().endswith("/nasa-logo@2x.png")
    )


def parse_apod_page(html: str, day: date) -> dict[str, Any] | None:
    metadata = _ApodPageMetadata()
    metadata.feed(html)

    image_date = metadata.values.get("article:published_time", "")[:10]
    image_url = unescape(metadata.values.get("og:image", ""))
    page_title = unescape(metadata.values.get("og:title", ""))
    if image_date != day.isoformat() or not image_url:
        return None

    title = page_title.removeprefix("APOD: ")
    title = title.removesuffix(" - NASA Science")
    title = title.removeprefix(f"{day:%Y %B} {day.day} - ").strip()
    if not title or title.casefold() == "nasa science":
        return None

    return {
        "date": image_date,
        "title": title,
        "explanation": unescape(metadata.values.get("og:description", "")),
        "media_type": "image",
        "url": image_url,
        "hdurl": image_url,
    }


class ApodClient(KeyedClient):
    service = "APOD"

    async def picture(self, day: date | None = None) -> dict[str, Any]:
        """Busca a APOD na API; se a API falhar ou responder algo que não é uma
        APOD, tenta a página pública do dia. O limite de cota (429) não tem plano B:
        ele sobe direto para a rota responder 429."""
        params = self.keyed(thumbs="true")
        if day:
            params["date"] = day.isoformat()
        api_error: NasaError | None = None
        try:
            data = await self.get_json(self.url("planetary/apod"), params)
        except NasaRateLimited:
            raise
        except NasaError as exc:
            api_error, data = exc, None
        if is_apod_payload(data, day):
            return data

        image_day = day or datetime.now(UTC).date()
        try:
            page = await self.get_text(f"https://apod.nasa.gov/apod/ap{image_day:%y%m%d}.html")
        except NasaError:
            page = ""
        fallback = parse_apod_page(page, image_day) if page else None
        if fallback is not None and is_apod_payload(fallback, image_day):
            return fallback
        raise api_error or NasaError(self.service, "resposta inválida: não contém uma APOD")

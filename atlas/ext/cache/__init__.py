"""Extensão de cache persistente.

As APIs da NASA têm cota (a chave pessoal permite ~1.000 requisições por hora)
e às vezes ficam fora do ar. Por isso toda resposta externa passa por
``remember``:

1. se existe uma entrada válida no banco, ela é devolvida sem chamar a NASA;
2. senão, ``producer()`` consulta a NASA e o resultado é salvo com validade;
3. se a NASA falhar e houver uma entrada vencida, ela é devolvida marcada como
   ``stale`` (dados antigos são melhores que nenhum dado);
4. sem nada salvo, o erro sobe e vira HTTP 503 (ver ``ext/web``).
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from atlas.ext.cache.models import CacheEntry
from atlas.ext.nasa.http import NasaError


@dataclass(slots=True)
class Cached:
    payload: Any
    fetched_at: datetime
    stale: bool = False
    source: str = ""


def utcnow() -> datetime:
    return datetime.now(UTC)


def _aware(moment: datetime) -> datetime:
    # O SQLite devolve datas sem fuso; tratamos tudo como UTC.
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


_locks: dict[tuple[int, str], asyncio.Lock] = {}


def lock_for(key: str) -> asyncio.Lock:
    """Trava por chave (e por event loop) que evita que duas requisições
    simultâneas busquem a mesma informação na NASA ao mesmo tempo."""
    loop_id = id(asyncio.get_running_loop())
    return _locks.setdefault((loop_id, key), asyncio.Lock())


async def read(session: AsyncSession, key: str) -> CacheEntry | None:
    return await session.get(CacheEntry, key)


async def write(
    session: AsyncSession, key: str, payload: Any, ttl: timedelta, source: str
) -> CacheEntry:
    now = utcnow()
    entry = await session.get(CacheEntry, key)
    if entry is None:
        entry = CacheEntry(key=key)
        session.add(entry)
    entry.payload = payload
    entry.source = source
    entry.fetched_at = now
    entry.expires_at = now + ttl
    await session.commit()
    return entry


async def remember(
    session: AsyncSession,
    key: str,
    ttl: timedelta,
    producer: Callable[[], Awaitable[Any]],
    *,
    source: str,
    force: bool = False,
) -> Cached:
    async with lock_for(key):
        entry = await read(session, key)
        if entry and not force and _aware(entry.expires_at) > utcnow():
            return Cached(entry.payload, _aware(entry.fetched_at), False, entry.source)
        try:
            payload = await producer()
        except NasaError:
            if entry is not None:
                return Cached(entry.payload, _aware(entry.fetched_at), True, entry.source)
            raise
        saved = await write(session, key, payload, ttl, source)
        return Cached(saved.payload, _aware(saved.fetched_at), False, source)


def init_app(app: FastAPI) -> None:
    """O modelo ``CacheEntry`` é registrado por ``ext.db.register_models``;
    não há mais nada a inicializar, mas mantemos o contrato ``init_app``."""
    app.state.cache_enabled = True

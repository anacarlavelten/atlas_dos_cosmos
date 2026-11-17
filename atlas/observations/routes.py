from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query, Response, status

from atlas.ext.db import SessionDep
from atlas.observations import services
from atlas.observations.schemas import (
    ObservationCreatedOut,
    ObservationIn,
    ObservationListOut,
    ObservationOptionsOut,
    ObservationOut,
)

router = APIRouter(prefix="/api/observations", tags=["diário de observação"])


def _out(observation) -> ObservationOut:
    return ObservationOut.model_validate(observation)


@router.get(
    "/options", response_model=ObservationOptionsOut, summary="Opções do formulário de observação"
)
async def form_options() -> ObservationOptionsOut:
    return ObservationOptionsOut(**services.options())


@router.get("", response_model=ObservationListOut, summary="Lista as observações registradas")
async def list_observations(
    session: SessionDep,
    body: str | None = Query(default=None, max_length=60, description="filtra pelo slug do astro"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
) -> ObservationListOut:
    total, items = await services.list_observations(
        session, body_slug=body, offset=offset, limit=limit
    )
    return ObservationListOut(
        total=total, offset=offset, limit=limit, items=[_out(o) for o in items]
    )


@router.post(
    "",
    response_model=ObservationCreatedOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra uma observação (formulário validado no servidor)",
)
async def create_observation(data: ObservationIn, session: SessionDep) -> ObservationCreatedOut:
    observation, token = await services.create_observation(session, data)
    return ObservationCreatedOut(**_out(observation).model_dump(), delete_token=token)


@router.get("/{observation_id}", response_model=ObservationOut, summary="Uma observação")
async def get_observation(observation_id: int, session: SessionDep) -> ObservationOut:
    try:
        return _out(await services.get_observation(session, observation_id))
    except services.ObservationNotFound:
        raise HTTPException(status_code=404, detail="Observação não encontrada.") from None


@router.delete(
    "/{observation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Apaga uma observação (exige o código recebido ao criá-la)",
)
async def delete_observation(
    observation_id: int,
    session: SessionDep,
    x_delete_token: str | None = Header(default=None),
) -> Response:
    try:
        await services.delete_observation(session, observation_id, x_delete_token)
    except services.ObservationNotFound:
        raise HTTPException(status_code=404, detail="Observação não encontrada.") from None
    except services.DeleteForbidden:
        raise HTTPException(
            status_code=403, detail="Só quem registrou a observação pode apagá-la."
        ) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.ambiente import Ambiente
from app.schemas.ambiente import AmbienteResponse
from app.services.disponibilidad import diagnosticar_disponibilidad_ambiente

router = APIRouter()

@router.get("", response_model=list[AmbienteResponse])
def listar_ambientes(db: Session = Depends(get_db)):
    ambientes = db.query(Ambiente).filter(Ambiente.activo == True).order_by(Ambiente.id).all()
    return ambientes


@router.get("/{id}/verificar-horario")
def verificar_horario_ambiente(
    id: int,
    fecha_inicio: datetime = Query(..., description="Fecha y hora de inicio del evento propuesto"),
    fecha_fin: datetime = Query(..., description="Fecha y hora de fin del evento propuesto"),
    solicitud_id_excluir: int | None = Query(None, description="ID de solicitud a excluir (para ediciones)"),
    buffer_minutos: int = Query(60, description="Margen de tiempo requerido entre eventos consecutivos"),
    db: Session = Depends(get_db)
):
    """
    Verifica en tiempo real si el ambiente está disponible y si cumple con
    el intervalo logístico de 1 hora para traslado y acondicionamiento de mobiliario.
    """
    ambiente = db.query(Ambiente).filter(Ambiente.id == id, Ambiente.activo == True).first()
    if not ambiente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El ambiente con ID {id} no existe o no está activo."
        )

    if fecha_fin <= fecha_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha y hora de fin debe ser posterior a la fecha de inicio."
        )

    return diagnosticar_disponibilidad_ambiente(
        db=db,
        ambiente_id=id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        solicitud_id_excluir=solicitud_id_excluir,
        buffer_minutos=buffer_minutos
    )


from pydantic import BaseModel
from app.schemas.solicitud import HorarioSlot
from app.services.disponibilidad import diagnosticar_disponibilidad_multiple

class VerificarHorariosRequest(BaseModel):
    horarios: list[HorarioSlot]
    solicitud_id_excluir: int | None = None
    buffer_minutos: int = 60

@router.post("/{id}/verificar-horarios")
def verificar_horarios_ambiente(
    id: int,
    body: VerificarHorariosRequest,
    db: Session = Depends(get_db)
):
    """
    Verifica en tiempo real si el ambiente está disponible para múltiples fechas y horarios
    y si cumple con el intervalo logístico de 1 hora entre eventos.
    """
    ambiente = db.query(Ambiente).filter(Ambiente.id == id, Ambiente.activo == True).first()
    if not ambiente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El ambiente con ID {id} no existe o no está activo."
        )

    return diagnosticar_disponibilidad_multiple(
        db=db,
        ambiente_id=id,
        horarios=body.horarios,
        solicitud_id_excluir=body.solicitud_id_excluir,
        buffer_minutos=body.buffer_minutos
    )

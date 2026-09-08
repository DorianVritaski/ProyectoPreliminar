from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.solicitud import Solicitud
from app.schemas.solicitud import (
    SolicitudCreate,
    SolicitudResponse,
    SolicitudStatusUpdate
)
from app.services.solicitud_service import (
    crear_solicitud,
    buscar_solicitudes_seguimiento,
    formatear_solicitud_response
)

router = APIRouter()

@router.post("", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
def registrar_solicitud(
    data: SolicitudCreate,
    db: Session = Depends(get_db)
):
    """
    Especificación SDD 5.C:
    POST /api/v1/solicitudes
    Crea una nueva solicitud con validación de RN-01 (solapamiento) y RN-02 (stock).
    """
    return crear_solicitud(db, data)

@router.get("/seguimiento", response_model=list[SolicitudResponse])
def consultar_seguimiento(
    search: str = Query(..., min_length=1, description="Código de ticket o correo institucional"),
    db: Session = Depends(get_db)
):
    """
    Especificación SDD 5.D y RF-01.4:
    GET /api/v1/solicitudes/seguimiento?search=...
    Consulta el estatus de trámites previos por ticket o correo institucional.
    """
    return buscar_solicitudes_seguimiento(db, search)

@router.patch("/{id}/estado", response_model=SolicitudResponse)
def actualizar_estado_solicitud(
    id: int,
    body: SolicitudStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Permite actualizar el estado de una solicitud (PENDIENTE, APROBADO, RECHAZADO)
    para coordinaciones internas y pruebas en vivo.
    """
    solicitud = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")

    nuevo_estado = body.estado.upper()
    if nuevo_estado not in ["PENDIENTE", "APROBADO", "RECHAZADO"]:
        raise HTTPException(
            status_code=400,
            detail="Estado inválido. Debe ser PENDIENTE, APROBADO o RECHAZADO."
        )

    solicitud.estado = nuevo_estado
    if body.motivo_rechazo is not None:
        solicitud.motivo_rechazo = body.motivo_rechazo
    elif nuevo_estado == "APROBADO":
        solicitud.motivo_rechazo = None

    db.commit()
    db.refresh(solicitud)
    return formatear_solicitud_response(db, solicitud)

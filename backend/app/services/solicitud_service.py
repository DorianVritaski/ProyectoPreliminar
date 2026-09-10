import random
import string
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.solicitud import Solicitud, SolicitudRecurso
from app.models.ambiente import Ambiente
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.models.area_solicitante import AreaSolicitante
from app.schemas.solicitud import (
    SolicitudCreate,
    SolicitudResponse,
    SolicitudRecursoDetalleResponse
)
from app.services.disponibilidad import (
    verificar_solapamiento_ambiente,
    calcular_stock_disponible
)

def generar_codigo_ticket(db: Session, anio: int | None = None) -> str:
    """Genera un código único en formato EVT-YYYY-XXXX"""
    if anio is None:
        anio = datetime.utcnow().year
        
    while True:
        sufijo = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        codigo = f"EVT-{anio}-{sufijo}"
        existe = db.query(Solicitud).filter(Solicitud.codigo_ticket == codigo).first()
        if not existe:
            return codigo

def crear_solicitud(db: Session, data: SolicitudCreate) -> SolicitudResponse:
    # 1. Validar que el ambiente exista y esté activo
    ambiente = db.query(Ambiente).filter(Ambiente.id == data.ambiente_id, Ambiente.activo == True).first()
    if not ambiente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El ambiente con ID {data.ambiente_id} no existe o no está activo."
        )

    # 2. Validar que el área solicitante exista y esté activa (RF-01.5)
    area_sol = db.query(AreaSolicitante).filter(
        AreaSolicitante.id == data.area_solicitante_id,
        AreaSolicitante.activa == True
    ).first()
    if not area_sol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El área o facultad solicitante con ID {data.area_solicitante_id} no existe o no está activa."
        )

    # 3. RN-01: Validar solapamiento en el mismo ambiente
    conflicto_ambiente = verificar_solapamiento_ambiente(
        db,
        ambiente_id=data.ambiente_id,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin
    )
    if conflicto_ambiente:
        ini_str = conflicto_ambiente.fecha_inicio.strftime("%H:%M")
        fin_str = conflicto_ambiente.fecha_fin.strftime("%H:%M del %d/%m/%Y")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Conflicto de horario en '{ambiente.nombre}'. "
                f"Ya existe una solicitud ({conflicto_ambiente.codigo_ticket}) "
                f"en estado {conflicto_ambiente.estado} desde las {ini_str} hasta las {fin_str}."
            )
        )

    # 4. RN-02 y RN-03: Validar disponibilidad de stock de cada recurso solicitado
    if data.recursos:
        stock_info = {
            item["id"]: item for item in calcular_stock_disponible(db, data.fecha_inicio, data.fecha_fin)
        }
        for req in data.recursos:
            recurso_stat = stock_info.get(req.recurso_id)
            if not recurso_stat:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"El recurso con ID {req.recurso_id} no existe en el catálogo."
                )
            
            disponible = recurso_stat["stock_disponible"]
            if req.cantidad > disponible:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Stock insuficiente para '{recurso_stat['nombre']}'. "
                        f"Solicitado: {req.cantidad}, Disponible en ese horario: {disponible}."
                    )
                )

    # 5. Crear la solicitud
    codigo_ticket = generar_codigo_ticket(db, anio=data.fecha_inicio.year)
    solicitud = Solicitud(
        codigo_ticket=codigo_ticket,
        correo_solicitante=data.correo_solicitante,
        telefono=data.telefono,
        area_solicitante_id=data.area_solicitante_id,
        ambiente_id=data.ambiente_id,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        estado="PENDIENTE",
        motivo_rechazo=None,
        detalles=data.detalles.strip() if data.detalles else None,
        protocolo_ssoma=data.protocolo_ssoma
    )
    db.add(solicitud)
    db.flush() # Obtiene el ID generado

    # 6. Insertar recursos solicitados
    for req in data.recursos:
        sol_rec = SolicitudRecurso(
            solicitud_id=solicitud.id,
            recurso_id=req.recurso_id,
            cantidad=req.cantidad
        )
        db.add(sol_rec)

    db.commit()
    db.refresh(solicitud)

    return formatear_solicitud_response(db, solicitud)


def formatear_solicitud_response(db: Session, solicitud: Solicitud) -> SolicitudResponse:
    detalles_recursos = (
        db.query(
            SolicitudRecurso.recurso_id,
            SolicitudRecurso.cantidad,
            Recurso.nombre,
            Recurso.es_critico,
            AreaDestino.nombre.label("area_destino_nombre")
        )
        .join(Recurso, SolicitudRecurso.recurso_id == Recurso.id)
        .join(AreaDestino, Recurso.area_destino_id == AreaDestino.id)
        .filter(SolicitudRecurso.solicitud_id == solicitud.id)
        .all()
    )

    recursos_resp = [
        SolicitudRecursoDetalleResponse(
            recurso_id=d.recurso_id,
            nombre=d.nombre,
            area_destino_nombre=d.area_destino_nombre,
            cantidad=d.cantidad,
            es_critico=d.es_critico
        )
        for d in detalles_recursos
    ]

    area_nombre = "Área Institucional"
    if solicitud.area_solicitante:
        area_nombre = solicitud.area_solicitante.nombre

    return SolicitudResponse(
        id=solicitud.id,
        codigo_ticket=solicitud.codigo_ticket,
        correo_solicitante=solicitud.correo_solicitante,
        telefono=solicitud.telefono,
        area_solicitante_id=solicitud.area_solicitante_id,
        area_solicitante=area_nombre,
        ambiente_id=solicitud.ambiente_id,
        ambiente_nombre=solicitud.ambiente.nombre if solicitud.ambiente else "Ambiente",
        fecha_inicio=solicitud.fecha_inicio,
        fecha_fin=solicitud.fecha_fin,
        estado=solicitud.estado,
        motivo_rechazo=solicitud.motivo_rechazo,
        detalles=getattr(solicitud, "detalles", None),
        protocolo_ssoma=solicitud.protocolo_ssoma,
        created_at=solicitud.created_at,
        recursos=recursos_resp
    )


def buscar_solicitudes_seguimiento(db: Session, search: str) -> list[SolicitudResponse]:
    search_clean = search.strip()
    if not search_clean:
        return []

    solicitudes = (
        db.query(Solicitud)
        .filter(
            or_(
                Solicitud.codigo_ticket.ilike(f"%{search_clean}%"),
                Solicitud.correo_solicitante.ilike(f"%{search_clean}%")
            )
        )
        .order_by(Solicitud.created_at.desc())
        .all()
    )

    return [formatear_solicitud_response(db, sol) for sol in solicitudes]

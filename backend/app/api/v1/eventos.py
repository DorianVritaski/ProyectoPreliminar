from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.solicitud import Solicitud, SolicitudRecurso
from app.models.ambiente import Ambiente
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.schemas.evento import EventoCalendarioResponse, RecursoAsignadoEvento

router = APIRouter()

@router.get("", response_model=list[EventoCalendarioResponse])
def obtener_eventos(
    fecha_inicio: datetime | None = Query(None, description="Fecha de inicio del rango a consultar"),
    fecha_fin: datetime | None = Query(None, description="Fecha de fin del rango a consultar"),
    ambiente_id: int | None = Query(None, description="ID del ambiente a filtrar"),
    recurso_critico_id: int | None = Query(None, description="ID del recurso crítico para filtrar eventos"),
    db: Session = Depends(get_db)
):
    """
    Especificación SDD 5.A:
    GET /api/v1/eventos
    Retorna eventos para el calendario interactivo con anonimización de solicitante.
    """
    query = db.query(Solicitud).join(Ambiente, Solicitud.ambiente_id == Ambiente.id)

    # Solo mostramos eventos APROBADOS o en revisión (PENDIENTE)
    query = query.filter(Solicitud.estado.in_(["APROBADO", "PENDIENTE"]))

    if fecha_inicio and fecha_fin:
        query = query.filter(
            Solicitud.fecha_inicio < fecha_fin,
            Solicitud.fecha_fin > fecha_inicio
        )
    elif fecha_inicio:
        query = query.filter(Solicitud.fecha_fin >= fecha_inicio)
    elif fecha_fin:
        query = query.filter(Solicitud.fecha_inicio <= fecha_fin)

    if ambiente_id:
        query = query.filter(Solicitud.ambiente_id == ambiente_id)

    if recurso_critico_id:
        # Filtrar solicitudes que incluyan el recurso
        solicitudes_con_recurso = (
            db.query(SolicitudRecurso.solicitud_id)
            .filter(SolicitudRecurso.recurso_id == recurso_critico_id)
            .subquery()
        )
        query = query.filter(Solicitud.id.in_(solicitudes_con_recurso))

    solicitudes = query.order_by(Solicitud.fecha_inicio.asc()).all()

    resultado = []
    for sol in solicitudes:
        # Cargar recursos asignados
        detalles = (
            db.query(
                SolicitudRecurso.recurso_id,
                SolicitudRecurso.cantidad,
                Recurso.nombre,
                Recurso.es_critico,
                AreaDestino.nombre.label("area_destino_nombre")
            )
            .join(Recurso, SolicitudRecurso.recurso_id == Recurso.id)
            .join(AreaDestino, Recurso.area_destino_id == AreaDestino.id)
            .filter(SolicitudRecurso.solicitud_id == sol.id)
            .all()
        )

        recursos_evento = [
            RecursoAsignadoEvento(
                recurso_id=d.recurso_id,
                recurso=d.nombre,
                cantidad=d.cantidad,
                area_destino=d.area_destino_nombre,
                es_critico=d.es_critico
            )
            for d in detalles
        ]

        # Título del evento para el calendario: ej. "Auditorio UC - EVT-2026-X89F"
        titulo = f"{sol.ambiente.nombre} ({sol.codigo_ticket})" if sol.ambiente else sol.codigo_ticket

        # Nombre del área solicitante
        area_nombre = sol.area_solicitante.nombre if sol.area_solicitante else "Área Institucional"

        resultado.append(
            EventoCalendarioResponse(
                id=sol.id,
                codigo_ticket=sol.codigo_ticket,
                titulo_evento=titulo,
                ambiente_id=sol.ambiente_id,
                ambiente=sol.ambiente.nombre if sol.ambiente else "Ambiente",
                fecha_inicio=sol.fecha_inicio,
                fecha_fin=sol.fecha_fin,
                estado=sol.estado,
                area_solicitante=area_nombre,
                recursos=recursos_evento
            )
        )

    return resultado

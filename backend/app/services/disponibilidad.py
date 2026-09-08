from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.models.solicitud import Solicitud, SolicitudRecurso
from app.models.ambiente import Ambiente

def verificar_solapamiento_ambiente(
    db: Session,
    ambiente_id: int,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    solicitud_id_excluir: int | None = None
) -> Solicitud | None:
    """
    RN-01: No se permitirá enviar solicitudes si el intervalo [FechaInicio, FechaFin]
    coincide con un evento confirmado/en revisión en el mismo ambiente.
    """
    query = db.query(Solicitud).filter(
        Solicitud.ambiente_id == ambiente_id,
        Solicitud.estado.in_(["APROBADO", "PENDIENTE"]),
        Solicitud.fecha_inicio < fecha_fin,
        Solicitud.fecha_fin > fecha_inicio
    )
    if solicitud_id_excluir:
        query = query.filter(Solicitud.id != solicitud_id_excluir)
        
    return query.first()


def calcular_stock_disponible(
    db: Session,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    solicitud_id_excluir: int | None = None
) -> list[dict]:
    """
    RN-02: Para un intervalo de tiempo dado, el número máximo asignable de un recurso es:
    Stock Disponible = Stock Total - sum(Stock Reservado en Eventos Simultáneos)
    """
    # 1. Obtener todos los recursos con su área de destino
    recursos = db.query(Recurso, AreaDestino.nombre.label("area_nombre")).join(
        AreaDestino, Recurso.area_destino_id == AreaDestino.id
    ).order_by(Recurso.area_destino_id, Recurso.id).all()

    # 2. Subconsulta o cálculo de reservas simultáneas aprobadas o pendientes
    filtro_eventos = [
        Solicitud.estado.in_(["APROBADO", "PENDIENTE"]),
        Solicitud.fecha_inicio < fecha_fin,
        Solicitud.fecha_fin > fecha_inicio
    ]
    if solicitud_id_excluir:
        filtro_eventos.append(Solicitud.id != solicitud_id_excluir)

    reservas_simultaneas = db.query(
        SolicitudRecurso.recurso_id,
        func.coalesce(func.sum(SolicitudRecurso.cantidad), 0).label("total_reservado")
    ).join(
        Solicitud, SolicitudRecurso.solicitud_id == Solicitud.id
    ).filter(
        *filtro_eventos
    ).group_by(
        SolicitudRecurso.recurso_id
    ).all()

    dict_reservados = {r.recurso_id: int(r.total_reservado) for r in reservas_simultaneas}

    resultado = []
    for rec, area_nombre in recursos:
        reservado = dict_reservados.get(rec.id, 0)
        disponible = max(0, rec.stock_total - reservado)
        resultado.append({
            "id": rec.id,
            "nombre": rec.nombre,
            "area_destino_id": rec.area_destino_id,
            "area_destino_nombre": area_nombre,
            "stock_total": rec.stock_total,
            "stock_reservado": reservado,
            "stock_disponible": disponible,
            "es_critico": rec.es_critico
        })

    return resultado

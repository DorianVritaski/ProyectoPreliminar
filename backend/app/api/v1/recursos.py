from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.schemas.recurso import (
    RecursoResponse,
    DisponibilidadRequest,
    DisponibilidadResponse,
    RecursoDisponibilidadItem
)
from app.services.disponibilidad import calcular_stock_disponible, calcular_stock_disponible_horarios

router = APIRouter()

@router.get("/catalogo")
def catalogo_recursos(db: Session = Depends(get_db)):
    """Retorna el catálogo completo de recursos agrupados por área destino (solo áreas activas)"""
    areas = db.query(AreaDestino).filter(AreaDestino.activa == True).order_by(AreaDestino.id).all()
    resultado = []
    for area in areas:
        recursos = db.query(Recurso).filter(Recurso.area_destino_id == area.id).order_by(Recurso.id).all()
        resultado.append({
            "area_id": area.id,
            "area_nombre": area.nombre,
            "recursos": [
                {
                    "id": r.id,
                    "nombre": r.nombre,
                    "stock_total": r.stock_total,
                    "es_critico": r.es_critico
                }
                for r in recursos
            ]
        })
    return resultado


@router.post("/disponibilidad", response_model=DisponibilidadResponse)
def consultar_disponibilidad(
    body: DisponibilidadRequest,
    db: Session = Depends(get_db)
):
    """
    Especificación SDD 5.B:
    POST /api/v1/recursos/disponibilidad
    Devuelve el saldo libre de cada bien para una franja horaria o conjunto de horarios.
    """
    if body.horarios and len(body.horarios) > 0:
        horarios_tuples = [(h.fecha_inicio, h.fecha_fin) for h in body.horarios]
        disponibles = calcular_stock_disponible_horarios(db, horarios_tuples)
        items = [RecursoDisponibilidadItem(**item) for item in disponibles]
        return DisponibilidadResponse(
            fecha_inicio=body.horarios[0].fecha_inicio,
            fecha_fin=body.horarios[-1].fecha_fin,
            horarios=body.horarios,
            recursos=items
        )

    disponibles = calcular_stock_disponible(
        db=db,
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin
    )
    items = [RecursoDisponibilidadItem(**item) for item in disponibles]
    return DisponibilidadResponse(
        fecha_inicio=body.fecha_inicio,
        fecha_fin=body.fecha_fin,
        recursos=items
    )

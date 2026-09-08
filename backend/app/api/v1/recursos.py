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
from app.services.disponibilidad import calcular_stock_disponible

router = APIRouter()

@router.get("/catalogo")
def catalogo_recursos(db: Session = Depends(get_db)):
    """Retorna el catálogo completo de recursos agrupados por área destino"""
    areas = db.query(AreaDestino).order_by(AreaDestino.id).all()
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
    Devuelve el saldo libre de cada bien para esa franja horaria.
    """
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

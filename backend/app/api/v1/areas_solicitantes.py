from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.area_solicitante import AreaSolicitante
from app.schemas.area_solicitante import AreaSolicitanteResponse

router = APIRouter()

@router.get("", response_model=list[AreaSolicitanteResponse])
def listar_areas_solicitantes(db: Session = Depends(get_db)):
    """
    Especificación SDD v1.1 - 4.A:
    GET /api/v1/areas-solicitantes
    Obtiene la lista activa de áreas/facultades para poblar el dropdown del formulario.
    """
    areas = db.query(AreaSolicitante).filter(AreaSolicitante.activa == True).order_by(AreaSolicitante.nombre).all()
    return areas

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.ambiente import Ambiente
from app.schemas.ambiente import AmbienteResponse

router = APIRouter()

@router.get("", response_model=list[AmbienteResponse])
def listar_ambientes(db: Session = Depends(get_db)):
    ambientes = db.query(Ambiente).filter(Ambiente.activo == True).order_by(Ambiente.id).all()
    return ambientes

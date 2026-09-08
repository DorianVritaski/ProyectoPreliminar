from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Recurso(Base):
    __tablename__ = "recursos"

    id = Column(Integer, primary_key=True, index=True)
    area_destino_id = Column(Integer, ForeignKey("areas_destino.id"), nullable=False)
    nombre = Column(String(100), nullable=False)
    stock_total = Column(Integer, nullable=False)
    es_critico = Column(Boolean, default=False)

    area_destino = relationship("AreaDestino", back_populates="recursos")
    solicitudes_detalle = relationship("SolicitudRecurso", back_populates="recurso")

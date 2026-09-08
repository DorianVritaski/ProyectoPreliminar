from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class AreaSolicitante(Base):
    __tablename__ = "areas_solicitantes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), unique=True, nullable=False)
    activa = Column(Boolean, default=True)

    solicitudes = relationship("Solicitud", back_populates="area_solicitante")

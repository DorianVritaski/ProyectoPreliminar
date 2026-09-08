from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Ambiente(Base):
    __tablename__ = "ambientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    capacidad = Column(Integer, default=0)
    activo = Column(Boolean, default=True)

    solicitudes = relationship("Solicitud", back_populates="ambiente")

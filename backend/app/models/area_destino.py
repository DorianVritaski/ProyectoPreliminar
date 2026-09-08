from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class AreaDestino(Base):
    __tablename__ = "areas_destino"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    activa = Column(Boolean, default=True)

    recursos = relationship("Recurso", back_populates="area_destino")

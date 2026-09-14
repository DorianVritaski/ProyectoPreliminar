import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class UsuarioAdmin(Base):
    __tablename__ = "usuarios_admin"

    id = Column(Integer, primary_key=True, index=True)
    correo = Column(String(150), unique=True, nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    area_destino_id = Column(Integer, ForeignKey("areas_destino.id"), nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    area_destino = relationship("AreaDestino")

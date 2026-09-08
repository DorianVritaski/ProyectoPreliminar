import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.core.database import Base

class UsuarioAdmin(Base):
    __tablename__ = "usuarios_admin"

    id = Column(Integer, primary_key=True, index=True)
    correo = Column(String(150), unique=True, nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

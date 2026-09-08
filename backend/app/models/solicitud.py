import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, CheckConstraint, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Solicitud(Base):
    __tablename__ = "solicitudes"
    __table_args__ = (
        CheckConstraint("fecha_fin > fecha_inicio", name="check_fechas"),
    )

    id = Column(Integer, primary_key=True, index=True)
    codigo_ticket = Column(String(20), unique=True, nullable=False, index=True)
    correo_solicitante = Column(String(150), nullable=False, index=True)
    telefono = Column(String(20), nullable=False)
    area_solicitante_id = Column(Integer, ForeignKey("areas_solicitantes.id"), nullable=True)
    ambiente_id = Column(Integer, ForeignKey("ambientes.id"), nullable=False)
    fecha_inicio = Column(DateTime, nullable=False, index=True)
    fecha_fin = Column(DateTime, nullable=False, index=True)
    estado = Column(String(20), default="PENDIENTE", nullable=False, index=True) # PENDIENTE, APROBADO, RECHAZADO
    motivo_rechazo = Column(Text, nullable=True)
    protocolo_ssoma = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    ambiente = relationship("Ambiente", back_populates="solicitudes")
    area_solicitante = relationship("AreaSolicitante", back_populates="solicitudes")
    recursos_solicitados = relationship("SolicitudRecurso", back_populates="solicitud", cascade="all, delete-orphan")


class SolicitudRecurso(Base):
    __tablename__ = "solicitud_recursos"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="check_cantidad_positiva"),
    )

    id = Column(Integer, primary_key=True, index=True)
    solicitud_id = Column(Integer, ForeignKey("solicitudes.id", ondelete="CASCADE"), nullable=False)
    recurso_id = Column(Integer, ForeignKey("recursos.id"), nullable=False)
    cantidad = Column(Integer, nullable=False)

    solicitud = relationship("Solicitud", back_populates="recursos_solicitados")
    recurso = relationship("Recurso", back_populates="solicitudes_detalle")

import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from app.core.database import Base

class SolicitudAcceso(Base):
    __tablename__ = "solicitudes_accesos"

    id = Column(Integer, primary_key=True, index=True)
    codigo_acceso = Column(String(20), unique=True, nullable=False, index=True) # Ej: ACC-2026-X901
    
    # Datos del anfitrión / solicitante institucional
    anfitrion_correo = Column(String(255), nullable=False, index=True)
    anfitrion_nombre = Column(Text, nullable=True)
    anfitrion_area = Column(Text, nullable=True)
    
    # Destino y tiempo en campus
    sede = Column(String(255), nullable=False, default="Campus Huancayo")
    ubicacion_especifica = Column(Text, nullable=False) # Ej: Pabellón G, Auditorio Los Andes
    motivo = Column(Text, nullable=False) # Reunión Académica, Proveedor / Obra, Ponencia, etc.
    fecha_inicio = Column(DateTime, nullable=False, index=True)
    fecha_fin = Column(DateTime, nullable=False, index=True)
    detalles = Column(Text, nullable=True)

    # Regla SSOMA - Apartado 3 (Trabajos de Riesgo / Contratistas)
    requiere_ssoma_riesgo = Column(Boolean, default=False, nullable=False, index=True)
    lineamientos_ssoma = Column(Text, nullable=True)
    observacion_ssoma = Column(Text, nullable=True)
    
    # Documentos SSOMA (PDFs)
    url_sctr_pdf = Column(Text, nullable=True)
    url_lista_personal_pdf = Column(Text, nullable=True)
    documentos_ssoma = Column(JSON, nullable=True)

    # Lista de visitantes / nómina
    # Estructura: [{"id": 1, "nombre": "...", "dni": "...", "empresa": "...", "ingresado": false, "hora_ingreso": null}]
    visitantes = Column(JSON, nullable=True)

    # Estado del pase de acceso:
    # PENDIENTE: Requiere revisión de SCTR por SSOMA (Caso A)
    # AUTORIZADO: Aprobado por SSOMA (Caso A) o automáticamente (Caso B)
    # OBSERVADO: SSOMA detectó inconsistencias en SCTR/personal
    estado = Column(String(20), default="PENDIENTE", nullable=False, index=True)

    # Control Operativo de Garita (Seguridad Interna y Vigilancia)
    check_in_realizado = Column(Boolean, default=False, nullable=False, index=True)
    fecha_check_in = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

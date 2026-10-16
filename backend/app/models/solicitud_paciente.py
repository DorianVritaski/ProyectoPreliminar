import datetime
from sqlalchemy import Column, Integer, String, Boolean, Date, Time, DateTime, Text
from app.core.database import Base

class SolicitudPaciente(Base):
    __tablename__ = "solicitudes_pacientes"

    id = Column(Integer, primary_key=True, index=True)
    codigo_ticket = Column(String(20), unique=True, nullable=False, index=True) # Ej: PAC-2026-0102
    escuela_profesional = Column(String(100), nullable=False, index=True) # ODONTOLOGIA, PSICOLOGIA, ENFERMERIA / TERAPIA FISICA
    
    # Datos del estudiante a cargo
    estudiante_correo = Column(String(150), nullable=False, index=True)
    estudiante_nombre = Column(String(150), nullable=False)
    estudiante_dni = Column(String(15), nullable=False, index=True)
    estudiante_telefono = Column(String(20), nullable=True)

    # Datos del paciente
    paciente_nombre = Column(String(150), nullable=False, index=True)
    paciente_dni = Column(String(15), nullable=False, index=True)
    paciente_telefono = Column(String(20), nullable=True)

    # Menor de edad y apoderado
    es_menor_edad = Column(Boolean, default=False, nullable=False)
    apoderado_nombre = Column(String(150), nullable=True)
    apoderado_dni = Column(String(15), nullable=True)

    # Asignatura / Curso
    asignatura = Column(String(150), nullable=False)
    nrc = Column(String(20), nullable=True)
    docente_nombre = Column(String(150), nullable=True)

    # Cita / Atención
    fecha_atencion = Column(Date, nullable=False, index=True)
    horario_inicio = Column(Time, nullable=False)
    horario_fin = Column(Time, nullable=False)

    # Consentimiento informado / DNI
    url_consentimiento_pdf = Column(String(500), nullable=True)
    declaracion_aceptada = Column(Boolean, default=True, nullable=False)

    # Control Operativo de Garita / Vigilancia
    ingresado_garita = Column(Boolean, default=False, nullable=False, index=True)
    fecha_ingreso_real = Column(DateTime, nullable=True)

    # Control SSOMA
    estado = Column(String(20), default="REGISTRADO", nullable=False, index=True) # REGISTRADO, OBSERVADO, INGRESADO
    observaciones_ssoma = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

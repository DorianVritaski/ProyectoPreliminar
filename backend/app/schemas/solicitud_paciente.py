from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class SolicitudPacienteCreate(BaseModel):
    escuela_profesional: str = Field(..., description="Escuela o carrera: Odontología, Psicología (Cámara Gesell), Enfermería / Terapia Física")
    estudiante_correo: str = Field(..., description="Correo institucional @continental.edu.pe")
    estudiante_nombre: str = Field(..., description="Apellidos y nombres del estudiante")
    estudiante_dni: str = Field(..., description="DNI del estudiante (8 dígitos)")
    estudiante_telefono: Optional[str] = Field(None, description="Teléfono de contacto")

    paciente_nombre: str = Field(..., description="Apellidos y nombres del paciente")
    paciente_dni: str = Field(..., description="DNI o Carnet de Extranjería del paciente")
    paciente_telefono: Optional[str] = Field(None, description="Teléfono del paciente o apoderado")

    es_menor_edad: bool = Field(False, description="Indica si el paciente es menor de edad")
    apoderado_nombre: Optional[str] = Field(None, description="Nombre completo del apoderado si es menor")
    apoderado_dni: Optional[str] = Field(None, description="DNI del apoderado si es menor")

    asignatura: str = Field(..., description="Asignatura o curso práctico")
    nrc: Optional[str] = Field(None, description="NRC del curso")
    docente_nombre: Optional[str] = Field(None, description="Docente a cargo (obligatorio en Psicología Gesell)")

    fecha_atencion: date = Field(..., description="Fecha programada de la cita")
    horario_inicio: str = Field(..., description="Hora de inicio (ej. 08:40)")
    horario_fin: str = Field(..., description="Hora de fin (ej. 10:10)")

    url_consentimiento_pdf: Optional[str] = Field(None, description="URL del Consentimiento Informado y DNI escaneado")
    declaracion_aceptada: bool = Field(True, description="Aceptación de la declaración de responsabilidad")

    @field_validator("estudiante_correo")
    @classmethod
    def validate_correo(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean.endswith("@continental.edu.pe"):
            raise ValueError("El correo del estudiante debe pertenecer al dominio institucional (@continental.edu.pe).")
        return clean

    @field_validator("estudiante_dni")
    @classmethod
    def validate_estudiante_dni(cls, v: str) -> str:
        clean = v.strip()
        if not clean.isdigit() or len(clean) != 8:
            raise ValueError("El DNI del estudiante debe contener exactamente 8 dígitos numéricos.")
        return clean

    @field_validator("declaracion_aceptada")
    @classmethod
    def validate_declaracion(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Debe aceptar la declaración de responsabilidad para continuar.")
        return v


class SolicitudPacienteCheckIn(BaseModel):
    ingresado_garita: bool = True


class SolicitudPacienteSSOMAUpdate(BaseModel):
    estado: Optional[str] = Field(None, description="REGISTRADO, AUTORIZADO, OBSERVADO")
    observaciones_ssoma: Optional[str] = None


class SolicitudPacienteResponse(BaseModel):
    id: int
    codigo_ticket: str
    escuela_profesional: str
    estudiante_correo: str
    estudiante_nombre: str
    estudiante_dni: str
    estudiante_telefono: Optional[str] = None
    paciente_nombre: str
    paciente_dni: str
    paciente_telefono: Optional[str] = None
    es_menor_edad: bool
    apoderado_nombre: Optional[str] = None
    apoderado_dni: Optional[str] = None
    asignatura: str
    nrc: Optional[str] = None
    docente_nombre: Optional[str] = None
    fecha_atencion: date
    horario_inicio: time
    horario_fin: time
    url_consentimiento_pdf: Optional[str] = None
    declaracion_aceptada: bool
    ingresado_garita: bool
    fecha_ingreso_real: Optional[datetime] = None
    estado: str
    observaciones_ssoma: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

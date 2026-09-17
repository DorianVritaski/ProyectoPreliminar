from datetime import datetime
import re
from pydantic import BaseModel, Field, field_validator

class RecursoItemRequest(BaseModel):
    recurso_id: int
    cantidad: int = Field(gt=0, description="Cantidad debe ser mayor a 0")

class SolicitudCreate(BaseModel):
    correo_solicitante: str
    telefono: str = Field(min_length=6, max_length=20)
    area_solicitante_id: int = Field(description="ID del catálogo administrable de áreas solicitantes (RF-01.5)")
    ambiente_id: int
    fecha_inicio: datetime
    fecha_fin: datetime
    detalles: str | None = None
    croquis_url: str | None = None
    protocolo_ssoma: bool = False
    requiere_ssoma: bool = False
    url_sctr_pdf: str | None = None
    url_personal_externo_pdf: str | None = None
    recursos: list[RecursoItemRequest] = []

    @field_validator("correo_solicitante")
    @classmethod
    def validate_correo_institucional(cls, v: str) -> str:
        clean_email = v.strip().lower()
        # Ensure it contains @continental.edu.pe
        if not re.match(r"^[\w\.-]+@([\w-]+\.)*continental\.edu\.pe$", clean_email) and not clean_email.endswith("@continental.edu.pe"):
            raise ValueError("El correo debe pertenecer al dominio institucional (@continental.edu.pe)")
        return clean_email

    @field_validator("fecha_fin")
    @classmethod
    def validate_fechas(cls, v: datetime, info) -> datetime:
        fecha_inicio = info.data.get("fecha_inicio")
        if fecha_inicio and v <= fecha_inicio:
            raise ValueError("La fecha y hora de fin debe ser posterior a la fecha y hora de inicio")
        return v

class ConformidadAreaResponse(BaseModel):
    id: int
    area_destino_id: int
    area_destino_nombre: str
    estado: str # PENDIENTE, CONFORME, OBSERVADO
    observacion: str | None = None
    aprobado_por: int | None = None
    aprobado_por_nombre: str | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

class ConformidadUpdate(BaseModel):
    estado: str # CONFORME, OBSERVADO, PENDIENTE
    observacion: str | None = None
    usuario_admin_id: int | None = None
    lineamientos_ssoma: str | None = None

class LineamientosSSOMAUpdate(BaseModel):
    lineamientos_ssoma: str

class SolicitudRecursoDetalleResponse(BaseModel):
    recurso_id: int
    nombre: str
    area_destino_id: int | None = None
    area_destino_nombre: str
    cantidad: int
    es_critico: bool = False

class SolicitudResponse(BaseModel):
    id: int
    codigo_ticket: str
    correo_solicitante: str
    telefono: str
    area_solicitante_id: int | None = None
    area_solicitante: str
    ambiente_id: int
    ambiente_nombre: str
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str
    motivo_rechazo: str | None = None
    detalles: str | None = None
    croquis_url: str | None = None
    protocolo_ssoma: bool
    requiere_ssoma: bool = False
    url_sctr_pdf: str | None = None
    url_personal_externo_pdf: str | None = None
    lineamientos_ssoma: str | None = None
    created_at: datetime
    recursos: list[SolicitudRecursoDetalleResponse] = []
    conformidades: list[ConformidadAreaResponse] = []
    requiere_conformidad_ti: bool = False
    conformidad_ti_aprobada: bool = True
    requiere_conformidad_ssoma: bool = False
    conformidad_ssoma_aprobada: bool = True
    todas_conformidades_aprobadas: bool = True

    class Config:
        from_attributes = True

class SolicitudStatusUpdate(BaseModel):
    estado: str # PENDIENTE, APROBADO, RECHAZADO
    motivo_rechazo: str | None = None

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    user: dict
    message: str

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
    protocolo_ssoma: bool = False
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

class SolicitudRecursoDetalleResponse(BaseModel):
    recurso_id: int
    nombre: str
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
    protocolo_ssoma: bool
    created_at: datetime
    recursos: list[SolicitudRecursoDetalleResponse] = []

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

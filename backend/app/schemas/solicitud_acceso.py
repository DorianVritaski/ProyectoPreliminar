from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Any

class VisitanteSchema(BaseModel):
    id: int | None = None
    nombre: str
    dni: str
    empresa: str | None = None
    ingresado: bool = False
    hora_ingreso: str | None = None

class SolicitudAccesoCreate(BaseModel):
    anfitrion_correo: str
    anfitrion_nombre: str | None = None
    anfitrion_area: str | None = None
    sede: str = "Campus Huancayo"
    ubicacion_especifica: str
    motivo: str
    fecha_inicio: datetime
    fecha_fin: datetime
    detalles: str | None = None
    requiere_ssoma_riesgo: bool = False
    url_sctr_pdf: str | None = None
    url_lista_personal_pdf: str | None = None
    documentos_ssoma: Any | None = None
    visitantes: list[dict] | list[VisitanteSchema] | None = None

class SolicitudAccesoSSOMAUpdate(BaseModel):
    estado: str # AUTORIZADO, OBSERVADO
    lineamientos_ssoma: str | None = None
    observacion_ssoma: str | None = None

class SolicitudAccesoCheckInUpdate(BaseModel):
    check_in_realizado: bool = True
    visitante_dni: str | None = None # Si es None, marca check-in a todo el grupo
    visitantes: list[dict] | None = None

class SolicitudAccesoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_acceso: str
    anfitrion_correo: str
    anfitrion_nombre: str | None
    anfitrion_area: str | None
    sede: str
    ubicacion_especifica: str
    motivo: str
    fecha_inicio: datetime
    fecha_fin: datetime
    detalles: str | None
    requiere_ssoma_riesgo: bool
    lineamientos_ssoma: str | None
    observacion_ssoma: str | None
    url_sctr_pdf: str | None
    url_lista_personal_pdf: str | None
    documentos_ssoma: Any | None
    visitantes: Any | None
    estado: str
    check_in_realizado: bool
    fecha_check_in: datetime | None
    created_at: datetime

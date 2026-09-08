from datetime import datetime
from pydantic import BaseModel

class RecursoAsignadoEvento(BaseModel):
    recurso_id: int | None = None
    recurso: str
    cantidad: int
    area_destino: str | None = None
    es_critico: bool = False

class EventoCalendarioResponse(BaseModel):
    id: int
    codigo_ticket: str
    titulo_evento: str
    ambiente_id: int
    ambiente: str
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: str
    area_solicitante: str
    recursos: list[RecursoAsignadoEvento] = []

    class Config:
        from_attributes = True

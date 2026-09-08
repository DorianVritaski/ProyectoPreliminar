from datetime import datetime
from pydantic import BaseModel, Field

class RecursoBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    area_destino_id: int
    stock_total: int = Field(ge=0)
    es_critico: bool = False

class RecursoCreate(RecursoBase):
    pass

class RecursoStockUpdate(BaseModel):
    stock_total: int = Field(ge=0, description="Nuevo stock total del recurso")

class RecursoUpdate(BaseModel):
    nombre: str | None = None
    area_destino_id: int | None = None
    stock_total: int | None = Field(default=None, ge=0)
    es_critico: bool | None = None

class RecursoResponse(RecursoBase):
    id: int
    area_destino_nombre: str | None = None

    class Config:
        from_attributes = True

class DisponibilidadRequest(BaseModel):
    fecha_inicio: datetime
    fecha_fin: datetime

class RecursoDisponibilidadItem(BaseModel):
    id: int
    nombre: str
    area_destino_id: int
    area_destino_nombre: str
    stock_total: int
    stock_reservado: int
    stock_disponible: int
    es_critico: bool

class DisponibilidadResponse(BaseModel):
    fecha_inicio: datetime
    fecha_fin: datetime
    recursos: list[RecursoDisponibilidadItem]

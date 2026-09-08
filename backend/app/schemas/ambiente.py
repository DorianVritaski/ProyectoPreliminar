from pydantic import BaseModel, Field

class AmbienteBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    capacidad: int = 0
    activo: bool = True

class AmbienteCreate(AmbienteBase):
    pass

class AmbienteUpdate(BaseModel):
    nombre: str | None = None
    capacidad: int | None = None
    activo: bool | None = None

class AmbienteResponse(AmbienteBase):
    id: int

    class Config:
        from_attributes = True

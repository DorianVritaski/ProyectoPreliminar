from pydantic import BaseModel, Field

class AreaDestinoBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    activa: bool = True

class AreaDestinoCreate(AreaDestinoBase):
    pass

class AreaDestinoUpdate(BaseModel):
    nombre: str | None = None
    activa: bool | None = None

class AreaDestinoResponse(AreaDestinoBase):
    id: int
    recursos_count: int = 0

    class Config:
        from_attributes = True

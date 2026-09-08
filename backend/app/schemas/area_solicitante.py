from pydantic import BaseModel, Field

class AreaSolicitanteBase(BaseModel):
    nombre: str = Field(min_length=3, max_length=150)
    activa: bool = True

class AreaSolicitanteCreate(AreaSolicitanteBase):
    pass

class AreaSolicitanteUpdate(BaseModel):
    nombre: str | None = None
    activa: bool | None = None

class AreaSolicitanteResponse(AreaSolicitanteBase):
    id: int

    class Config:
        from_attributes = True

from datetime import datetime
import re
from pydantic import BaseModel, Field, field_validator

class UsuarioAdminBase(BaseModel):
    correo: str
    nombre: str = Field(min_length=3, max_length=150)
    activo: bool = True

    @field_validator("correo")
    @classmethod
    def validate_correo_admin(cls, v: str) -> str:
        clean_email = v.strip().lower()
        if not re.match(r"^[\w\.-]+@([\w-]+\.)*continental\.edu\.pe$", clean_email) and not clean_email.endswith("@continental.edu.pe"):
            raise ValueError("El correo de administración debe pertenecer al dominio institucional (@continental.edu.pe)")
        return clean_email

class UsuarioAdminCreate(UsuarioAdminBase):
    password: str = Field(min_length=6, description="Contraseña de acceso (mínimo 6 caracteres)")

class UsuarioAdminUpdate(BaseModel):
    nombre: str | None = None
    activo: bool | None = None
    password: str | None = Field(default=None, min_length=6)

class UsuarioAdminResponse(UsuarioAdminBase):
    id: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True

from datetime import datetime
import re
from pydantic import BaseModel, Field, field_validator

class UsuarioAdminBase(BaseModel):
    correo: str
    nombre: str = Field(min_length=3, max_length=150)
    activo: bool = True
    area_destino_id: int | None = Field(default=None, description="ID del área operativa asignada (ej. 2 para TI). NULL para Jefatura de Operaciones.")

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
    correo: str | None = None
    activo: bool | None = None
    password: str | None = Field(default=None, min_length=6)
    area_destino_id: int | None = None

    @field_validator("correo")
    @classmethod
    def validate_correo_update(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean_email = v.strip().lower()
        if not re.match(r"^[\w\.-]+@([\w-]+\.)*continental\.edu\.pe$", clean_email) and not clean_email.endswith("@continental.edu.pe"):
            raise ValueError("El correo de administración debe pertenecer al dominio institucional (@continental.edu.pe)")
        return clean_email

class UsuarioAdminResponse(UsuarioAdminBase):
    id: int
    area_destino_nombre: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True

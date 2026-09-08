import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "GestEvents API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "db")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "gestevents_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "gestevents_pass")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "gestevents_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Se añade +psycopg2 para que SQLAlchemy reconozca el driver correctamente en producción
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    CORS_ORIGINS: list[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://proyectopreliminar.onrender.com",  # Reemplázala por la URL real de tu Frontend de Render si es distinta
        "*"
    ]

    class Config:
        case_sensitive = True

settings = Settings()
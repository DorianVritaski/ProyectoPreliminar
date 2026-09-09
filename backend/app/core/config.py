import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "GestEvents API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str | None = os.getenv("DATABASE_URL", None)
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "db")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "gestevents_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "gestevents_pass")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "gestevents_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            uri = self.DATABASE_URL.strip()
            # Ajuste de protocolo postgres:// a postgresql:// para compatibilidad con SQLAlchemy 2+
            if uri.startswith("postgres://"):
                uri = uri.replace("postgres://", "postgresql://", 1)
            # Requerir SSL si se conecta a Supabase o proveedores en la nube
            if ("supabase.co" in uri or "pooler.supabase.com" in uri) and "sslmode=" not in uri:
                sep = "&" if "?" in uri else "?"
                uri = f"{uri}{sep}sslmode=require"
            return uri
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def CORS_ORIGINS(self) -> list[str]:
        cors_env = os.getenv("CORS_ORIGINS")
        if cors_env:
            return [origin.strip() for origin in cors_env.split(",") if origin.strip()]
        return [
            "http://localhost",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "*"
        ]

    class Config:
        case_sensitive = True

settings = Settings()

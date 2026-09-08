import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
import app.models # Registra todos los modelos
from app.services.seed_data import seed_database
from app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Esperar y reintentar conexión con PostgreSQL al arrancar
    retries = 10
    while retries > 0:
        try:
            print("Verificando conexión con PostgreSQL...")
            Base.metadata.create_all(bind=engine)
            with SessionLocal() as db:
                seed_database(db)
            print("Base de datos lista e inicializada con éxito.")
            break
        except OperationalError as e:
            retries -= 1
            print(f"Base de datos no disponible todavía ({retries} intentos restantes). Esperando 2 segundos...")
            time.sleep(2)
        except Exception as e:
            print(f"Error durante la inicialización: {e}")
            break
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "GestEvents API",
        "version": settings.VERSION
    }

app.include_router(api_router, prefix=settings.API_V1_STR)

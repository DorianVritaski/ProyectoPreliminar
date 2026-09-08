from fastapi import APIRouter
from app.api.v1.ambientes import router as ambientes_router
from app.api.v1.recursos import router as recursos_router
from app.api.v1.solicitudes import router as solicitudes_router
from app.api.v1.eventos import router as eventos_router
from app.api.v1.areas_solicitantes import router as areas_solicitantes_router
from app.api.v1.admin import router as admin_router

api_router = APIRouter()

api_router.include_router(ambientes_router, prefix="/ambientes", tags=["Ambientes"])
api_router.include_router(recursos_router, prefix="/recursos", tags=["Recursos"])
api_router.include_router(eventos_router, prefix="/eventos", tags=["Eventos"])
api_router.include_router(solicitudes_router, prefix="/solicitudes", tags=["Solicitudes"])
api_router.include_router(areas_solicitantes_router, prefix="/areas-solicitantes", tags=["Áreas Solicitantes"])
api_router.include_router(admin_router, prefix="/admin", tags=["Administración Jefatura de Operaciones"])

from app.schemas.ambiente import (
    AmbienteBase,
    AmbienteCreate,
    AmbienteUpdate,
    AmbienteResponse
)
from app.schemas.recurso import (
    RecursoBase,
    RecursoCreate,
    RecursoStockUpdate,
    RecursoUpdate,
    RecursoResponse,
    DisponibilidadRequest,
    RecursoDisponibilidadItem,
    DisponibilidadResponse
)
from app.schemas.evento import EventoCalendarioResponse, RecursoAsignadoEvento
from app.schemas.solicitud import (
    RecursoItemRequest,
    SolicitudCreate,
    SolicitudResponse,
    SolicitudRecursoDetalleResponse,
    SolicitudStatusUpdate,
    AdminLoginRequest,
    AdminLoginResponse
)
from app.schemas.area_solicitante import (
    AreaSolicitanteBase,
    AreaSolicitanteCreate,
    AreaSolicitanteUpdate,
    AreaSolicitanteResponse
)
from app.schemas.area_destino import (
    AreaDestinoBase,
    AreaDestinoCreate,
    AreaDestinoUpdate,
    AreaDestinoResponse
)
from app.schemas.usuario_admin import (
    UsuarioAdminBase,
    UsuarioAdminCreate,
    UsuarioAdminUpdate,
    UsuarioAdminResponse
)

__all__ = [
    "AmbienteBase",
    "AmbienteCreate",
    "AmbienteUpdate",
    "AmbienteResponse",
    "RecursoBase",
    "RecursoCreate",
    "RecursoStockUpdate",
    "RecursoUpdate",
    "RecursoResponse",
    "DisponibilidadRequest",
    "RecursoDisponibilidadItem",
    "DisponibilidadResponse",
    "EventoCalendarioResponse",
    "RecursoAsignadoEvento",
    "RecursoItemRequest",
    "SolicitudCreate",
    "SolicitudResponse",
    "SolicitudRecursoDetalleResponse",
    "SolicitudStatusUpdate",
    "AdminLoginRequest",
    "AdminLoginResponse",
    "AreaSolicitanteBase",
    "AreaSolicitanteCreate",
    "AreaSolicitanteUpdate",
    "AreaSolicitanteResponse",
    "AreaDestinoBase",
    "AreaDestinoCreate",
    "AreaDestinoUpdate",
    "AreaDestinoResponse",
    "UsuarioAdminBase",
    "UsuarioAdminCreate",
    "UsuarioAdminUpdate",
    "UsuarioAdminResponse",
]

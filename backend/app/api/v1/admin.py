from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.database import get_db
from app.models.solicitud import Solicitud, SolicitudRecurso
from app.models.ambiente import Ambiente
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.models.area_solicitante import AreaSolicitante
from app.models.usuario_admin import UsuarioAdmin

from app.schemas.solicitud import (
    SolicitudResponse,
    SolicitudStatusUpdate,
    AdminLoginRequest,
    AdminLoginResponse
)
from app.schemas.area_solicitante import (
    AreaSolicitanteResponse,
    AreaSolicitanteCreate,
    AreaSolicitanteUpdate
)
from app.schemas.ambiente import (
    AmbienteResponse,
    AmbienteCreate,
    AmbienteUpdate
)
from app.schemas.recurso import (
    RecursoResponse,
    RecursoCreate,
    RecursoStockUpdate,
    RecursoUpdate
)
from app.schemas.area_destino import (
    AreaDestinoResponse,
    AreaDestinoCreate,
    AreaDestinoUpdate
)
from app.schemas.usuario_admin import (
    UsuarioAdminResponse,
    UsuarioAdminCreate,
    UsuarioAdminUpdate
)
from app.services.solicitud_service import formatear_solicitud_response

router = APIRouter()

# -------------------------------------------------------------
# 0. Autenticación Administrativa (Jefatura de Operaciones)
# -------------------------------------------------------------
FALLBACK_ADMIN_USER = "operaciones@continental.edu.pe"
FALLBACK_ADMIN_PASS = "admin2026"

@router.post("/login", response_model=AdminLoginResponse)
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)):
    email_clean = body.username.strip().lower()

    # 1. Buscar en tabla usuarios_admin
    usuario = db.query(UsuarioAdmin).filter(
        UsuarioAdmin.correo == email_clean,
        UsuarioAdmin.activo == True
    ).first()

    if usuario and usuario.password_hash == body.password:
        return AdminLoginResponse(
            token=f"token-jwt-admin-{usuario.id}",
            user={
                "id": usuario.id,
                "email": usuario.correo,
                "nombre": usuario.nombre,
                "rol": "ADMINISTRADOR",
                "campus": "Universidad Continental"
            },
            message="Acceso concedido al panel de administración"
        )

    # 2. Fallback de compatibilidad
    if email_clean == FALLBACK_ADMIN_USER and body.password == FALLBACK_ADMIN_PASS:
        # Asegurar que exista en la BD
        admin_db = db.query(UsuarioAdmin).filter(UsuarioAdmin.correo == FALLBACK_ADMIN_USER).first()
        if not admin_db:
            admin_db = UsuarioAdmin(
                correo=FALLBACK_ADMIN_USER,
                nombre="Jefatura de Operaciones",
                password_hash=FALLBACK_ADMIN_PASS,
                activo=True
            )
            db.add(admin_db)
            db.commit()
            db.refresh(admin_db)

        return AdminLoginResponse(
            token=f"token-jwt-admin-{admin_db.id}",
            user={
                "id": admin_db.id,
                "email": admin_db.correo,
                "nombre": admin_db.nombre,
                "rol": "ADMINISTRADOR",
                "campus": "Universidad Continental"
            },
            message="Acceso concedido al panel de administración"
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales incorrectas. Verifique su correo y contraseña de administración."
    )


# -------------------------------------------------------------
# 1. Gestión de Solicitudes (RF-05.1)
# -------------------------------------------------------------
@router.get("/solicitudes", response_model=list[SolicitudResponse])
def listar_todas_las_solicitudes(
    estado: str | None = Query(None, description="Filtro opcional por estado: PENDIENTE, APROBADO, RECHAZADO"),
    db: Session = Depends(get_db)
):
    query = db.query(Solicitud).order_by(Solicitud.created_at.desc())
    if estado:
        query = query.filter(Solicitud.estado == estado.upper())
    
    solicitudes = query.all()
    return [formatear_solicitud_response(db, sol) for sol in solicitudes]


@router.patch("/solicitudes/{id}/estado", response_model=SolicitudResponse)
def actualizar_estado_solicitud_admin(
    id: int,
    body: SolicitudStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Especificación SDD v1.1 - 4.B:
    PATCH /api/v1/admin/solicitudes/{id}/estado
    Permite Aprobar o Rechazar con registro de motivo opcional.
    """
    solicitud = db.query(Solicitud).filter(Solicitud.id == id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail=f"Solicitud con ID {id} no encontrada.")

    nuevo_estado = body.estado.upper()
    if nuevo_estado not in ["PENDIENTE", "APROBADO", "RECHAZADO"]:
        raise HTTPException(status_code=400, detail="Estado inválido. Debe ser PENDIENTE, APROBADO o RECHAZADO.")

    solicitud.estado = nuevo_estado
    if body.motivo_rechazo is not None:
        solicitud.motivo_rechazo = body.motivo_rechazo
    elif nuevo_estado == "APROBADO":
        solicitud.motivo_rechazo = None

    db.commit()
    db.refresh(solicitud)
    return formatear_solicitud_response(db, solicitud)


# -------------------------------------------------------------
# 2. Gestión de Áreas / Facultades Solicitantes (RF-05.4)
# -------------------------------------------------------------
@router.get("/areas-solicitantes", response_model=list[AreaSolicitanteResponse])
def listar_areas_admin(db: Session = Depends(get_db)):
    return db.query(AreaSolicitante).order_by(AreaSolicitante.nombre).all()


@router.post("/areas-solicitantes", response_model=AreaSolicitanteResponse, status_code=status.HTTP_201_CREATED)
def crear_area_solicitante(body: AreaSolicitanteCreate, db: Session = Depends(get_db)):
    existente = db.query(AreaSolicitante).filter(AreaSolicitante.nombre.ilike(body.nombre.strip())).first()
    if existente:
        raise HTTPException(status_code=400, detail=f"El área '{body.nombre}' ya se encuentra registrada.")

    nueva = AreaSolicitante(nombre=body.nombre.strip(), activa=body.activa)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/areas-solicitantes/{id}", response_model=AreaSolicitanteResponse)
def actualizar_area_solicitante(id: int, body: AreaSolicitanteUpdate, db: Session = Depends(get_db)):
    area = db.query(AreaSolicitante).filter(AreaSolicitante.id == id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área solicitante no encontrada.")

    if body.nombre is not None:
        nombre_clean = body.nombre.strip()
        duplicado = db.query(AreaSolicitante).filter(
            AreaSolicitante.nombre.ilike(nombre_clean),
            AreaSolicitante.id != id
        ).first()
        if duplicado:
            raise HTTPException(status_code=400, detail=f"Ya existe otra área con el nombre '{nombre_clean}'.")
        area.nombre = nombre_clean

    if body.activa is not None:
        area.activa = body.activa

    db.commit()
    db.refresh(area)
    return area


@router.delete("/areas-solicitantes/{id}")
def eliminar_area_solicitante(id: int, db: Session = Depends(get_db)):
    area = db.query(AreaSolicitante).filter(AreaSolicitante.id == id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área solicitante no encontrada.")

    # Validar si tiene solicitudes asociadas
    solicitudes_cnt = db.query(Solicitud).filter(Solicitud.area_solicitante_id == id).count()
    if solicitudes_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar el área '{area.nombre}' porque tiene {solicitudes_cnt} solicitud(es) registrada(s). Puede deshabilitarla para que no aparezca en nuevas solicitudes."
        )

    db.delete(area)
    db.commit()
    return {"message": f"Facultad / Área '{area.nombre}' eliminada correctamente del catálogo."}


# -------------------------------------------------------------
# 3. Gestión de Ambientes / Espacios Físicos (RF-05.2)
# -------------------------------------------------------------
@router.get("/ambientes", response_model=list[AmbienteResponse])
def listar_ambientes_admin(db: Session = Depends(get_db)):
    return db.query(Ambiente).order_by(Ambiente.id).all()


@router.post("/ambientes", response_model=AmbienteResponse, status_code=status.HTTP_201_CREATED)
def crear_ambiente(body: AmbienteCreate, db: Session = Depends(get_db)):
    existente = db.query(Ambiente).filter(Ambiente.nombre.ilike(body.nombre.strip())).first()
    if existente:
        raise HTTPException(status_code=400, detail=f"El ambiente '{body.nombre}' ya se encuentra registrado.")

    nuevo = Ambiente(nombre=body.nombre.strip(), capacidad=body.capacidad, activo=body.activo)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/ambientes/{id}", response_model=AmbienteResponse)
def actualizar_ambiente(id: int, body: AmbienteUpdate, db: Session = Depends(get_db)):
    ambiente = db.query(Ambiente).filter(Ambiente.id == id).first()
    if not ambiente:
        raise HTTPException(status_code=404, detail="Ambiente no encontrado.")

    if body.nombre is not None:
        nombre_clean = body.nombre.strip()
        duplicado = db.query(Ambiente).filter(
            Ambiente.nombre.ilike(nombre_clean),
            Ambiente.id != id
        ).first()
        if duplicado:
            raise HTTPException(status_code=400, detail=f"Ya existe otro ambiente con el nombre '{nombre_clean}'.")
        ambiente.nombre = nombre_clean

    if body.capacidad is not None:
        ambiente.capacidad = body.capacidad

    if body.activo is not None:
        ambiente.activo = body.activo

    db.commit()
    db.refresh(ambiente)
    return ambiente


@router.delete("/ambientes/{id}")
def eliminar_ambiente(id: int, db: Session = Depends(get_db)):
    ambiente = db.query(Ambiente).filter(Ambiente.id == id).first()
    if not ambiente:
        raise HTTPException(status_code=404, detail="Ambiente no encontrado.")

    # Validar si tiene solicitudes asociadas
    solicitudes_cnt = db.query(Solicitud).filter(Solicitud.ambiente_id == id).count()
    if solicitudes_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar el ambiente '{ambiente.nombre}' porque tiene {solicitudes_cnt} solicitud(es) registrada(s). Para evitar nuevas reservas, puede desactivarlo en su lugar."
        )

    db.delete(ambiente)
    db.commit()
    return {"message": f"Ambiente '{ambiente.nombre}' eliminado correctamente del catálogo."}


# -------------------------------------------------------------
# 4. Gestión de Recursos e Inventario (RF-05.3)
# -------------------------------------------------------------
@router.post("/recursos", response_model=RecursoResponse, status_code=status.HTTP_201_CREATED)
def crear_recurso(body: RecursoCreate, db: Session = Depends(get_db)):
    # Validar área operativa
    area = db.query(AreaDestino).filter(AreaDestino.id == body.area_destino_id).first()
    if not area:
        raise HTTPException(status_code=404, detail=f"Área operativa con ID {body.area_destino_id} no encontrada.")

    nuevo = Recurso(
        nombre=body.nombre.strip(),
        area_destino_id=body.area_destino_id,
        stock_total=body.stock_total,
        es_critico=body.es_critico
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return RecursoResponse(
        id=nuevo.id,
        nombre=nuevo.nombre,
        area_destino_id=nuevo.area_destino_id,
        area_destino_nombre=area.nombre,
        stock_total=nuevo.stock_total,
        es_critico=nuevo.es_critico
    )


@router.patch("/recursos/{id}/stock", response_model=RecursoResponse)
def actualizar_stock_recurso(id: int, body: RecursoStockUpdate, db: Session = Depends(get_db)):
    recurso = db.query(Recurso).filter(Recurso.id == id).first()
    if not recurso:
        raise HTTPException(status_code=404, detail=f"Recurso con ID {id} no encontrado.")

    recurso.stock_total = body.stock_total
    db.commit()
    db.refresh(recurso)

    area_nombre = recurso.area_destino.nombre if recurso.area_destino else None
    return RecursoResponse(
        id=recurso.id,
        nombre=recurso.nombre,
        area_destino_id=recurso.area_destino_id,
        area_destino_nombre=area_nombre,
        stock_total=recurso.stock_total,
        es_critico=recurso.es_critico
    )


@router.put("/recursos/{id}", response_model=RecursoResponse)
def actualizar_recurso_completo(id: int, body: RecursoUpdate, db: Session = Depends(get_db)):
    recurso = db.query(Recurso).filter(Recurso.id == id).first()
    if not recurso:
        raise HTTPException(status_code=404, detail="Recurso no encontrado.")

    if body.nombre is not None:
        recurso.nombre = body.nombre.strip()
    if body.area_destino_id is not None:
        area = db.query(AreaDestino).filter(AreaDestino.id == body.area_destino_id).first()
        if not area:
            raise HTTPException(status_code=404, detail="Área operativa no encontrada.")
        recurso.area_destino_id = body.area_destino_id
    if body.stock_total is not None:
        recurso.stock_total = body.stock_total
    if body.es_critico is not None:
        recurso.es_critico = body.es_critico

    db.commit()
    db.refresh(recurso)

    area_nombre = recurso.area_destino.nombre if recurso.area_destino else None
    return RecursoResponse(
        id=recurso.id,
        nombre=recurso.nombre,
        area_destino_id=recurso.area_destino_id,
        area_destino_nombre=area_nombre,
        stock_total=recurso.stock_total,
        es_critico=recurso.es_critico
    )


@router.delete("/recursos/{id}")
def eliminar_recurso(id: int, db: Session = Depends(get_db)):
    recurso = db.query(Recurso).filter(Recurso.id == id).first()
    if not recurso:
        raise HTTPException(status_code=404, detail="Recurso no encontrado.")

    # Validar si está referenciado en solicitudes
    solicitudes_cnt = db.query(SolicitudRecurso).filter(SolicitudRecurso.recurso_id == id).count()
    if solicitudes_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar el recurso '{recurso.nombre}' porque está registrado en {solicitudes_cnt} solicitud(es). Si ya no cuenta con stock disponible, ajuste el stock total a 0."
        )

    db.delete(recurso)
    db.commit()
    return {"message": f"Recurso '{recurso.nombre}' eliminado correctamente del inventario."}


# -------------------------------------------------------------
# 5. CRUD de Áreas Administrativas Responsables (Áreas Destino)
# -------------------------------------------------------------
@router.get("/areas-destino", response_model=list[AreaDestinoResponse])
def listar_areas_destino(db: Session = Depends(get_db)):
    areas = db.query(AreaDestino).order_by(AreaDestino.id).all()
    resultado = []
    for area in areas:
        recursos_cnt = db.query(Recurso).filter(Recurso.area_destino_id == area.id).count()
        resultado.append(
            AreaDestinoResponse(
                id=area.id,
                nombre=area.nombre,
                activa=getattr(area, 'activa', True),
                recursos_count=recursos_cnt
            )
        )
    return resultado


@router.post("/areas-destino", response_model=AreaDestinoResponse, status_code=status.HTTP_201_CREATED)
def crear_area_destino(body: AreaDestinoCreate, db: Session = Depends(get_db)):
    existente = db.query(AreaDestino).filter(AreaDestino.nombre.ilike(body.nombre.strip())).first()
    if existente:
        raise HTTPException(status_code=400, detail=f"El área administrativa '{body.nombre}' ya existe.")

    nueva = AreaDestino(nombre=body.nombre.strip(), activa=body.activa)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return AreaDestinoResponse(
        id=nueva.id,
        nombre=nueva.nombre,
        activa=nueva.activa,
        recursos_count=0
    )


@router.put("/areas-destino/{id}", response_model=AreaDestinoResponse)
def actualizar_area_destino(id: int, body: AreaDestinoUpdate, db: Session = Depends(get_db)):
    area = db.query(AreaDestino).filter(AreaDestino.id == id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área administrativa no encontrada.")

    if body.nombre is not None:
        nombre_clean = body.nombre.strip()
        duplicado = db.query(AreaDestino).filter(
            AreaDestino.nombre.ilike(nombre_clean),
            AreaDestino.id != id
        ).first()
        if duplicado:
            raise HTTPException(status_code=400, detail=f"Ya existe otra área con el nombre '{nombre_clean}'.")
        area.nombre = nombre_clean

    if body.activa is not None:
        area.activa = body.activa

    db.commit()
    db.refresh(area)

    recursos_cnt = db.query(Recurso).filter(Recurso.area_destino_id == area.id).count()
    return AreaDestinoResponse(
        id=area.id,
        nombre=area.nombre,
        activa=getattr(area, 'activa', True),
        recursos_count=recursos_cnt
    )


@router.delete("/areas-destino/{id}")
def eliminar_area_destino(id: int, db: Session = Depends(get_db)):
    area = db.query(AreaDestino).filter(AreaDestino.id == id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área administrativa no encontrada.")

    recursos_cnt = db.query(Recurso).filter(Recurso.area_destino_id == area.id).count()
    if recursos_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No se puede eliminar el área '{area.nombre}' porque tiene {recursos_cnt} "
                f"recurso(s) asignados en inventario. Reasigne o elimine los recursos primero."
            )
        )

    db.delete(area)
    db.commit()
    return {"message": f"Área administrativa '{area.nombre}' eliminada correctamente."}


# -------------------------------------------------------------
# 6. Gestión de Cuentas de Administrador (Multi-Admin)
# -------------------------------------------------------------
@router.get("/usuarios", response_model=list[UsuarioAdminResponse])
def listar_usuarios_admin(db: Session = Depends(get_db)):
    return db.query(UsuarioAdmin).order_by(UsuarioAdmin.id).all()


@router.post("/usuarios", response_model=UsuarioAdminResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario_admin(body: UsuarioAdminCreate, db: Session = Depends(get_db)):
    correo_clean = body.correo.strip().lower()
    existente = db.query(UsuarioAdmin).filter(UsuarioAdmin.correo == correo_clean).first()
    if existente:
        raise HTTPException(status_code=400, detail=f"El correo '{correo_clean}' ya está registrado como administrador.")

    nuevo = UsuarioAdmin(
        correo=correo_clean,
        nombre=body.nombre.strip(),
        password_hash=body.password,
        activo=body.activo
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/usuarios/{id}", response_model=UsuarioAdminResponse)
def actualizar_usuario_admin(id: int, body: UsuarioAdminUpdate, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioAdmin).filter(UsuarioAdmin.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario administrador no encontrado.")

    if body.nombre is not None:
        usuario.nombre = body.nombre.strip()
    if body.activo is not None:
        # Prevenir desactivar el último admin
        if not body.activo:
            activos = db.query(UsuarioAdmin).filter(UsuarioAdmin.activo == True).count()
            if activos <= 1:
                raise HTTPException(status_code=400, detail="No puede desactivar la única cuenta administradora activa.")
        usuario.activo = body.activo
    if body.password is not None and body.password.strip():
        usuario.password_hash = body.password.strip()

    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/usuarios/{id}")
def eliminar_usuario_admin(id: int, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioAdmin).filter(UsuarioAdmin.id == id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario administrador no encontrado.")

    total_admins = db.query(UsuarioAdmin).count()
    if total_admins <= 1:
        raise HTTPException(status_code=400, detail="No puede eliminar la única cuenta administradora del sistema.")

    db.delete(usuario)
    db.commit()
    return {"message": f"Cuenta administradora de '{usuario.nombre}' eliminada correctamente."}

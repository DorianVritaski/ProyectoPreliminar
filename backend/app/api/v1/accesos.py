import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.database import get_db
from app.models.solicitud_acceso import SolicitudAcceso
from app.schemas.solicitud_acceso import (
    SolicitudAccesoCreate,
    SolicitudAccesoResponse,
    SolicitudAccesoSSOMAUpdate,
    SolicitudAccesoCheckInUpdate,
)

router = APIRouter()

def generar_codigo_acceso(db: Session) -> str:
    año = datetime.now().year
    while True:
        sufijo = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        codigo = f"ACC-{año}-{sufijo}"
        existente = db.query(SolicitudAcceso).filter(SolicitudAcceso.codigo_acceso == codigo).first()
        if not existente:
            return codigo


@router.get("", response_model=list[SolicitudAccesoResponse])
def listar_solicitudes_acceso(
    fecha: str | None = Query(None, description="Filtro opcional por fecha YYYY-MM-DD"),
    estado: str | None = Query(None, description="Filtro opcional por estado: AUTORIZADO, PENDIENTE, OBSERVADO"),
    motivo: str | None = Query(None, description="Filtro por motivo"),
    requiere_ssoma_riesgo: bool | None = Query(None, description="Filtrar por trabajos de riesgo (Apartado 3)"),
    search: str | None = Query(None, description="Búsqueda por código, anfitrión o visitante"),
    db: Session = Depends(get_db),
):
    query = db.query(SolicitudAcceso).order_by(SolicitudAcceso.created_at.desc())

    if estado and estado.upper() not in ["TODAS", "TODOS", "ALL"]:
        query = query.filter(SolicitudAcceso.estado == estado.upper())

    if requiere_ssoma_riesgo is not None:
        query = query.filter(SolicitudAcceso.requiere_ssoma_riesgo == requiere_ssoma_riesgo)

    if motivo and motivo.strip():
        query = query.filter(SolicitudAcceso.motivo.ilike(f"%{motivo.strip()}%"))

    if fecha:
        query = query.filter(func.date(SolicitudAcceso.fecha_inicio) == fecha)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                SolicitudAcceso.codigo_acceso.ilike(term),
                SolicitudAcceso.anfitrion_correo.ilike(term),
                SolicitudAcceso.anfitrion_nombre.ilike(term),
                SolicitudAcceso.ubicacion_especifica.ilike(term),
                func.cast(SolicitudAcceso.visitantes, func.TEXT).ilike(term),
            )
        )

    return query.all()


@router.post("", response_model=SolicitudAccesoResponse, status_code=status.HTTP_201_CREATED)
def registrar_solicitud_acceso(
    data: SolicitudAccesoCreate,
    db: Session = Depends(get_db),
):
    if data.fecha_fin <= data.fecha_inicio:
        raise HTTPException(
            status_code=400,
            detail="La fecha y hora de fin debe ser posterior a la fecha y hora de inicio.",
        )

    codigo = generar_codigo_acceso(db)

    # REGLA DE NEGOCIO DIFERENCIADA:
    # Caso A: Con Apartado 3 activo (requiere_ssoma_riesgo = True) -> Inicia PENDIENTE (revisión obligatoria de SCTR)
    # Caso B: Sin Apartado 3 (requiere_ssoma_riesgo = False) -> Inicia AUTORIZADO (visita estándar / sin bloquear QR)
    estado_inicial = "PENDIENTE" if data.requiere_ssoma_riesgo else "AUTORIZADO"

    # Preparar nómina de visitantes estructurada
    visitantes_list = []
    if data.visitantes:
        for idx, v in enumerate(data.visitantes):
            if isinstance(v, dict):
                visitantes_list.append({
                    "id": idx + 1,
                    "nombre": v.get("nombre", "").strip(),
                    "dni": v.get("dni", "").strip(),
                    "empresa": v.get("empresa", "").strip() if v.get("empresa") else None,
                    "ingresado": bool(v.get("ingresado", False)),
                    "hora_ingreso": v.get("hora_ingreso", None)
                })
            else:
                visitantes_list.append({
                    "id": idx + 1,
                    "nombre": v.nombre.strip(),
                    "dni": v.dni.strip(),
                    "empresa": v.empresa.strip() if v.empresa else None,
                    "ingresado": bool(v.ingresado),
                    "hora_ingreso": v.hora_ingreso
                })

    nueva_solicitud = SolicitudAcceso(
        codigo_acceso=codigo,
        anfitrion_correo=data.anfitrion_correo.strip().lower(),
        anfitrion_nombre=data.anfitrion_nombre.strip() if data.anfitrion_nombre else None,
        anfitrion_area=data.anfitrion_area.strip() if data.anfitrion_area else None,
        sede=data.sede.strip() if data.sede else "Campus Huancayo",
        ubicacion_especifica=data.ubicacion_especifica.strip(),
        motivo=data.motivo.strip(),
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        detalles=data.detalles.strip() if data.detalles else None,
        requiere_ssoma_riesgo=bool(data.requiere_ssoma_riesgo),
        url_sctr_pdf=data.url_sctr_pdf.strip() if data.url_sctr_pdf else None,
        url_lista_personal_pdf=data.url_lista_personal_pdf.strip() if data.url_lista_personal_pdf else None,
        documentos_ssoma=data.documentos_ssoma,
        visitantes=visitantes_list,
        estado=estado_inicial,
        check_in_realizado=False,
        fecha_check_in=None,
    )

    db.add(nueva_solicitud)
    db.commit()
    db.refresh(nueva_solicitud)
    return nueva_solicitud


@router.get("/{codigo_o_id}", response_model=SolicitudAccesoResponse)
def obtener_solicitud_acceso(
    codigo_o_id: str,
    db: Session = Depends(get_db),
):
    query = db.query(SolicitudAcceso)
    if codigo_o_id.isdigit():
        solicitud = query.filter(SolicitudAcceso.id == int(codigo_o_id)).first()
    else:
        solicitud = query.filter(SolicitudAcceso.codigo_acceso == codigo_o_id.strip().upper()).first()

    if not solicitud:
        raise HTTPException(
            status_code=404,
            detail=f"Solicitud de acceso '{codigo_o_id}' no encontrada.",
        )
    return solicitud


@router.patch("/{id}/ssoma", response_model=SolicitudAccesoResponse)
def actualizar_ssoma_acceso(
    id: int,
    body: SolicitudAccesoSSOMAUpdate,
    db: Session = Depends(get_db),
):
    """
    Endpoint para SSOMA:
    - Caso A (Trabajos de riesgo): Autoriza o Emite observación técnica sobre el SCTR.
    - Caso B (Estándar): Registra o edita lineamientos y directivas de seguridad.
    """
    solicitud = db.query(SolicitudAcceso).filter(SolicitudAcceso.id == id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail=f"Solicitud de acceso con ID {id} no encontrada.")

    nuevo_estado = body.estado.upper()
    if nuevo_estado not in ["AUTORIZADO", "OBSERVADO", "PENDIENTE"]:
        raise HTTPException(
            status_code=400,
            detail="Estado inválido. Debe ser AUTORIZADO, OBSERVADO o PENDIENTE.",
        )

    if body.lineamientos_ssoma is not None:
        solicitud.lineamientos_ssoma = body.lineamientos_ssoma.strip() if body.lineamientos_ssoma else None

    if nuevo_estado == "OBSERVADO":
        if body.observacion_ssoma:
            solicitud.observacion_ssoma = body.observacion_ssoma.strip()
        solicitud.estado = "OBSERVADO"
    elif nuevo_estado == "AUTORIZADO":
        solicitud.observacion_ssoma = None
        solicitud.estado = "AUTORIZADO"
    else:
        solicitud.estado = "PENDIENTE"

    db.commit()
    db.refresh(solicitud)
    return solicitud


@router.post("/{id}/check-in", response_model=SolicitudAccesoResponse)
def registrar_check_in_garita(
    id: int,
    body: SolicitudAccesoCheckInUpdate | None = None,
    db: Session = Depends(get_db),
):
    """
    Endpoint operativo para Vigilancia / Seguridad Interna en garita:
    Registra el ingreso físico del visitante o grupo al campus.
    """
    solicitud = db.query(SolicitudAcceso).filter(SolicitudAcceso.id == id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail=f"Solicitud de acceso con ID {id} no encontrada.")

    ahora_hora = datetime.now().strftime("%H:%M:%S")
    now_utc = datetime.utcnow()

    visitante_dni = body.visitante_dni.strip() if (body and body.visitante_dni) else None
    check_in_val = body.check_in_realizado if body else True

    if body and body.visitantes is not None:
        # Actualización directa de la lista de visitantes
        solicitud.visitantes = body.visitantes
        solicitud.check_in_realizado = check_in_val
        if check_in_val and not solicitud.fecha_check_in:
            solicitud.fecha_check_in = now_utc
    elif visitante_dni:
        # Check-in individual por DNI
        visitantes_actuales = list(solicitud.visitantes or [])
        encontrado = False
        for v in visitantes_actuales:
            if v.get("dni") == visitante_dni:
                v["ingresado"] = check_in_val
                v["hora_ingreso"] = ahora_hora if check_in_val else None
                encontrado = True
                break
        if not encontrado:
            raise HTTPException(status_code=404, detail=f"Visitante con DNI '{visitante_dni}' no encontrado en esta solicitud.")
        
        # Si al menos uno ingresó, la solicitud general marca check_in_realizado = True
        alguno_ingresado = any(v.get("ingresado") for v in visitantes_actuales)
        solicitud.check_in_realizado = alguno_ingresado
        if alguno_ingresado and not solicitud.fecha_check_in:
            solicitud.fecha_check_in = now_utc
        solicitud.visitantes = visitantes_actuales
    else:
        # Check-in grupal
        visitantes_actuales = list(solicitud.visitantes or [])
        solicitud.check_in_realizado = check_in_val
        solicitud.fecha_check_in = now_utc if check_in_val else None
        for v in visitantes_actuales:
            v["ingresado"] = check_in_val
            v["hora_ingreso"] = ahora_hora if check_in_val else None
        solicitud.visitantes = visitantes_actuales
    db.commit()
    db.refresh(solicitud)
    return solicitud

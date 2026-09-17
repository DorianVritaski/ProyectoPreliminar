import random
import string
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.solicitud import Solicitud, SolicitudRecurso, SolicitudConformidad
from app.models.ambiente import Ambiente
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.models.area_solicitante import AreaSolicitante
from app.schemas.solicitud import (
    SolicitudCreate,
    SolicitudResponse,
    SolicitudRecursoDetalleResponse,
    ConformidadAreaResponse
)
from app.services.disponibilidad import (
    verificar_solapamiento_ambiente,
    calcular_stock_disponible
)

def generar_codigo_ticket(db: Session, anio: int | None = None) -> str:
    """Genera un código único en formato EVT-YYYY-XXXX"""
    if anio is None:
        anio = datetime.utcnow().year
        
    while True:
        sufijo = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        codigo = f"EVT-{anio}-{sufijo}"
        existe = db.query(Solicitud).filter(Solicitud.codigo_ticket == codigo).first()
        if not existe:
            return codigo

def crear_solicitud(db: Session, data: SolicitudCreate) -> SolicitudResponse:
    # 1. Validar que el ambiente exista y esté activo
    ambiente = db.query(Ambiente).filter(Ambiente.id == data.ambiente_id, Ambiente.activo == True).first()
    if not ambiente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El ambiente con ID {data.ambiente_id} no existe o no está activo."
        )

    # 2. Validar que el área solicitante exista y esté activa (RF-01.5)
    area_sol = db.query(AreaSolicitante).filter(
        AreaSolicitante.id == data.area_solicitante_id,
        AreaSolicitante.activa == True
    ).first()
    if not area_sol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El área o facultad solicitante con ID {data.area_solicitante_id} no existe o no está activa."
        )

    # 3. RN-01: Validar solapamiento en el mismo ambiente
    conflicto_ambiente = verificar_solapamiento_ambiente(
        db,
        ambiente_id=data.ambiente_id,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin
    )
    if conflicto_ambiente:
        ini_str = conflicto_ambiente.fecha_inicio.strftime("%H:%M")
        fin_str = conflicto_ambiente.fecha_fin.strftime("%H:%M del %d/%m/%Y")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Conflicto de horario en '{ambiente.nombre}'. "
                f"Ya existe una solicitud ({conflicto_ambiente.codigo_ticket}) "
                f"en estado {conflicto_ambiente.estado} desde las {ini_str} hasta las {fin_str}."
            )
        )

    # 4. RN-02 y RN-03: Validar disponibilidad de stock de cada recurso solicitado
    if data.recursos:
        stock_info = {
            item["id"]: item for item in calcular_stock_disponible(db, data.fecha_inicio, data.fecha_fin)
        }
        for req in data.recursos:
            recurso_stat = stock_info.get(req.recurso_id)
            if not recurso_stat:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"El recurso con ID {req.recurso_id} no existe en el catálogo."
                )
            
            disponible = recurso_stat["stock_disponible"]
            if req.cantidad > disponible:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Stock insuficiente para '{recurso_stat['nombre']}'. "
                        f"Solicitado: {req.cantidad}, Disponible en ese horario: {disponible}."
                    )
                )

    # 5. Crear la solicitud
    codigo_ticket = generar_codigo_ticket(db, anio=data.fecha_inicio.year)
    solicitud = Solicitud(
        codigo_ticket=codigo_ticket,
        correo_solicitante=data.correo_solicitante,
        telefono=data.telefono,
        area_solicitante_id=data.area_solicitante_id,
        ambiente_id=data.ambiente_id,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        estado="PENDIENTE",
        motivo_rechazo=None,
        detalles=data.detalles.strip() if data.detalles else None,
        croquis_url=data.croquis_url.strip() if data.croquis_url else None,
        protocolo_ssoma=data.protocolo_ssoma,
        requiere_ssoma=data.requiere_ssoma,
        url_sctr_pdf=data.url_sctr_pdf.strip() if data.url_sctr_pdf else None,
        url_personal_externo_pdf=data.url_personal_externo_pdf.strip() if data.url_personal_externo_pdf else None,
        lineamientos_ssoma=None
    )
    db.add(solicitud)
    db.flush() # Obtiene el ID generado

    # 6. Insertar recursos solicitados y registrar áreas operativas involucradas
    areas_involucradas = set()
    if data.requiere_ssoma:
        # Área 3: Seguridad, SSOMA y Vigilancia
        areas_involucradas.add(3)

    for req in data.recursos:
        sol_rec = SolicitudRecurso(
            solicitud_id=solicitud.id,
            recurso_id=req.recurso_id,
            cantidad=req.cantidad
        )
        db.add(sol_rec)
        rec_obj = db.query(Recurso).filter(Recurso.id == req.recurso_id).first()
        if rec_obj and rec_obj.area_destino_id:
            # Jefatura de Operaciones administra directamente Servicios Generales y Mantenimiento (área 1).
            # Por tanto, no requiere pre-conformidad operativa separada.
            if rec_obj.area_destino_id != 1:
                areas_involucradas.add(rec_obj.area_destino_id)

    # 7. Crear automáticamente registros de conformidad en estado PENDIENTE
    for area_id in areas_involucradas:
        conf = SolicitudConformidad(
            solicitud_id=solicitud.id,
            area_destino_id=area_id,
            estado="PENDIENTE"
        )
        db.add(conf)

    db.commit()
    db.refresh(solicitud)

    return formatear_solicitud_response(db, solicitud)


def formatear_solicitud_response(db: Session, solicitud: Solicitud) -> SolicitudResponse:
    detalles_recursos = (
        db.query(
            SolicitudRecurso.recurso_id,
            SolicitudRecurso.cantidad,
            Recurso.nombre,
            Recurso.es_critico,
            Recurso.area_destino_id,
            AreaDestino.nombre.label("area_destino_nombre")
        )
        .join(Recurso, SolicitudRecurso.recurso_id == Recurso.id)
        .join(AreaDestino, Recurso.area_destino_id == AreaDestino.id)
        .filter(SolicitudRecurso.solicitud_id == solicitud.id)
        .all()
    )

    recursos_resp = [
        SolicitudRecursoDetalleResponse(
            recurso_id=d.recurso_id,
            nombre=d.nombre,
            area_destino_id=d.area_destino_id,
            area_destino_nombre=d.area_destino_nombre,
            cantidad=d.cantidad,
            es_critico=d.es_critico
        )
        for d in detalles_recursos
    ]

    # Cargar conformidades por área
    conformidades_db = (
        db.query(SolicitudConformidad)
        .filter(SolicitudConformidad.solicitud_id == solicitud.id)
        .all()
    )

    conformidades_resp = []
    requiere_ti = False
    conformidad_ti_ok = True
    requiere_ssoma_conf = bool(getattr(solicitud, "requiere_ssoma", False))
    conformidad_ssoma_ok = True
    todas_ok = True

    for c in conformidades_db:
        # Excluir Servicios Generales y Mantenimiento (área 1), administrada por la propia Jefatura
        if c.area_destino_id == 1:
            continue

        area_nom = c.area_destino.nombre if c.area_destino else f"Área #{c.area_destino_id}"
        admin_nom = c.administrador.nombre if c.administrador else None

        conformidades_resp.append(
            ConformidadAreaResponse(
                id=c.id,
                area_destino_id=c.area_destino_id,
                area_destino_nombre=area_nom,
                estado=c.estado,
                observacion=c.observacion,
                aprobado_por=c.aprobado_por,
                aprobado_por_nombre=admin_nom,
                updated_at=c.updated_at
            )
        )

        is_ti = (c.area_destino_id == 2) or ("TI" in area_nom.upper())
        if is_ti:
            requiere_ti = True
            if c.estado != "CONFORME":
                conformidad_ti_ok = False

        is_ssoma = (c.area_destino_id == 3) or ("SSOMA" in area_nom.upper())
        if is_ssoma:
            requiere_ssoma_conf = True
            if c.estado != "CONFORME":
                conformidad_ssoma_ok = False

        if c.estado != "CONFORME":
            todas_ok = False

    # Conformidad operativa para Servicios Generales y Mantenimiento:
    # Esta área es gestionada por Jefatura de Operaciones y supervisa el espacio y mobiliario del evento.
    estado_sgm = "CONFORME" if solicitud.estado == "APROBADO" else ("OBSERVADO" if solicitud.estado == "RECHAZADO" else "PENDIENTE")
    conformidades_resp.insert(
        0,
        ConformidadAreaResponse(
            id=0,
            area_destino_id=1,
            area_destino_nombre="Servicios Generales y Mantenimiento",
            estado=estado_sgm,
            observacion=solicitud.motivo_rechazo if solicitud.estado == "RECHAZADO" else None,
            aprobado_por=None,
            aprobado_por_nombre="Jefatura de Operaciones" if solicitud.estado == "APROBADO" else None,
            updated_at=solicitud.created_at
        )
    )
    if estado_sgm != "CONFORME":
        todas_ok = False

    area_nombre = "Área Institucional"
    if solicitud.area_solicitante:
        area_nombre = solicitud.area_solicitante.nombre

    return SolicitudResponse(
        id=solicitud.id,
        codigo_ticket=solicitud.codigo_ticket,
        correo_solicitante=solicitud.correo_solicitante,
        telefono=solicitud.telefono,
        area_solicitante_id=solicitud.area_solicitante_id,
        area_solicitante=area_nombre,
        ambiente_id=solicitud.ambiente_id,
        ambiente_nombre=solicitud.ambiente.nombre if solicitud.ambiente else "Ambiente",
        fecha_inicio=solicitud.fecha_inicio,
        fecha_fin=solicitud.fecha_fin,
        estado=solicitud.estado,
        motivo_rechazo=solicitud.motivo_rechazo,
        detalles=getattr(solicitud, "detalles", None),
        croquis_url=getattr(solicitud, "croquis_url", None),
        protocolo_ssoma=solicitud.protocolo_ssoma,
        requiere_ssoma=getattr(solicitud, "requiere_ssoma", False),
        url_sctr_pdf=getattr(solicitud, "url_sctr_pdf", None),
        url_personal_externo_pdf=getattr(solicitud, "url_personal_externo_pdf", None),
        lineamientos_ssoma=getattr(solicitud, "lineamientos_ssoma", None),
        created_at=solicitud.created_at,
        recursos=recursos_resp,
        conformidades=conformidades_resp,
        requiere_conformidad_ti=requiere_ti,
        conformidad_ti_aprobada=conformidad_ti_ok if requiere_ti else True,
        requiere_conformidad_ssoma=requiere_ssoma_conf,
        conformidad_ssoma_aprobada=conformidad_ssoma_ok if requiere_ssoma_conf else True,
        todas_conformidades_aprobadas=todas_ok
    )


def buscar_solicitudes_seguimiento(db: Session, search: str) -> list[SolicitudResponse]:
    search_clean = search.strip()
    if not search_clean:
        return []

    solicitudes = (
        db.query(Solicitud)
        .filter(
            or_(
                Solicitud.codigo_ticket.ilike(f"%{search_clean}%"),
                Solicitud.correo_solicitante.ilike(f"%{search_clean}%")
            )
        )
        .order_by(Solicitud.created_at.desc())
        .all()
    )

    return [formatear_solicitud_response(db, sol) for sol in solicitudes]

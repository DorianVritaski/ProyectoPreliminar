import random
import string
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.solicitud import Solicitud, SolicitudRecurso, SolicitudConformidad, SolicitudHorario
from app.models.ambiente import Ambiente
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.models.area_solicitante import AreaSolicitante
from app.schemas.solicitud import (
    SolicitudCreate,
    SolicitudResponse,
    SolicitudModificacionRequest,
    SolicitudRecursoDetalleResponse,
    ConformidadAreaResponse,
    HorarioSlotResponse
)
from app.services.disponibilidad import (
    verificar_solapamiento_ambiente,
    calcular_stock_disponible,
    diagnosticar_disponibilidad_multiple,
    calcular_stock_disponible_horarios
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

    # 3. Extraer y estructurar franjas horarias solicitadas
    horarios_req = []
    if data.horarios and len(data.horarios) > 0:
        for h in data.horarios:
            horarios_req.append({"fecha_inicio": h.fecha_inicio, "fecha_fin": h.fecha_fin})
    elif data.fecha_inicio and data.fecha_fin:
        horarios_req.append({"fecha_inicio": data.fecha_inicio, "fecha_fin": data.fecha_fin})
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar al menos una fecha y horario para el evento."
        )

    # RN-01: Validar solapamiento e intervalo de 1 hora para todas las fechas solicitadas
    diag = diagnosticar_disponibilidad_multiple(
        db,
        ambiente_id=data.ambiente_id,
        horarios=horarios_req
    )
    if not diag["disponible"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=diag["mensaje"]
        )

    # 4. RN-02 y RN-03: Validar disponibilidad de stock para todas las fechas solicitadas
    if data.recursos:
        stock_info = {
            item["id"]: item for item in calcular_stock_disponible_horarios(db, horarios_req)
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
                        f"Solicitado: {req.cantidad}, Disponible para estas fechas: {disponible}."
                    )
                )

    # 5. Crear la solicitud persistente
    fecha_inicio_sol = min(h["fecha_inicio"] for h in horarios_req)
    fecha_fin_sol = max(h["fecha_fin"] for h in horarios_req)

    codigo_ticket = generar_codigo_ticket(db, anio=fecha_inicio_sol.year)
    pin_seguridad = "".join(random.choices(string.digits, k=4))

    # Documentos SSOMA de proveedores externos
    docs_ssoma_dict = None
    if data.documentos_ssoma:
        docs_ssoma_dict = [d.model_dump() if hasattr(d, "model_dump") else (d.dict() if hasattr(d, "dict") else dict(d)) for d in data.documentos_ssoma]
    elif data.requiere_ssoma and (data.url_sctr_pdf or data.url_personal_externo_pdf):
        docs_ssoma_dict = [{
            "nombre": "Proveedor Principal",
            "url_sctr_pdf": data.url_sctr_pdf.strip() if data.url_sctr_pdf else None,
            "url_personal_externo_pdf": data.url_personal_externo_pdf.strip() if data.url_personal_externo_pdf else None
        }]

    url_sctr = data.url_sctr_pdf.strip() if data.url_sctr_pdf else None
    url_personal = data.url_personal_externo_pdf.strip() if data.url_personal_externo_pdf else None
    if docs_ssoma_dict and len(docs_ssoma_dict) > 0:
        if not url_sctr:
            url_sctr = docs_ssoma_dict[0].get("url_sctr_pdf")
        if not url_personal:
            url_personal = docs_ssoma_dict[0].get("url_personal_externo_pdf")

    solicitud = Solicitud(
        codigo_ticket=codigo_ticket,
        correo_solicitante=data.correo_solicitante,
        telefono=data.telefono,
        area_solicitante_id=data.area_solicitante_id,
        ambiente_id=data.ambiente_id,
        fecha_inicio=fecha_inicio_sol,
        fecha_fin=fecha_fin_sol,
        estado="PENDIENTE",
        motivo_rechazo=None,
        edicion_solicitada=False,
        motivo_modificacion=None,
        pin_seguridad=pin_seguridad,
        detalles=data.detalles.strip() if data.detalles else None,
        croquis_url=data.croquis_url.strip() if data.croquis_url else None,
        protocolo_ssoma=data.protocolo_ssoma,
        requiere_ssoma=data.requiere_ssoma,
        url_sctr_pdf=url_sctr,
        url_personal_externo_pdf=url_personal,
        documentos_ssoma=docs_ssoma_dict,
        lineamientos_ssoma=None
    )
    db.add(solicitud)
    db.flush() # Obtiene el ID generado

    # Guardar las franjas horarias individuales en solicitud_horarios
    for h in horarios_req:
        slot_db = SolicitudHorario(
            solicitud_id=solicitud.id,
            fecha_inicio=h["fecha_inicio"],
            fecha_fin=h["fecha_fin"]
        )
        db.add(slot_db)

    # 6. Insertar recursos solicitados y registrar áreas operativas involucradas
    areas_involucradas = set()
    if data.requiere_ssoma:
        # Área de SSOMA (Seguridad, Salud Ocupacional y Medio Ambiente)
        ssoma_area = db.query(AreaDestino).filter(AreaDestino.nombre.ilike("%SSOMA%")).first()
        areas_involucradas.add(ssoma_area.id if ssoma_area else 7)

    for req in data.recursos:
        sol_rec = SolicitudRecurso(
            solicitud_id=solicitud.id,
            recurso_id=req.recurso_id,
            cantidad=req.cantidad
        )
        db.add(sol_rec)
        rec_obj = db.query(Recurso).filter(Recurso.id == req.recurso_id).first()
        if rec_obj and rec_obj.area_destino_id:
            # Jefatura de Operaciones administra Servicios Generales y Mantenimiento (área 1).
            # Seguridad Interna y Vigilancia (área 3) es un panel de monitoreo y control en garita (Solo Lectura).
            # Por tanto, no requieren registro de pre-conformidad técnica separada.
            if rec_obj.area_destino_id not in (1, 3):
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
        # Excluir Servicios Generales (área 1) y Seguridad Interna (área 3, solo lectura/garita)
        if c.area_destino_id in (1, 3):
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

        is_ssoma = (c.area_destino_id in (3, 7)) or ("SSOMA" in area_nom.upper())
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

    horarios_resp = [
        HorarioSlotResponse(
            id=h.id,
            fecha_inicio=h.fecha_inicio,
            fecha_fin=h.fecha_fin
        )
        for h in (solicitud.horarios or [])
    ]
    if not horarios_resp and solicitud.fecha_inicio and solicitud.fecha_fin:
        horarios_resp = [
            HorarioSlotResponse(
                id=None,
                fecha_inicio=solicitud.fecha_inicio,
                fecha_fin=solicitud.fecha_fin
            )
        ]

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
        documentos_ssoma=getattr(solicitud, "documentos_ssoma", None),
        lineamientos_ssoma=getattr(solicitud, "lineamientos_ssoma", None),
        edicion_solicitada=bool(getattr(solicitud, "edicion_solicitada", False)),
        motivo_modificacion=getattr(solicitud, "motivo_modificacion", None),
        pin_seguridad=getattr(solicitud, "pin_seguridad", None),
        created_at=solicitud.created_at.replace(tzinfo=timezone.utc) if (solicitud.created_at and solicitud.created_at.tzinfo is None) else solicitud.created_at,
        horarios=horarios_resp,
        recursos=recursos_resp,
        conformidades=conformidades_resp,
        requiere_conformidad_ti=requiere_ti,
        conformidad_ti_aprobada=conformidad_ti_ok if requiere_ti else True,
        requiere_conformidad_ssoma=requiere_ssoma_conf,
        conformidad_ssoma_aprobada=conformidad_ssoma_ok if requiere_ssoma_conf else True,
        todas_conformidades_aprobadas=todas_ok
    )


def solicitar_modificacion(db: Session, codigo_ticket: str, data: SolicitudModificacionRequest) -> SolicitudResponse:
    ticket_clean = codigo_ticket.strip().upper()
    solicitud = db.query(Solicitud).filter(Solicitud.codigo_ticket == ticket_clean).first()
    if not solicitud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La solicitud con código de ticket '{ticket_clean}' no fue encontrada."
        )

    # 1. Validación de identidad liviana: correo del solicitante O pin_seguridad
    correo_req = (data.correo_solicitante or "").strip().lower()
    sol_correo = (solicitud.correo_solicitante or "").strip().lower()
    pin_req = (data.pin_seguridad or "").strip()
    sol_pin = (solicitud.pin_seguridad or "").strip()

    correo_valido = bool(correo_req and correo_req == sol_correo)
    pin_valido = bool(pin_req and sol_pin and pin_req == sol_pin)

    if not correo_valido and not pin_valido:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Autenticación requerida: El correo electrónico o el PIN de seguridad de 4 dígitos no coinciden con los registrados para este ticket."
        )

    # 2. Validar que el ambiente exista y esté activo
    ambiente = db.query(Ambiente).filter(Ambiente.id == data.ambiente_id, Ambiente.activo == True).first()
    if not ambiente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El ambiente con ID {data.ambiente_id} no existe o no está activo."
        )

    # 3. Validar área solicitante si se envía
    if data.area_solicitante_id:
        area_sol = db.query(AreaSolicitante).filter(
            AreaSolicitante.id == data.area_solicitante_id,
            AreaSolicitante.activa == True
        ).first()
        if not area_sol:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El área solicitante con ID {data.area_solicitante_id} no existe o no está activa."
            )

    # 4. Extraer horarios solicitados
    horarios_req = []
    if data.horarios and len(data.horarios) > 0:
        for h in data.horarios:
            horarios_req.append({"fecha_inicio": h.fecha_inicio, "fecha_fin": h.fecha_fin})
    elif data.fecha_inicio and data.fecha_fin:
        horarios_req.append({"fecha_inicio": data.fecha_inicio, "fecha_fin": data.fecha_fin})
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar al menos una fecha y horario para la solicitud."
        )

    # 5. Validar disponibilidad de ambiente e intervalo logístico EXCLUYENDO esta misma solicitud
    diag = diagnosticar_disponibilidad_multiple(
        db,
        ambiente_id=data.ambiente_id,
        horarios=horarios_req,
        solicitud_id_excluir=solicitud.id
    )
    if not diag["disponible"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=diag["mensaje"]
        )

    # 6. Validar disponibilidad de stock de recursos EXCLUYENDO esta misma solicitud
    if data.recursos:
        stock_info = {
            item["id"]: item for item in calcular_stock_disponible_horarios(db, horarios_req, solicitud_id_excluir=solicitud.id)
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
                        f"Solicitado: {req.cantidad}, Disponible para estas fechas: {disponible}."
                    )
                )

    # 7. Preparar documentos SSOMA
    docs_ssoma_dict = None
    if data.documentos_ssoma:
        docs_ssoma_dict = [d.model_dump() if hasattr(d, "model_dump") else (d.dict() if hasattr(d, "dict") else dict(d)) for d in data.documentos_ssoma]
    elif data.requiere_ssoma and (data.url_sctr_pdf or data.url_personal_externo_pdf):
        docs_ssoma_dict = [{
            "nombre": "Proveedor Principal",
            "url_sctr_pdf": data.url_sctr_pdf.strip() if data.url_sctr_pdf else None,
            "url_personal_externo_pdf": data.url_personal_externo_pdf.strip() if data.url_personal_externo_pdf else None
        }]

    url_sctr = data.url_sctr_pdf.strip() if data.url_sctr_pdf else None
    url_personal = data.url_personal_externo_pdf.strip() if data.url_personal_externo_pdf else None
    if docs_ssoma_dict and len(docs_ssoma_dict) > 0:
        if not url_sctr:
            url_sctr = docs_ssoma_dict[0].get("url_sctr_pdf")
        if not url_personal:
            url_personal = docs_ssoma_dict[0].get("url_personal_externo_pdf")

    # Fechas consolidadas
    fecha_inicio_sol = min(h["fecha_inicio"] for h in horarios_req)
    fecha_fin_sol = max(h["fecha_fin"] for h in horarios_req)

    # 8. Aplicar cambios a la solicitud existente
    solicitud.ambiente_id = data.ambiente_id
    if data.area_solicitante_id:
        solicitud.area_solicitante_id = data.area_solicitante_id
    if data.telefono:
        solicitud.telefono = data.telefono.strip()
    solicitud.fecha_inicio = fecha_inicio_sol
    solicitud.fecha_fin = fecha_fin_sol
    solicitud.detalles = data.detalles.strip() if data.detalles else None
    solicitud.croquis_url = data.croquis_url.strip() if data.croquis_url else None
    solicitud.protocolo_ssoma = data.protocolo_ssoma
    solicitud.requiere_ssoma = data.requiere_ssoma
    solicitud.url_sctr_pdf = url_sctr
    solicitud.url_personal_externo_pdf = url_personal
    solicitud.documentos_ssoma = docs_ssoma_dict
    
    solicitud.edicion_solicitada = True
    solicitud.motivo_modificacion = data.motivo_modificacion.strip()
    solicitud.motivo_rechazo = None # Se limpia rechazo previo al corregir y reabrir
    solicitud.estado = "EN REVISIÓN POR MODIFICACIÓN"

    # Actualizar horarios en BD
    db.query(SolicitudHorario).filter(SolicitudHorario.solicitud_id == solicitud.id).delete()
    for h in horarios_req:
        slot_db = SolicitudHorario(
            solicitud_id=solicitud.id,
            fecha_inicio=h["fecha_inicio"],
            fecha_fin=h["fecha_fin"]
        )
        db.add(slot_db)

    # Actualizar recursos en BD
    db.query(SolicitudRecurso).filter(SolicitudRecurso.solicitud_id == solicitud.id).delete()
    areas_involucradas = set()
    if data.requiere_ssoma:
        ssoma_area = db.query(AreaDestino).filter(AreaDestino.nombre.ilike("%SSOMA%")).first()
        areas_involucradas.add(ssoma_area.id if ssoma_area else 7)

    for req in data.recursos:
        sol_rec = SolicitudRecurso(
            solicitud_id=solicitud.id,
            recurso_id=req.recurso_id,
            cantidad=req.cantidad
        )
        db.add(sol_rec)
        rec_obj = db.query(Recurso).filter(Recurso.id == req.recurso_id).first()
        if rec_obj and rec_obj.area_destino_id and rec_obj.area_destino_id not in (1, 3):
            areas_involucradas.add(rec_obj.area_destino_id)

    # Actualizar conformidades técnicas: resetear existentes o crear nuevas
    existing_confs = db.query(SolicitudConformidad).filter(SolicitudConformidad.solicitud_id == solicitud.id).all()
    existing_areas = {c.area_destino_id: c for c in existing_confs}

    for area_id in areas_involucradas:
        if area_id in existing_areas:
            existing_areas[area_id].estado = "PENDIENTE"
            existing_areas[area_id].observacion = None
            existing_areas[area_id].updated_at = datetime.utcnow()
        else:
            new_conf = SolicitudConformidad(
                solicitud_id=solicitud.id,
                area_destino_id=area_id,
                estado="PENDIENTE"
            )
            db.add(new_conf)

    # Remover conformidades de áreas que ya no participan
    for area_id, conf_obj in existing_areas.items():
        if area_id not in areas_involucradas:
            db.delete(conf_obj)

    db.commit()
    db.refresh(solicitud)

    return formatear_solicitud_response(db, solicitud)


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

import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.models.solicitud import Solicitud
from app.models.solicitud_acceso import SolicitudAcceso
from app.services.ssoma_ia_service import (
    inspeccionar_documento_sctr_ia,
    auditar_conjunto_documentos_ia
)
from app.services.ssoma_inspector import (
    analizar_documento_ssoma as analizar_documento_fallback,
    inspeccionar_conjunto_documentos as inspeccionar_conjunto_fallback
)

router = APIRouter()


class InspeccionDocumentoRequest(BaseModel):
    url_drive: Optional[str] = None
    urls_drive: Optional[List[str]] = None
    fecha_evento: Optional[str] = None
    dnis_esperados: Optional[List[str]] = None
    motivo_trabajo: Optional[str] = ""
    descripcion_trabajo: Optional[str] = ""


@router.post("/inspeccionar-documento")
async def inspeccionar_documento_endpoint(data: InspeccionDocumentoRequest):
    """
    Endpoint interactivo para inspección automática de documentos de Google Drive (PDF, XLSX, Sheets)
    con OpenAI gpt-4o-mini y Structured Outputs (Pydantic).
    """
    urls = []
    if data.urls_drive:
        urls.extend(data.urls_drive)
    if data.url_drive and data.url_drive not in urls:
        urls.append(data.url_drive)

    urls = [u.strip() for u in urls if u and u.strip()]

    if not urls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar al menos una URL de Google Drive en 'url_drive' o 'urls_drive'."
        )

    motivo = data.motivo_trabajo or data.descripcion_trabajo or ""

    try:
        if len(urls) == 1:
            dictamen = await inspeccionar_documento_sctr_ia(
                url_drive=urls[0],
                fecha_evento=data.fecha_evento or "",
                dnis_esperados=data.dnis_esperados or [],
                motivo_trabajo=motivo
            )
            return dictamen

        # Múltiples documentos
        dictamen_conjunto = await auditar_conjunto_documentos_ia(
            documentos_urls=urls,
            fecha_evento=data.fecha_evento or "",
            dnis_esperados=data.dnis_esperados or [],
            motivo_trabajo=motivo
        )
        return dictamen_conjunto

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        # Fallback heurístico en caso de falla externa de OpenAI
        try:
            if len(urls) == 1:
                return analizar_documento_fallback(
                    url_drive=urls[0],
                    fecha_evento_str=data.fecha_evento,
                    dnis_esperados=data.dnis_esperados,
                    descripcion_trabajo=motivo
                )
            return inspeccionar_conjunto_fallback(
                documentos_urls=urls,
                fecha_evento_str=data.fecha_evento,
                dnis_esperados=data.dnis_esperados,
                descripcion_trabajo=motivo
            )
        except Exception as fallback_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en inspección de documento: {str(e)} (Fallback: {str(fallback_err)})"
            )


@router.post("/inspeccionar-solicitud-evento/{solicitud_id}")
async def inspeccionar_solicitud_evento_endpoint(solicitud_id: int, db: Session = Depends(get_db)):
    """
    Ejecuta o re-ejecuta la auditoría IA de documentos Google Drive para una Solicitud de Evento.
    Actualiza y persiste el campo dictamen_ssoma.
    """
    solicitud = db.query(Solicitud).filter(Solicitud.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud de evento no encontrada.")

    urls = []
    if solicitud.documentos_ssoma:
        for prov in solicitud.documentos_ssoma:
            if isinstance(prov, dict):
                docs = prov.get("documentos") or []
                for d in docs:
                    if isinstance(d, dict) and d.get("url"):
                        urls.append(d["url"])
                    elif isinstance(d, str):
                        urls.append(d)
                if prov.get("url_sctr_pdf"):
                    urls.append(prov["url_sctr_pdf"])
                if prov.get("url_personal_externo_pdf"):
                    urls.append(prov["url_personal_externo_pdf"])

    if solicitud.url_sctr_pdf and solicitud.url_sctr_pdf not in urls:
        urls.append(solicitud.url_sctr_pdf)
    if solicitud.url_personal_externo_pdf and solicitud.url_personal_externo_pdf not in urls:
        urls.append(solicitud.url_personal_externo_pdf)

    fecha_evento_str = solicitud.fecha_inicio.strftime("%Y-%m-%d") if solicitud.fecha_inicio else ""
    desc_trabajo = f"{solicitud.ambiente.nombre if solicitud.ambiente else ''} {solicitud.detalles or ''}"

    try:
        dictamen = await auditar_conjunto_documentos_ia(
            documentos_urls=urls,
            fecha_evento=fecha_evento_str,
            dnis_esperados=[],
            motivo_trabajo=desc_trabajo
        )
    except Exception:
        dictamen = inspeccionar_conjunto_fallback(
            documentos_urls=urls,
            fecha_evento_str=fecha_evento_str,
            dnis_esperados=None,
            descripcion_trabajo=desc_trabajo
        )

    solicitud.dictamen_ssoma = dictamen
    db.commit()
    db.refresh(solicitud)

    return {
        "solicitud_id": solicitud.id,
        "codigo_ticket": solicitud.codigo_ticket,
        "dictamen_ssoma": dictamen
    }


@router.post("/inspeccionar-solicitud-acceso/{acceso_id}")
async def inspeccionar_solicitud_acceso_endpoint(acceso_id: int, db: Session = Depends(get_db)):
    """
    Ejecuta o re-ejecuta la auditoría IA de documentos Google Drive para una Solicitud de Acceso.
    Cruza la nómina de visitantes esperados con los documentos y persiste dictamen_ssoma.
    """
    sol = db.query(SolicitudAcceso).filter(SolicitudAcceso.id == acceso_id).first()
    if not sol:
        raise HTTPException(status_code=404, detail="Solicitud de acceso no encontrada.")

    urls = []
    if sol.documentos_ssoma:
        if isinstance(sol.documentos_ssoma, list):
            for d in sol.documentos_ssoma:
                if isinstance(d, dict) and d.get("url"):
                    urls.append(d["url"])
                elif isinstance(d, str):
                    urls.append(d)
        elif isinstance(sol.documentos_ssoma, dict) and sol.documentos_ssoma.get("url"):
            urls.append(sol.documentos_ssoma["url"])

    if sol.url_sctr_pdf and sol.url_sctr_pdf not in urls:
        urls.append(sol.url_sctr_pdf)
    if sol.url_lista_personal_pdf and sol.url_lista_personal_pdf not in urls:
        urls.append(sol.url_lista_personal_pdf)

    # DNIs esperados desde la lista de visitantes
    dnis_esperados = []
    if sol.visitantes and isinstance(sol.visitantes, list):
        for v in sol.visitantes:
            if isinstance(v, dict) and v.get("dni"):
                dnis_esperados.append(str(v["dni"]).strip())

    fecha_evento_str = sol.fecha_inicio.strftime("%Y-%m-%d") if sol.fecha_inicio else ""
    desc_trabajo = f"{sol.motivo or ''} - {sol.ubicacion_especifica or ''}. {sol.detalles or ''}"

    try:
        dictamen = await auditar_conjunto_documentos_ia(
            documentos_urls=urls,
            fecha_evento=fecha_evento_str,
            dnis_esperados=dnis_esperados,
            motivo_trabajo=desc_trabajo
        )
    except Exception:
        dictamen = inspeccionar_conjunto_fallback(
            documentos_urls=urls,
            fecha_evento_str=fecha_evento_str,
            dnis_esperados=dnis_esperados,
            descripcion_trabajo=desc_trabajo
        )

    sol.dictamen_ssoma = dictamen
    db.commit()
    db.refresh(sol)

    return {
        "acceso_id": sol.id,
        "codigo_acceso": sol.codigo_acceso,
        "dictamen_ssoma": dictamen
    }


# ==============================================================================
# TAREAS EN SEGUNDO PLANO (BACKGROUND TASKS)
# ==============================================================================

def tarea_procesar_solicitud_ssoma_ia(solicitud_id: int):
    """
    Tarea asíncrona en segundo plano para procesar la auditoría con OpenAI gpt-4o-mini
    tras la creación o modificación de una solicitud de evento.
    """
    db = SessionLocal()
    try:
        sol = db.query(Solicitud).filter(Solicitud.id == solicitud_id).first()
        if not sol or not sol.requiere_ssoma:
            return

        urls = []
        if sol.documentos_ssoma:
            for prov in sol.documentos_ssoma:
                if isinstance(prov, dict):
                    docs = prov.get("documentos") or []
                    for d in docs:
                        if isinstance(d, dict) and d.get("url"):
                            urls.append(d["url"])
                        elif isinstance(d, str):
                            urls.append(d)
                    if prov.get("url_sctr_pdf"):
                        urls.append(prov["url_sctr_pdf"])
                    if prov.get("url_personal_externo_pdf"):
                        urls.append(prov["url_personal_externo_pdf"])

        if sol.url_sctr_pdf and sol.url_sctr_pdf not in urls:
            urls.append(sol.url_sctr_pdf)
        if sol.url_personal_externo_pdf and sol.url_personal_externo_pdf not in urls:
            urls.append(sol.url_personal_externo_pdf)

        if not urls:
            return

        fecha_str = sol.fecha_inicio.strftime("%Y-%m-%d") if sol.fecha_inicio else ""
        desc_trabajo = f"{sol.ambiente.nombre if sol.ambiente else ''} {sol.detalles or ''}"

        try:
            dictamen = asyncio.run(auditar_conjunto_documentos_ia(
                documentos_urls=urls,
                fecha_evento=fecha_str,
                dnis_esperados=[],
                motivo_trabajo=desc_trabajo
            ))
        except Exception:
            dictamen = inspeccionar_conjunto_fallback(
                documentos_urls=urls,
                fecha_evento_str=fecha_str,
                dnis_esperados=None,
                descripcion_trabajo=desc_trabajo
            )

        sol.dictamen_ssoma = dictamen
        db.commit()
    except Exception as e:
        print(f"Error en tarea_procesar_solicitud_ssoma_ia ({solicitud_id}): {e}")
    finally:
        db.close()


def tarea_procesar_acceso_ssoma_ia(acceso_id: int):
    """
    Tarea asíncrona en segundo plano para procesar la auditoría con OpenAI gpt-4o-mini
    tras el registro de una solicitud de acceso con protocolo de riesgo.
    """
    db = SessionLocal()
    try:
        acc = db.query(SolicitudAcceso).filter(SolicitudAcceso.id == acceso_id).first()
        if not acc or not acc.requiere_ssoma_riesgo:
            return

        urls = []
        if acc.documentos_ssoma:
            if isinstance(acc.documentos_ssoma, list):
                for d in acc.documentos_ssoma:
                    if isinstance(d, dict) and d.get("url"):
                        urls.append(d["url"])
                    elif isinstance(d, str):
                        urls.append(d)
            elif isinstance(acc.documentos_ssoma, dict) and acc.documentos_ssoma.get("url"):
                urls.append(acc.documentos_ssoma["url"])

        if acc.url_sctr_pdf and acc.url_sctr_pdf not in urls:
            urls.append(acc.url_sctr_pdf)
        if acc.url_lista_personal_pdf and acc.url_lista_personal_pdf not in urls:
            urls.append(acc.url_lista_personal_pdf)

        if not urls:
            return

        dnis_esperados = []
        if acc.visitantes and isinstance(acc.visitantes, list):
            for v in acc.visitantes:
                if isinstance(v, dict) and v.get("dni"):
                    dnis_esperados.append(str(v["dni"]).strip())

        fecha_str = acc.fecha_inicio.strftime("%Y-%m-%d") if acc.fecha_inicio else ""
        desc_trabajo = f"{acc.motivo or ''} - {acc.ubicacion_especifica or ''}. {acc.detalles or ''}"

        try:
            dictamen = asyncio.run(auditar_conjunto_documentos_ia(
                documentos_urls=urls,
                fecha_evento=fecha_str,
                dnis_esperados=dnis_esperados,
                motivo_trabajo=desc_trabajo
            ))
        except Exception:
            dictamen = inspeccionar_conjunto_fallback(
                documentos_urls=urls,
                fecha_evento_str=fecha_str,
                dnis_esperados=dnis_esperados,
                descripcion_trabajo=desc_trabajo
            )

        acc.dictamen_ssoma = dictamen
        db.commit()
    except Exception as e:
        print(f"Error en tarea_procesar_acceso_ssoma_ia ({acceso_id}): {e}")
    finally:
        db.close()

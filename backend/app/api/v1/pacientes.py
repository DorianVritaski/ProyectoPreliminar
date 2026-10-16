import random
import string
from datetime import datetime, date, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.database import get_db
from app.models.solicitud_paciente import SolicitudPaciente
from app.schemas.solicitud_paciente import (
    SolicitudPacienteCreate,
    SolicitudPacienteResponse,
    SolicitudPacienteCheckIn,
    SolicitudPacienteSSOMAUpdate,
)

router = APIRouter()


def generar_codigo_ticket_paciente(db: Session) -> str:
    """Genera un código único tipo PAC-2026-8912 o PAC-2026-X492."""
    year = datetime.now().year
    chars = string.digits + string.ascii_uppercase
    for _ in range(50):
        sufijo = "".join(random.choices(chars, k=4))
        codigo = f"PAC-{year}-{sufijo}"
        if not db.query(SolicitudPaciente).filter(SolicitudPaciente.codigo_ticket == codigo).first():
            return codigo
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="No se pudo generar un código de ticket único para el paciente."
    )


def parse_time_str(time_val: str) -> time:
    """Convierte cadena HH:MM o HH:MM:SS a objeto time."""
    time_val = time_val.strip()
    parts = time_val.split(":")
    if len(parts) >= 2:
        return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    raise ValueError(f"Formato de hora inválido: {time_val}")


@router.get("", response_model=list[SolicitudPacienteResponse])
def listar_solicitudes_pacientes(
    fecha: Optional[date] = Query(None, description="Filtrar por fecha de atención (YYYY-MM-DD)"),
    escuela_profesional: Optional[str] = Query(None, description="Filtrar por escuela"),
    ingresado_garita: Optional[bool] = Query(None, description="Filtrar por estado de ingreso"),
    estado: Optional[str] = Query(None, description="Filtrar por estado (REGISTRADO, OBSERVADO, INGRESADO)"),
    search: Optional[str] = Query(None, description="Búsqueda por paciente, estudiante, DNI o código"),
    db: Session = Depends(get_db),
):
    query = db.query(SolicitudPaciente).order_by(
        SolicitudPaciente.fecha_atencion.desc(),
        SolicitudPaciente.horario_inicio.asc()
    )

    if fecha:
        query = query.filter(SolicitudPaciente.fecha_atencion == fecha)

    if escuela_profesional and escuela_profesional.strip().upper() != "TODAS":
        clean_esc = escuela_profesional.strip()
        sub_terms = [clean_esc]
        upper_esc = clean_esc.upper()
        if "ODONTO" in upper_esc:
            sub_terms.extend(["Odonto", "ODONTO"])
        elif "PSICO" in upper_esc:
            sub_terms.extend(["Psico", "PSICO", "Gesell", "GESELL"])
        elif "ENFERM" in upper_esc or "TERAPIA" in upper_esc:
            sub_terms.extend(["Enferm", "ENFERM", "Terapia", "TERAPIA"])

        esc_filters = [SolicitudPaciente.escuela_profesional.ilike(f"%{st}%") for st in sub_terms]
        query = query.filter(or_(*esc_filters))

    if ingresado_garita is not None:
        query = query.filter(SolicitudPaciente.ingresado_garita == ingresado_garita)

    if estado and estado.strip().upper() != "TODOS":
        query = query.filter(SolicitudPaciente.estado == estado.strip().upper())

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                SolicitudPaciente.codigo_ticket.ilike(term),
                SolicitudPaciente.paciente_nombre.ilike(term),
                SolicitudPaciente.paciente_dni.ilike(term),
                SolicitudPaciente.estudiante_nombre.ilike(term),
                SolicitudPaciente.estudiante_dni.ilike(term),
                SolicitudPaciente.estudiante_correo.ilike(term),
                SolicitudPaciente.asignatura.ilike(term),
            )
        )

    return query.all()


@router.post("", response_model=SolicitudPacienteResponse, status_code=status.HTTP_201_CREATED)
def registrar_solicitud_paciente(
    data: SolicitudPacienteCreate,
    db: Session = Depends(get_db),
):
    # Validaciones de negocio específicas
    if data.es_menor_edad:
        if not data.apoderado_nombre or not data.apoderado_nombre.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Si el paciente es menor de edad, debe indicar los nombres y apellidos del apoderado."
            )
        if not data.apoderado_dni or not data.apoderado_dni.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Si el paciente es menor de edad, debe indicar el documento de identidad del apoderado."
            )

    if "psicolog" in data.escuela_profesional.lower():
        if not data.docente_nombre or not data.docente_nombre.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para la Escuela de Psicología (Cámara Gesell), el nombre del docente a cargo es obligatorio."
            )

    try:
        t_inicio = parse_time_str(data.horario_inicio)
        t_fin = parse_time_str(data.horario_fin)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de horario incorrecto: {e}"
        )

    codigo = generar_codigo_ticket_paciente(db)

    nueva_solicitud = SolicitudPaciente(
        codigo_ticket=codigo,
        escuela_profesional=data.escuela_profesional.strip(),
        estudiante_correo=data.estudiante_correo.strip().lower(),
        estudiante_nombre=data.estudiante_nombre.strip(),
        estudiante_dni=data.estudiante_dni.strip(),
        estudiante_telefono=data.estudiante_telefono.strip() if data.estudiante_telefono else None,
        paciente_nombre=data.paciente_nombre.strip(),
        paciente_dni=data.paciente_dni.strip(),
        paciente_telefono=data.paciente_telefono.strip() if data.paciente_telefono else None,
        es_menor_edad=data.es_menor_edad,
        apoderado_nombre=data.apoderado_nombre.strip() if data.es_menor_edad and data.apoderado_nombre else None,
        apoderado_dni=data.apoderado_dni.strip() if data.es_menor_edad and data.apoderado_dni else None,
        asignatura=data.asignatura.strip(),
        nrc=data.nrc.strip() if data.nrc else None,
        docente_nombre=data.docente_nombre.strip() if data.docente_nombre else None,
        fecha_atencion=data.fecha_atencion,
        horario_inicio=t_inicio,
        horario_fin=t_fin,
        url_consentimiento_pdf=data.url_consentimiento_pdf.strip() if data.url_consentimiento_pdf else None,
        declaracion_aceptada=data.declaracion_aceptada,
        ingresado_garita=False,
        fecha_ingreso_real=None,
        estado="REGISTRADO",
        observaciones_ssoma=None
    )

    db.add(nueva_solicitud)
    db.commit()
    db.refresh(nueva_solicitud)
    return nueva_solicitud


@router.get("/{codigo_o_id}", response_model=SolicitudPacienteResponse)
def obtener_solicitud_paciente(
    codigo_o_id: str,
    db: Session = Depends(get_db),
):
    sol = None
    if codigo_o_id.isdigit():
        sol = db.query(SolicitudPaciente).filter(SolicitudPaciente.id == int(codigo_o_id)).first()
    if not sol:
        sol = db.query(SolicitudPaciente).filter(
            SolicitudPaciente.codigo_ticket == codigo_o_id.strip().upper()
        ).first()

    if not sol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró ninguna solicitud de paciente con el identificador '{codigo_o_id}'."
        )
    return sol


@router.post("/{id}/check-in", response_model=SolicitudPacienteResponse)
def marcar_ingreso_paciente(
    id: int,
    data: Optional[SolicitudPacienteCheckIn] = None,
    db: Session = Depends(get_db),
):
    sol = db.query(SolicitudPaciente).filter(SolicitudPaciente.id == id).first()
    if not sol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró la solicitud de paciente con ID {id}."
        )

    sol.ingresado_garita = True
    sol.fecha_ingreso_real = datetime.utcnow()
    sol.estado = "INGRESADO"

    db.commit()
    db.refresh(sol)
    return sol


@router.patch("/{id}/ssoma", response_model=SolicitudPacienteResponse)
def actualizar_ssoma_paciente(
    id: int,
    data: SolicitudPacienteSSOMAUpdate,
    db: Session = Depends(get_db),
):
    sol = db.query(SolicitudPaciente).filter(SolicitudPaciente.id == id).first()
    if not sol:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró la solicitud de paciente con ID {id}."
        )

    if data.estado:
        sol.estado = data.estado.strip().upper()
    if data.observaciones_ssoma is not None:
        sol.observaciones_ssoma = data.observaciones_ssoma.strip()

    db.commit()
    db.refresh(sol)
    return sol

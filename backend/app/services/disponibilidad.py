from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.models.solicitud import Solicitud, SolicitudRecurso
from app.models.ambiente import Ambiente

def verificar_solapamiento_ambiente(
    db: Session,
    ambiente_id: int,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    solicitud_id_excluir: int | None = None,
    buffer_minutos: int = 60
) -> Solicitud | None:
    """
    RN-01: No se permitirá enviar solicitudes si el intervalo [FechaInicio, FechaFin]
    coincide con un evento confirmado/en revisión en el mismo ambiente, o si no se
    respeta el intervalo mínimo logístico (por defecto 60 min) para el traslado
    y acondicionamiento de mobiliario por parte del personal de operaciones.
    """
    delta = timedelta(minutes=buffer_minutos)
    
    # Obtener el nombre del ambiente que el usuario desea reservar
    ambiente_solicitado = db.query(Ambiente).filter(Ambiente.id == ambiente_id).first()
    nombre_ambiente_solicitado = ambiente_solicitado.nombre if ambiente_solicitado else "el ambiente seleccionado"

    # 1. Buscar solicitudes activas en el MISMO ambiente que colisionen o violen el buffer
    query_mismo_ambiente = db.query(Solicitud).filter(
        Solicitud.ambiente_id == ambiente_id,
        Solicitud.estado.in_(["APROBADO", "PENDIENTE"]),
        Solicitud.fecha_inicio < (fecha_fin + delta),
        Solicitud.fecha_fin > (fecha_inicio - delta)
    )
    if solicitud_id_excluir:
        query_mismo_ambiente = query_mismo_ambiente.filter(Solicitud.id != solicitud_id_excluir)
        
    candidatos_mismo = query_mismo_ambiente.order_by(Solicitud.fecha_inicio.asc()).all()

    if candidatos_mismo:
        # Priorizar solapamiento directo estricto en el mismo espacio
        conflicto_directo = next(
            (c for c in candidatos_mismo if fecha_inicio < c.fecha_fin and fecha_fin > c.fecha_inicio),
            None
        )
        conflicto = conflicto_directo or candidatos_mismo[0]
        es_directo = (fecha_inicio < conflicto.fecha_fin) and (fecha_fin > conflicto.fecha_inicio)

        ini_str = conflicto.fecha_inicio.strftime("%H:%M")
        fin_str = conflicto.fecha_fin.strftime("%H:%M del %d/%m/%Y")
        hora_fin_simple = conflicto.fecha_fin.strftime("%H:%M")

        if es_directo:
            tipo = "SOLAPAMIENTO_DIRECTO"
            mensaje = (
                f"Conflicto de horario en '{nombre_ambiente_solicitado}'. "
                f"Ya existe una solicitud ({conflicto.codigo_ticket}) en estado {conflicto.estado} "
                f"programada desde las {ini_str} hasta las {fin_str}."
            )
            hora_sugerida = (conflicto.fecha_fin + delta).strftime("%H:%M")
        elif fecha_inicio >= conflicto.fecha_fin and fecha_inicio < conflicto.fecha_fin + delta:
            tipo = "INTERVALO_POSTERIOR_INSUFICIENTE"
            hora_sugerida = (conflicto.fecha_fin + delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado y logística de mobiliario: Debido a la disponibilidad "
                f"de personal para el traslado y acondicionamiento del mobiliario, se requiere un "
                f"intervalo mínimo de 1 hora entre eventos consecutivos en '{nombre_ambiente_solicitado}'. "
                f"La solicitud previa ({conflicto.codigo_ticket}) finaliza a las {hora_fin_simple}. "
                f"Puede programar su evento a partir de las {hora_sugerida}."
            )
        elif fecha_fin <= conflicto.fecha_inicio and fecha_fin + delta > conflicto.fecha_inicio:
            tipo = "INTERVALO_ANTERIOR_INSUFICIENTE"
            hora_sugerida = (conflicto.fecha_inicio - delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado y logística de mobiliario: Se requiere un intervalo mínimo "
                f"de 1 hora entre eventos consecutivos en '{nombre_ambiente_solicitado}' para el traslado y "
                f"acondicionamiento de mobiliario. El siguiente evento ({conflicto.codigo_ticket}) "
                f"inicia a las {ini_str}. Su evento debe finalizar a más tardar a las {hora_sugerida}."
            )
        else:
            tipo = "INTERVALO_INSUFICIENTE"
            hora_sugerida = (conflicto.fecha_fin + delta).strftime("%H:%M")
            mensaje = (
                f"Restricción logística de mobiliario: Se requiere al menos 1 hora de separación "
                f"con respecto al evento {conflicto.codigo_ticket} ({ini_str} a {hora_fin_simple})."
            )

        conflicto.es_solapamiento_directo = es_directo
        conflicto.tipo_conflicto = tipo
        conflicto.mensaje_conflicto = mensaje
        conflicto.hora_sugerida = hora_sugerida
        conflicto.minutos_buffer = buffer_minutos
        conflicto.es_inter_area = False
        return conflicto

    # 2. Buscar eventos consecutivos en OTROS ambientes (Restricción Inter-Área de traslado de mobiliario)
    query_otros_ambientes = db.query(Solicitud).filter(
        Solicitud.ambiente_id != ambiente_id,
        Solicitud.estado.in_(["APROBADO", "PENDIENTE"])
    )
    if solicitud_id_excluir:
        query_otros_ambientes = query_otros_ambientes.filter(Solicitud.id != solicitud_id_excluir)

    # Filtrar eventos consecutivos en otros ambientes donde el margen sea menor a 1 hora
    filtro_inter = or_(
        and_(Solicitud.fecha_fin <= fecha_inicio, Solicitud.fecha_fin > (fecha_inicio - delta)),
        and_(Solicitud.fecha_inicio >= fecha_fin, Solicitud.fecha_inicio < (fecha_fin + delta))
    )
    candidatos_otros = query_otros_ambientes.filter(filtro_inter).order_by(Solicitud.fecha_inicio.asc()).all()

    if candidatos_otros:
        conflicto = candidatos_otros[0]
        otro_ambiente_nombre = conflicto.ambiente.nombre if conflicto.ambiente else f"Ambiente #{conflicto.ambiente_id}"
        ini_str = conflicto.fecha_inicio.strftime("%H:%M")
        hora_fin_simple = conflicto.fecha_fin.strftime("%H:%M")

        # Verificar si es consecutivo posterior o anterior
        if conflicto.fecha_fin <= fecha_inicio and conflicto.fecha_fin > (fecha_inicio - delta):
            tipo = "INTERVALO_INTER_AREA_POSTERIOR"
            hora_sugerida = (conflicto.fecha_fin + delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado logístico inter-área: El personal de operaciones requiere "
                f"al menos 1 hora de intervalo para el desmontaje, traslado y acondicionamiento del "
                f"mobiliario entre diferentes ambientes. La solicitud previa ({conflicto.codigo_ticket}) "
                f"en '{otro_ambiente_nombre}' finaliza a las {hora_fin_simple}. "
                f"Puede programar su evento en '{nombre_ambiente_solicitado}' a partir de las {hora_sugerida}."
            )
        else:
            tipo = "INTERVALO_INTER_AREA_ANTERIOR"
            hora_sugerida = (conflicto.fecha_inicio - delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado logístico inter-área: Se requiere al menos 1 hora de intervalo "
                f"para el traslado de mobiliario entre diferentes ambientes. El siguiente evento ({conflicto.codigo_ticket}) "
                f"en '{otro_ambiente_nombre}' inicia a las {ini_str}. "
                f"Su evento en '{nombre_ambiente_solicitado}' debe finalizar a más tardar a las {hora_sugerida}."
            )

        conflicto.es_solapamiento_directo = False
        conflicto.tipo_conflicto = tipo
        conflicto.mensaje_conflicto = mensaje
        conflicto.hora_sugerida = hora_sugerida
        conflicto.minutos_buffer = buffer_minutos
        conflicto.es_inter_area = True
        return conflicto

    return None


def diagnosticar_disponibilidad_ambiente(
    db: Session,
    ambiente_id: int,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    solicitud_id_excluir: int | None = None,
    buffer_minutos: int = 60
) -> dict:
    """
    Retorna un informe estructurado de disponibilidad e intervalos para la API y el Frontend.
    """
    conflicto = verificar_solapamiento_ambiente(
        db=db,
        ambiente_id=ambiente_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        solicitud_id_excluir=solicitud_id_excluir,
        buffer_minutos=buffer_minutos
    )
    if not conflicto:
        return {
            "disponible": True,
            "tipo_conflicto": None,
            "mensaje": "Horario disponible. Cumple con el intervalo logístico de 1 hora.",
            "evento_conflicto": None
        }

    return {
        "disponible": False,
        "tipo_conflicto": getattr(conflicto, "tipo_conflicto", "SOLAPAMIENTO"),
        "es_inter_area": getattr(conflicto, "es_inter_area", False),
        "mensaje": getattr(conflicto, "mensaje_conflicto", "Conflicto de horario o intervalo logístico insuficiente."),
        "hora_sugerida": getattr(conflicto, "hora_sugerida", None),
        "minutos_buffer": buffer_minutos,
        "evento_conflicto": {
            "id": conflicto.id,
            "codigo_ticket": conflicto.codigo_ticket,
            "ambiente_id": conflicto.ambiente_id,
            "ambiente_nombre": conflicto.ambiente.nombre if conflicto.ambiente else None,
            "estado": conflicto.estado,
            "fecha_inicio": conflicto.fecha_inicio.isoformat(),
            "fecha_fin": conflicto.fecha_fin.isoformat(),
        }
    }


def calcular_stock_disponible(
    db: Session,
    fecha_inicio: datetime,
    fecha_fin: datetime,
    solicitud_id_excluir: int | None = None
) -> list[dict]:
    """
    RN-02: Para un intervalo de tiempo dado, el número máximo asignable de un recurso es:
    Stock Disponible = Stock Total - sum(Stock Reservado en Eventos Simultáneos)
    """
    # 1. Obtener todos los recursos con su área de destino
    recursos = db.query(Recurso, AreaDestino.nombre.label("area_nombre")).join(
        AreaDestino, Recurso.area_destino_id == AreaDestino.id
    ).order_by(Recurso.area_destino_id, Recurso.id).all()

    # 2. Subconsulta o cálculo de reservas simultáneas aprobadas o pendientes
    filtro_eventos = [
        Solicitud.estado.in_(["APROBADO", "PENDIENTE"]),
        Solicitud.fecha_inicio < fecha_fin,
        Solicitud.fecha_fin > fecha_inicio
    ]
    if solicitud_id_excluir:
        filtro_eventos.append(Solicitud.id != solicitud_id_excluir)

    reservas_simultaneas = db.query(
        SolicitudRecurso.recurso_id,
        func.coalesce(func.sum(SolicitudRecurso.cantidad), 0).label("total_reservado")
    ).join(
        Solicitud, SolicitudRecurso.solicitud_id == Solicitud.id
    ).filter(
        *filtro_eventos
    ).group_by(
        SolicitudRecurso.recurso_id
    ).all()

    dict_reservados = {r.recurso_id: int(r.total_reservado) for r in reservas_simultaneas}

    resultado = []
    for rec, area_nombre in recursos:
        reservado = dict_reservados.get(rec.id, 0)
        disponible = max(0, rec.stock_total - reservado)
        resultado.append({
            "id": rec.id,
            "nombre": rec.nombre,
            "area_destino_id": rec.area_destino_id,
            "area_destino_nombre": area_nombre,
            "stock_total": rec.stock_total,
            "stock_reservado": reservado,
            "stock_disponible": disponible,
            "es_critico": rec.es_critico
        })

    return resultado

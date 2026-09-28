from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.recurso import Recurso
from app.models.area_destino import AreaDestino
from app.models.solicitud import Solicitud, SolicitudRecurso, SolicitudHorario
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

    # 1. Buscar solicitudes activas en el MISMO ambiente que colisionen o violen el buffer evaluando sus horarios
    query_mismo_ambiente = (
        db.query(SolicitudHorario, Solicitud)
        .join(Solicitud, SolicitudHorario.solicitud_id == Solicitud.id)
        .filter(
            Solicitud.ambiente_id == ambiente_id,
            Solicitud.estado.in_(["APROBADO", "PENDIENTE"]),
            SolicitudHorario.fecha_inicio < (fecha_fin + delta),
            SolicitudHorario.fecha_fin > (fecha_inicio - delta)
        )
    )
    if solicitud_id_excluir:
        query_mismo_ambiente = query_mismo_ambiente.filter(Solicitud.id != solicitud_id_excluir)
        
    candidatos_mismo = query_mismo_ambiente.order_by(SolicitudHorario.fecha_inicio.asc()).all()

    if candidatos_mismo:
        # Priorizar solapamiento directo estricto en el mismo espacio
        conflicto_directo = next(
            (c for c in candidatos_mismo if fecha_inicio < c[0].fecha_fin and fecha_fin > c[0].fecha_inicio),
            None
        )
        conflicto_pair = conflicto_directo or candidatos_mismo[0]
        slot, sol = conflicto_pair
        es_directo = (fecha_inicio < slot.fecha_fin) and (fecha_fin > slot.fecha_inicio)

        ini_str = slot.fecha_inicio.strftime("%H:%M")
        fin_str = slot.fecha_fin.strftime("%H:%M del %d/%m/%Y")
        hora_fin_simple = slot.fecha_fin.strftime("%H:%M")

        if es_directo:
            tipo = "SOLAPAMIENTO_DIRECTO"
            mensaje = (
                f"Conflicto de horario en '{nombre_ambiente_solicitado}'. "
                f"Ya existe una solicitud ({sol.codigo_ticket}) en estado {sol.estado} "
                f"programada desde las {ini_str} hasta las {fin_str}."
            )
            hora_sugerida = (slot.fecha_fin + delta).strftime("%H:%M")
        elif fecha_inicio >= slot.fecha_fin and fecha_inicio < slot.fecha_fin + delta:
            tipo = "INTERVALO_POSTERIOR_INSUFICIENTE"
            hora_sugerida = (slot.fecha_fin + delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado y logística de mobiliario: Debido a la disponibilidad "
                f"de personal para el traslado y acondicionamiento del mobiliario, se requiere un "
                f"intervalo mínimo de 1 hora entre eventos consecutivos en '{nombre_ambiente_solicitado}'. "
                f"La solicitud previa ({sol.codigo_ticket}) finaliza a las {hora_fin_simple}. "
                f"Puede programar su evento a partir de las {hora_sugerida}."
            )
        elif fecha_fin <= slot.fecha_inicio and fecha_fin + delta > slot.fecha_inicio:
            tipo = "INTERVALO_ANTERIOR_INSUFICIENTE"
            hora_sugerida = (slot.fecha_inicio - delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado y logística de mobiliario: Se requiere un intervalo mínimo "
                f"de 1 hora entre eventos consecutivos en '{nombre_ambiente_solicitado}' para el traslado y "
                f"acondicionamiento de mobiliario. El siguiente evento ({sol.codigo_ticket}) "
                f"inicia a las {ini_str}. Su evento debe finalizar a más tardar a las {hora_sugerida}."
            )
        else:
            tipo = "INTERVALO_INSUFICIENTE"
            hora_sugerida = (slot.fecha_fin + delta).strftime("%H:%M")
            mensaje = (
                f"Restricción logística de mobiliario: Se requiere al menos 1 hora de separación "
                f"con respecto al evento {sol.codigo_ticket} ({ini_str} a {hora_fin_simple})."
            )

        sol.es_solapamiento_directo = es_directo
        sol.tipo_conflicto = tipo
        sol.mensaje_conflicto = mensaje
        sol.hora_sugerida = hora_sugerida
        sol.minutos_buffer = buffer_minutos
        sol.es_inter_area = False
        sol.slot_fecha_inicio = slot.fecha_inicio
        sol.slot_fecha_fin = slot.fecha_fin
        return sol

    # 2. Buscar eventos consecutivos en OTROS ambientes (Restricción Inter-Área de traslado de mobiliario)
    filtro_inter = or_(
        and_(SolicitudHorario.fecha_fin <= fecha_inicio, SolicitudHorario.fecha_fin > (fecha_inicio - delta)),
        and_(SolicitudHorario.fecha_inicio >= fecha_fin, SolicitudHorario.fecha_inicio < (fecha_fin + delta))
    )
    query_otros_ambientes = (
        db.query(SolicitudHorario, Solicitud)
        .join(Solicitud, SolicitudHorario.solicitud_id == Solicitud.id)
        .filter(
            Solicitud.ambiente_id != ambiente_id,
            Solicitud.estado.in_(["APROBADO", "PENDIENTE"]),
            filtro_inter
        )
    )
    if solicitud_id_excluir:
        query_otros_ambientes = query_otros_ambientes.filter(Solicitud.id != solicitud_id_excluir)

    candidatos_otros = query_otros_ambientes.order_by(SolicitudHorario.fecha_inicio.asc()).all()

    if candidatos_otros:
        slot, sol = candidatos_otros[0]
        otro_ambiente_nombre = sol.ambiente.nombre if sol.ambiente else f"Ambiente #{sol.ambiente_id}"
        ini_str = slot.fecha_inicio.strftime("%H:%M")
        hora_fin_simple = slot.fecha_fin.strftime("%H:%M")

        if slot.fecha_fin <= fecha_inicio and slot.fecha_fin > (fecha_inicio - delta):
            tipo = "INTERVALO_INTER_AREA_POSTERIOR"
            hora_sugerida = (slot.fecha_fin + delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado logístico inter-área: El personal de operaciones requiere "
                f"al menos 1 hora de intervalo para el desmontaje, traslado y acondicionamiento del "
                f"mobiliario entre diferentes ambientes. La solicitud previa ({sol.codigo_ticket}) "
                f"en '{otro_ambiente_nombre}' finaliza a las {hora_fin_simple}. "
                f"Puede programar su evento en '{nombre_ambiente_solicitado}' a partir de las {hora_sugerida}."
            )
        else:
            tipo = "INTERVALO_INTER_AREA_ANTERIOR"
            hora_sugerida = (slot.fecha_inicio - delta).strftime("%H:%M")
            mensaje = (
                f"Restricción de traslado logístico inter-área: Se requiere al menos 1 hora de intervalo "
                f"para el traslado de mobiliario entre diferentes ambientes. El siguiente evento ({sol.codigo_ticket}) "
                f"en '{otro_ambiente_nombre}' inicia a las {ini_str}. "
                f"Su evento en '{nombre_ambiente_solicitado}' debe finalizar a más tardar a las {hora_sugerida}."
            )

        sol.es_solapamiento_directo = False
        sol.tipo_conflicto = tipo
        sol.mensaje_conflicto = mensaje
        sol.hora_sugerida = hora_sugerida
        sol.minutos_buffer = buffer_minutos
        sol.es_inter_area = True
        sol.slot_fecha_inicio = slot.fecha_inicio
        sol.slot_fecha_fin = slot.fecha_fin
        return sol

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

    slot_ini = getattr(conflicto, "slot_fecha_inicio", conflicto.fecha_inicio)
    slot_fin = getattr(conflicto, "slot_fecha_fin", conflicto.fecha_fin)

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
            "fecha_inicio": slot_ini.isoformat() if slot_ini else conflicto.fecha_inicio.isoformat(),
            "fecha_fin": slot_fin.isoformat() if slot_fin else conflicto.fecha_fin.isoformat(),
        }
    }


def diagnosticar_disponibilidad_multiple(
    db: Session,
    ambiente_id: int,
    horarios: list[dict],
    solicitud_id_excluir: int | None = None,
    buffer_minutos: int = 60
) -> dict:
    """
    Valida en tiempo real múltiples franjas horarias seleccionadas por el solicitante.
    """
    if not horarios:
        return {
            "disponible": False,
            "tipo_conflicto": "SIN_HORARIOS",
            "mensaje": "Debe especificar al menos una fecha y horario.",
            "evento_conflicto": None
        }

    # 1. Validar fechas individuales de cada horario
    for i, h in enumerate(horarios):
        ini = h["fecha_inicio"] if isinstance(h, dict) else h.fecha_inicio
        fin = h["fecha_fin"] if isinstance(h, dict) else h.fecha_fin
        if fin <= ini:
            return {
                "disponible": False,
                "tipo_conflicto": "FECHA_INVALIDA",
                "mensaje": f"En el horario #{i + 1}, la hora de fin debe ser posterior a la de inicio.",
                "conflicto_slot_index": i,
                "evento_conflicto": None
            }

    # 2. Validar que no haya solapamiento entre las fechas solicitadas internamente
    delta = timedelta(minutes=buffer_minutos)
    for i in range(len(horarios)):
        for j in range(i + 1, len(horarios)):
            h1_ini = horarios[i]["fecha_inicio"] if isinstance(horarios[i], dict) else horarios[i].fecha_inicio
            h1_fin = horarios[i]["fecha_fin"] if isinstance(horarios[i], dict) else horarios[i].fecha_fin
            h2_ini = horarios[j]["fecha_inicio"] if isinstance(horarios[j], dict) else horarios[j].fecha_inicio
            h2_fin = horarios[j]["fecha_fin"] if isinstance(horarios[j], dict) else horarios[j].fecha_fin

            if h1_ini < h2_fin and h1_fin > h2_ini:
                return {
                    "disponible": False,
                    "tipo_conflicto": "SOLAPAMIENTO_INTERNO",
                    "mensaje": f"Las fechas seleccionadas #{i + 1} y #{j + 1} se solapan entre sí.",
                    "conflicto_slot_index": j,
                    "evento_conflicto": None
                }
            if (h1_ini >= h2_fin and h1_ini < h2_fin + delta) or (h2_ini >= h1_fin and h2_ini < h1_fin + delta):
                return {
                    "disponible": False,
                    "tipo_conflicto": "INTERVALO_INTERNO_INSUFICIENTE",
                    "mensaje": f"Los horarios #{i + 1} y #{j + 1} deben tener al menos 1 hora de separación para logística.",
                    "conflicto_slot_index": j,
                    "evento_conflicto": None
                }

    # 3. Validar cada franja contra la base de datos
    for idx, h in enumerate(horarios):
        ini = h["fecha_inicio"] if isinstance(h, dict) else h.fecha_inicio
        fin = h["fecha_fin"] if isinstance(h, dict) else h.fecha_fin
        diag = diagnosticar_disponibilidad_ambiente(
            db=db,
            ambiente_id=ambiente_id,
            fecha_inicio=ini,
            fecha_fin=fin,
            solicitud_id_excluir=solicitud_id_excluir,
            buffer_minutos=buffer_minutos
        )
        if not diag["disponible"]:
            diag["conflicto_slot_index"] = idx
            diag["mensaje"] = f"Horario #{idx + 1} ({ini.strftime('%d/%m/%Y %H:%M')}): {diag['mensaje']}"
            return diag

    return {
        "disponible": True,
        "tipo_conflicto": None,
        "mensaje": "Todos los horarios seleccionados están disponibles y cumplen con el intervalo logístico de 1 hora.",
        "evento_conflicto": None
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
    recursos = db.query(Recurso, AreaDestino.nombre.label("area_nombre")).join(
        AreaDestino, Recurso.area_destino_id == AreaDestino.id
    ).order_by(Recurso.area_destino_id, Recurso.id).all()

    # Subconsulta con EXISTS sobre SolicitudHorario para saber si la solicitud está activa en esta franja
    slot_overlap = db.query(SolicitudHorario.id).filter(
        SolicitudHorario.solicitud_id == Solicitud.id,
        SolicitudHorario.fecha_inicio < fecha_fin,
        SolicitudHorario.fecha_fin > fecha_inicio
    ).exists()

    filtro_eventos = [
        Solicitud.estado.in_(["APROBADO", "PENDIENTE"]),
        slot_overlap
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


def calcular_stock_disponible_horarios(
    db: Session,
    horarios: list,
    solicitud_id_excluir: int | None = None
) -> list[dict]:
    """
    Calcula el stock disponible a lo largo de múltiples horarios solicitados.
    El stock disponible de un recurso para la reserva completa es el mínimo disponible
    en cualquiera de las franjas horarias solicitadas.
    """
    if not horarios:
        return []

    all_stocks = []
    for h in horarios:
        ini = h["fecha_inicio"] if isinstance(h, dict) else (h.fecha_inicio if hasattr(h, "fecha_inicio") else h[0])
        fin = h["fecha_fin"] if isinstance(h, dict) else (h.fecha_fin if hasattr(h, "fecha_fin") else h[1])
        all_stocks.append(calcular_stock_disponible(db, ini, fin, solicitud_id_excluir))

    base = all_stocks[0]
    for other in all_stocks[1:]:
        other_map = {item["id"]: item for item in other}
        for item in base:
            rec_id = item["id"]
            if rec_id in other_map:
                item["stock_disponible"] = min(item["stock_disponible"], other_map[rec_id]["stock_disponible"])
                item["stock_reservado"] = max(item["stock_reservado"], other_map[rec_id]["stock_reservado"])

    return base

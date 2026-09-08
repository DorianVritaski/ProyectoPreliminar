from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.ambiente import Ambiente
from app.models.area_destino import AreaDestino
from app.models.recurso import Recurso
from app.models.solicitud import Solicitud, SolicitudRecurso
from app.models.area_solicitante import AreaSolicitante

def seed_database(db: Session):
    # 1. Verificar si ya existen ambientes
    if db.query(Ambiente).first():
        return

    print("Inicializando datos semilla en PostgreSQL...")

    # Catálogo de Áreas / Facultades Solicitantes (RF-01.5 y RF-05.4)
    areas_solicitantes_data = [
        "Facultad de Ingeniería",
        "Facultad de Ciencias de la Empresa",
        "Facultad de Derecho",
        "Facultad de Humanidades",
        "Facultad de Ciencias de la Salud",
        "Dirección Académica",
        "Dirección de Vida Universitaria",
        "Escuela de Posgrado y Formación Continua"
    ]
    area_sol_map = {}
    for nombre in areas_solicitantes_data:
        area_sol = AreaSolicitante(nombre=nombre, activa=True)
        db.add(area_sol)
        db.flush()
        area_sol_map[nombre] = area_sol.id

    # Áreas Destino Operativas
    areas_data = [
        "Servicios Generales y Mantenimiento",
        "Tecnologías de la Información (TI)",
        "Seguridad, SSOMA y Vigilancia"
    ]
    area_map = {}
    for nombre in areas_data:
        area = AreaDestino(nombre=nombre)
        db.add(area)
        db.flush()
        area_map[nombre] = area.id

    # 8 Ambientes según RF-03.1
    ambientes_data = [
        ("Pérgolas pabellón F", 40),
        ("Área verde a lado del pabellón A", 100),
        ("Área verde a lado del auditorio", 120),
        ("Área verde a lado del pabellón C", 80),
        ("Área verde a lado del pabellón H", 150),
        ("Auditorio UC", 300),
        ("Área entre pabellón C y pabellón D", 60),
        ("Sala de audiencia", 50),
    ]
    ambiente_map = {}
    for nombre, cap in ambientes_data:
        amb = Ambiente(nombre=nombre, capacidad=cap, activo=True)
        db.add(amb)
        db.flush()
        ambiente_map[nombre] = amb.id

    # Recursos según RF-04.3 y RF-03.2
    # Críticos: Vallas, Proyectores, Micrófonos, Parlantes, Laptops
    recursos_data = [
        # Mantenimiento
        (area_map["Servicios Generales y Mantenimiento"], "Sillas", 250, False),
        (area_map["Servicios Generales y Mantenimiento"], "Mesas", 60, False),
        (area_map["Servicios Generales y Mantenimiento"], "Manteles", 60, False),
        (area_map["Servicios Generales y Mantenimiento"], "Puntos de luz", 25, False),
        (area_map["Servicios Generales y Mantenimiento"], "Vallas", 40, True),
        # TI
        (area_map["Tecnologías de la Información (TI)"], "Parlantes", 12, True),
        (area_map["Tecnologías de la Información (TI)"], "Micrófonos", 16, True),
        (area_map["Tecnologías de la Información (TI)"], "Laptops", 15, True),
        (area_map["Tecnologías de la Información (TI)"], "Proyectores", 8, True),
        (area_map["Tecnologías de la Información (TI)"], "Pantallas", 6, False),
        (area_map["Tecnologías de la Información (TI)"], "Ecran", 10, False),
        # SSOMA / Vigilancia
        (area_map["Seguridad, SSOMA y Vigilancia"], "Control de acceso", 10, False),
        (area_map["Seguridad, SSOMA y Vigilancia"], "Personal de resguardo", 15, False),
    ]
    recurso_map = {}
    for area_id, nombre, stock, critico in recursos_data:
        rec = Recurso(
            area_destino_id=area_id,
            nombre=nombre,
            stock_total=stock,
            es_critico=critico
        )
        db.add(rec)
        db.flush()
        recurso_map[nombre] = rec.id

    # Eventos de prueba (Septiembre 2026)
    # Evento 1: APROBADO en Auditorio UC
    sol1 = Solicitud(
        codigo_ticket="EVT-2026-X89F",
        correo_solicitante="j.morales@continental.edu.pe",
        telefono="987654321",
        area_solicitante_id=area_sol_map["Facultad de Ingeniería"],
        ambiente_id=ambiente_map["Auditorio UC"],
        fecha_inicio=datetime(2026, 9, 10, 9, 0, 0),
        fecha_fin=datetime(2026, 9, 10, 12, 0, 0),
        estado="APROBADO",
        protocolo_ssoma=True
    )
    db.add(sol1)
    db.flush()

    db.add(SolicitudRecurso(solicitud_id=sol1.id, recurso_id=recurso_map["Sillas"], cantidad=50))
    db.add(SolicitudRecurso(solicitud_id=sol1.id, recurso_id=recurso_map["Proyectores"], cantidad=1))
    db.add(SolicitudRecurso(solicitud_id=sol1.id, recurso_id=recurso_map["Micrófonos"], cantidad=2))
    db.add(SolicitudRecurso(solicitud_id=sol1.id, recurso_id=recurso_map["Parlantes"], cantidad=2))

    # Evento 2: PENDIENTE en Auditorio UC (tarde)
    sol2 = Solicitud(
        codigo_ticket="EVT-2026-B34K",
        correo_solicitante="c.vasquez@continental.edu.pe",
        telefono="912345678",
        area_solicitante_id=area_sol_map["Facultad de Ciencias de la Empresa"],
        ambiente_id=ambiente_map["Auditorio UC"],
        fecha_inicio=datetime(2026, 9, 10, 14, 0, 0),
        fecha_fin=datetime(2026, 9, 10, 17, 30, 0),
        estado="PENDIENTE",
        protocolo_ssoma=True
    )
    db.add(sol2)
    db.flush()

    db.add(SolicitudRecurso(solicitud_id=sol2.id, recurso_id=recurso_map["Sillas"], cantidad=80))
    db.add(SolicitudRecurso(solicitud_id=sol2.id, recurso_id=recurso_map["Proyectores"], cantidad=2))
    db.add(SolicitudRecurso(solicitud_id=sol2.id, recurso_id=recurso_map["Laptops"], cantidad=3))

    # Evento 3: Mismo día en otro ambiente (Área verde a lado del pabellón A) -> Demuestra indicador +2 eventos
    sol3 = Solicitud(
        codigo_ticket="EVT-2026-M56T",
        correo_solicitante="m.sanchez@continental.edu.pe",
        telefono="955443322",
        area_solicitante_id=area_sol_map["Dirección de Vida Universitaria"],
        ambiente_id=ambiente_map["Área verde a lado del pabellón A"],
        fecha_inicio=datetime(2026, 9, 10, 10, 0, 0),
        fecha_fin=datetime(2026, 9, 10, 15, 0, 0),
        estado="APROBADO",
        protocolo_ssoma=True
    )
    db.add(sol3)
    db.flush()
    db.add(SolicitudRecurso(solicitud_id=sol3.id, recurso_id=recurso_map["Vallas"], cantidad=15))
    db.add(SolicitudRecurso(solicitud_id=sol3.id, recurso_id=recurso_map["Mesas"], cantidad=10))

    # Evento 4: Sala de audiencia el 12 de septiembre
    sol4 = Solicitud(
        codigo_ticket="EVT-2026-J77R",
        correo_solicitante="a.torres@continental.edu.pe",
        telefono="944112233",
        area_solicitante_id=area_sol_map["Facultad de Derecho"],
        ambiente_id=ambiente_map["Sala de audiencia"],
        fecha_inicio=datetime(2026, 9, 12, 10, 0, 0),
        fecha_fin=datetime(2026, 9, 12, 13, 0, 0),
        estado="APROBADO",
        protocolo_ssoma=False
    )
    db.add(sol4)
    db.flush()
    db.add(SolicitudRecurso(solicitud_id=sol4.id, recurso_id=recurso_map["Micrófonos"], cantidad=3))
    db.add(SolicitudRecurso(solicitud_id=sol4.id, recurso_id=recurso_map["Pantallas"], cantidad=2))

    # Evento 5: Pérgolas pabellón F el 15 de septiembre
    sol5 = Solicitud(
        codigo_ticket="EVT-2026-W12Q",
        correo_solicitante="d.rojas@continental.edu.pe",
        telefono="966778899",
        area_solicitante_id=area_sol_map["Facultad de Humanidades"],
        ambiente_id=ambiente_map["Pérgolas pabellón F"],
        fecha_inicio=datetime(2026, 9, 15, 11, 0, 0),
        fecha_fin=datetime(2026, 9, 15, 16, 0, 0),
        estado="APROBADO",
        protocolo_ssoma=True
    )
    db.add(sol5)
    db.flush()
    db.add(SolicitudRecurso(solicitud_id=sol5.id, recurso_id=recurso_map["Puntos de luz"], cantidad=4))
    db.add(SolicitudRecurso(solicitud_id=sol5.id, recurso_id=recurso_map["Mesas"], cantidad=8))

    db.commit()
    print("Datos semilla inicializados exitosamente.")

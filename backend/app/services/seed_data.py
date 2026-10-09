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


def seed_accesos_sample(db: Session):
    from app.models.solicitud_acceso import SolicitudAcceso
    if db.query(SolicitudAcceso).first():
        return

    now = datetime.now()
    hoy_inicio = datetime(now.year, now.month, now.day, 8, 30)
    hoy_fin = datetime(now.year, now.month, now.day, 18, 0)

    # 1. Caso A: Contratista con trabajos de riesgo (Apartado 3 activo) -> PENDIENTE de SSOMA
    acc1 = SolicitudAcceso(
        codigo_acceso="ACC-2026-R810",
        anfitrion_correo="c.mendoza@continental.edu.pe",
        anfitrion_nombre="Ing. Carlos Mendoza",
        anfitrion_area="Dirección de Infraestructura y Mantenimiento",
        sede="Campus Huancayo",
        ubicacion_especifica="Pabellón B - Patio Técnico Subestación",
        motivo="Mantenimiento de Grupo Electrógeno y Tableros Eléctricos",
        fecha_inicio=hoy_inicio,
        fecha_fin=hoy_fin,
        detalles="Ingreso de herramientas de alto voltaje y personal técnico para mantenimiento semestral.",
        requiere_ssoma_riesgo=True,
        lineamientos_ssoma=None,
        observacion_ssoma=None,
        url_sctr_pdf="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        url_lista_personal_pdf="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        documentos_ssoma=None,
        visitantes=[
            {"id": 1, "nombre": "Juan Pérez Ramos", "dni": "45892134", "empresa": "ElectroSur Contratistas SAC", "ingresado": False, "hora_ingreso": None},
            {"id": 2, "nombre": "Marcos Aliaga Huamán", "dni": "70123984", "empresa": "ElectroSur Contratistas SAC", "ingresado": False, "hora_ingreso": None}
        ],
        estado="PENDIENTE",
        check_in_realizado=False,
        fecha_check_in=None
    )

    # 2. Caso B: Ponente internacional / Visita Académica (Sin riesgo) -> AUTORIZADO automático
    acc2 = SolicitudAcceso(
        codigo_acceso="ACC-2026-V502",
        anfitrion_correo="e.silva@continental.edu.pe",
        anfitrion_nombre="Dra. Elena Silva",
        anfitrion_area="Facultad de Ciencias de la Empresa",
        sede="Campus Huancayo",
        ubicacion_especifica="Auditorio UC",
        motivo="Ponencia Magistral de Apertura - Congreso Internacional",
        fecha_inicio=datetime(now.year, now.month, now.day, 10, 0),
        fecha_fin=datetime(now.year, now.month, now.day, 14, 0),
        detalles="Expositora invitada del consorcio universitario.",
        requiere_ssoma_riesgo=False,
        lineamientos_ssoma="Ingreso autorizado por Garita Principal Av. San Carlos. Portar credencial visible.",
        observacion_ssoma=None,
        url_sctr_pdf=None,
        url_lista_personal_pdf=None,
        documentos_ssoma=None,
        visitantes=[
            {"id": 1, "nombre": "Dra. Claudia Domínguez Valdés", "dni": "41239856", "empresa": "Universidad de Salamanca (España)", "ingresado": False, "hora_ingreso": None}
        ],
        estado="AUTORIZADO",
        check_in_realizado=False,
        fecha_check_in=None
    )

    # 3. Caso A ya Autorizado por SSOMA con Check-in activo
    acc3 = SolicitudAcceso(
        codigo_acceso="ACC-2026-P933",
        anfitrion_correo="a.galvez@continental.edu.pe",
        anfitrion_nombre="Lic. Andrea Gálvez",
        anfitrion_area="Dirección de Vida Universitaria",
        sede="Campus Huancayo",
        ubicacion_especifica="Área verde a lado del pabellón H",
        motivo="Instalación de Escenario y Sonido para Feria Vocacional",
        fecha_inicio=datetime(now.year, now.month, now.day, 7, 0),
        fecha_fin=datetime(now.year, now.month, now.day, 20, 0),
        detalles="Montaje de estructuras metálicas y audio profesional.",
        requiere_ssoma_riesgo=True,
        lineamientos_ssoma="Uso obligatorio de EPP completo: casco, chaleco reflectivo y botas con punta de acero. Descarga autorizada solo por portón vehicular 3.",
        observacion_ssoma=None,
        url_sctr_pdf="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        url_lista_personal_pdf="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        documentos_ssoma=None,
        visitantes=[
            {"id": 1, "nombre": "Roberto Cárdenas Vila", "dni": "20541299", "empresa": "Eventos & Estructuras Perú", "ingresado": True, "hora_ingreso": "07:35:10"},
            {"id": 2, "nombre": "Luis Morales Quispe", "dni": "47812903", "empresa": "Eventos & Estructuras Perú", "ingresado": False, "hora_ingreso": None}
        ],
        estado="AUTORIZADO",
        check_in_realizado=True,
        fecha_check_in=datetime(now.year, now.month, now.day, 7, 35, 10)
    )

    db.add(acc1)
    db.add(acc2)
    db.add(acc3)
    db.commit()
    print("Datos semilla de Solicitudes de Acceso inicializados con éxito.")


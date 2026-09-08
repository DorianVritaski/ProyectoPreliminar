import urllib.request
import json

BASE_URL = "http://localhost:8000/api/v1"

def api_call(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_msg)
        except:
            return e.code, {"detail": err_msg}

def test_flow():
    print("--- 1. Pruebas de Login Administrador ---")
    status, res = api_call("/admin/login", "POST", {
        "username": "operaciones@continental.edu.pe",
        "password": "admin2026"
    })
    print(f"Login admin inicial: {status} -> {res.get('message')}, Admin: {res.get('user', {}).get('nombre')}")
    assert status == 200, "Error en login admin inicial"

    print("\n--- 2. Pruebas de Gestión de Cuentas Administrador (Multi-Admin) ---")
    # Probar validación de dominio @continental.edu.pe
    status, res = api_call("/admin/usuarios", "POST", {
        "correo": "externo@gmail.com",
        "nombre": "Externo No Permitido",
        "password": "password123"
    })
    print(f"Intento con correo @gmail.com: {status} -> {res}")
    assert status in (400, 422), "Debería rechazar correos no institucionales"

    # Crear administrador institucional válido (idempotente)
    import time
    ts = int(time.time())
    new_admin_email = f"coordinador.ti.{ts}@continental.edu.pe"
    status, res = api_call("/admin/usuarios", "POST", {
        "correo": new_admin_email,
        "nombre": "Ing. Carlos Mendoza (TI)",
        "password": "passcontinental2026"
    })
    print(f"Crear admin institucional ({new_admin_email}): {status} -> ID={res.get('id')}, Nombre={res.get('nombre')}")
    assert status == 201, "Error creando nuevo administrador"
    new_admin_id = res.get("id")

    # Probar login con el nuevo administrador
    status, res = api_call("/admin/login", "POST", {
        "username": new_admin_email,
        "password": "passcontinental2026"
    })
    print(f"Login con nuevo admin: {status} -> {res.get('message')}, Usuario={res.get('user', {}).get('nombre')}")
    assert status == 200, "Error en login del nuevo admin"

    # Listar administradores
    status, usuarios = api_call("/admin/usuarios", "GET")
    print(f"Listar administradores -> Status: {status}, Response: {usuarios}")
    assert status == 200, "Error listando administradores"
    for u in usuarios:
        print(f"  - [{u['id']}] {u['nombre']} ({u['correo']}) - Activo: {u['activo']}")

    print("\n--- 3. Pruebas de CRUD de Áreas Administrativas Responsables ---")
    # Listar áreas destino existentes
    status, areas = api_call("/admin/areas-destino", "GET")
    print(f"Total áreas responsables: {len(areas)}")
    for a in areas:
        print(f"  - [{a['id']}] {a['nombre']} (Activa: {a['activa']}) - Recursos asociados: {a.get('recursos_count', 0)}")

    # Crear una nueva área operativa
    status, new_area = api_call("/admin/areas-destino", "POST", {
        "nombre": "Infraestructura y Obras Civiles",
        "activa": True
    })
    print(f"Crear área destino: {status} -> ID={new_area.get('id')}, Nombre={new_area.get('nombre')}")
    assert status == 201, "Error creando área destino"
    area_id = new_area.get("id")

    # Modificar área operativa
    status, updated_area = api_call(f"/admin/areas-destino/{area_id}", "PUT", {
        "nombre": "Seguridad Patrimonial y SSOMA",
        "activa": True
    })
    print(f"Actualizar área destino: {status} -> Nombre={updated_area.get('nombre')}")
    assert status == 200, "Error actualizando área destino"

    # Intentar eliminar un área que SÍ tiene recursos asociados (por ejemplo id 1: Mantenimiento)
    status, res = api_call("/admin/areas-destino/1", "DELETE")
    print(f"Intento eliminar área id=1 con recursos: {status} -> {res.get('detail')}")
    assert status == 400, "Debe rechazar la eliminación si tiene recursos asociados"

    # Eliminar el área que acabamos de crear (sin recursos asociados)
    status, res = api_call(f"/admin/areas-destino/{area_id}", "DELETE")
    print(f"Eliminar área id={area_id} (sin recursos): {status} -> {res.get('message')}")
    assert status == 200, "Error eliminando área destino vacía"

    print("\n--- 4. Pruebas de Seguimiento Público y Visualización de Motivo de Rechazo ---")
    # Buscar una solicitud para rechazarla con motivo o verificar una existente
    status, tracking_list = api_call("/solicitudes/seguimiento?search=EVT-2026-", "GET")
    if tracking_list:
        sol = tracking_list[0]
        codigo = sol["codigo_ticket"]
        sol_id = sol["id"]
        # Rechazar solicitud con un motivo específico
        motivo_test = "El auditorio se encuentra reservado para mantenimiento programado de luminarias y equipos de sonido."
        status, res = api_call(f"/admin/solicitudes/{sol_id}/estado", "PATCH", {
            "estado": "RECHAZADO",
            "motivo_rechazo": motivo_test
        })
        print(f"Rechazar solicitud {codigo} con motivo: {status}")

        # Consultar desde el endpoint público de seguimiento
        status, tracked = api_call(f"/solicitudes/seguimiento?search={codigo}", "GET")
        assert status == 200 and len(tracked) > 0, "Error en seguimiento público"
        sol_track = tracked[0]
        print(f"Consulta pública de seguimiento para {codigo}:")
        print(f"  - Estado: {sol_track['estado']}")
        print(f"  - Motivo de Rechazo: {sol_track.get('motivo_rechazo')}")
        assert sol_track.get("motivo_rechazo") == motivo_test, "El motivo de rechazo debe coincidir exactamente"
        print("  -> Verificación pública de motivo de rechazo EXITOSA.")

    print("\n✅ ¡TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON EXITOSAMENTE!")

if __name__ == "__main__":
    test_flow()

import urllib.request
import json
import time

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

def test_crud_enhancements():
    ts = int(time.time())

    print("=== 1. TEST: Catálogo de Ambientes (Edición de Nombres/Aforo y Eliminación) ===")
    # 1.1 Crear ambiente temporal
    temp_amb_name = f"Aula de Simulación {ts}"
    status, amb = api_call("/admin/ambientes", "POST", {
        "nombre": temp_amb_name,
        "capacidad": 40,
        "activo": True
    })
    print(f"Crear ambiente: {status} -> ID={amb.get('id')}, Nombre={amb.get('nombre')}, Capacidad={amb.get('capacidad')}")
    assert status == 201, "Fallo al crear ambiente"
    amb_id = amb["id"]

    # 1.2 Editar nombre y capacidad (aforo)
    status, amb_upd = api_call(f"/admin/ambientes/{amb_id}", "PUT", {
        "nombre": f"{temp_amb_name} (Renombrado)",
        "capacidad": 85,
        "activo": True
    })
    print(f"Editar ambiente: {status} -> Nombre={amb_upd.get('nombre')}, Capacidad={amb_upd.get('capacidad')}")
    assert status == 200, "Fallo al editar ambiente"
    assert amb_upd["capacidad"] == 85, "Capacidad no se actualizó correctamente"

    # 1.3 Validar bloqueo de eliminación para ambientes con solicitudes (ej. Auditorio Principal id 1)
    status, res_del_blocked = api_call("/admin/ambientes/1", "DELETE")
    print(f"Intento eliminar ambiente con solicitudes: {status} -> {res_del_blocked.get('detail')}")
    assert status == 400, "Debe rechazar la eliminación de ambientes con solicitudes registradas"

    # 1.4 Eliminar ambiente temporal (sin solicitudes)
    status, res_del = api_call(f"/admin/ambientes/{amb_id}", "DELETE")
    print(f"Eliminar ambiente libre: {status} -> {res_del.get('message')}")
    assert status == 200, "Fallo al eliminar ambiente libre"

    print("\n=== 2. TEST: Control de Inventario (Edición de Nombres/Datos y Eliminación) ===")
    # 2.1 Crear recurso temporal
    temp_rec_name = f"Laptop Gamer Demo {ts}"
    status, rec = api_call("/admin/recursos", "POST", {
        "nombre": temp_rec_name,
        "area_destino_id": 2, # TI
        "stock_total": 15,
        "es_critico": False
    })
    print(f"Crear recurso: {status} -> ID={rec.get('id')}, Nombre={rec.get('nombre')}, Stock={rec.get('stock_total')}")
    assert status == 201, "Fallo al crear recurso"
    rec_id = rec["id"]

    # 2.2 Editar nombre del recurso, área y stock
    status, rec_upd = api_call(f"/admin/recursos/{rec_id}", "PUT", {
        "nombre": f"Estación Móvil TI {ts} (Actualizado)",
        "area_destino_id": 2,
        "stock_total": 25,
        "es_critico": True
    })
    print(f"Editar recurso: {status} -> Nombre={rec_upd.get('nombre')}, Stock={rec_upd.get('stock_total')}, Crítico={rec_upd.get('es_critico')}")
    assert status == 200, "Fallo al editar recurso"
    assert rec_upd["stock_total"] == 25 and rec_upd["es_critico"] is True

    # 2.3 Validar bloqueo de eliminación para recursos asociados a solicitudes (ej. Sillas id 1)
    status, res_rec_del_blocked = api_call("/admin/recursos/1", "DELETE")
    print(f"Intento eliminar recurso con solicitudes: {status} -> {res_rec_del_blocked.get('detail')}")
    assert status == 400, "Debe rechazar la eliminación de recursos en solicitudes"

    # 2.4 Eliminar recurso temporal (sin solicitudes)
    status, res_rec_del = api_call(f"/admin/recursos/{rec_id}", "DELETE")
    print(f"Eliminar recurso libre: {status} -> {res_rec_del.get('message')}")
    assert status == 200, "Fallo al eliminar recurso libre"

    print("\n=== 3. TEST: Catálogo de Áreas Solicitantes (Edición de Nombres y Eliminación) ===")
    # 3.1 Crear área solicitante temporal
    temp_area_name = f"Facultad de Humanidades {ts}"
    status, area = api_call("/admin/areas-solicitantes", "POST", {
        "nombre": temp_area_name,
        "activa": True
    })
    print(f"Crear área solicitante: {status} -> ID={area.get('id')}, Nombre={area.get('nombre')}")
    assert status == 201, "Fallo al crear área solicitante"
    area_id = area["id"]

    # 3.2 Editar nombre del área solicitante
    status, area_upd = api_call(f"/admin/areas-solicitantes/{area_id}", "PUT", {
        "nombre": f"Facultad de Humanidades y Artes {ts}",
        "activa": True
    })
    print(f"Editar área solicitante: {status} -> Nombre={area_upd.get('nombre')}")
    assert status == 200, "Fallo al editar área solicitante"
    assert "Artes" in area_upd["nombre"]

    # 3.3 Validar bloqueo de eliminación para áreas con solicitudes registradas (ej. id 1)
    status, res_area_del_blocked = api_call("/admin/areas-solicitantes/1", "DELETE")
    print(f"Intento eliminar área con solicitudes: {status} -> {res_area_del_blocked.get('detail')}")
    assert status == 400, "Debe rechazar la eliminación de áreas con solicitudes"

    # 3.4 Eliminar área solicitante temporal (sin solicitudes)
    status, res_area_del = api_call(f"/admin/areas-solicitantes/{area_id}", "DELETE")
    print(f"Eliminar área solicitante libre: {status} -> {res_area_del.get('message')}")
    assert status == 200, "Fallo al eliminar área solicitante libre"

    print("\n✅ ¡TODAS LAS PRUEBAS DE EDICIÓN Y ELIMINACIÓN PASARON EXITOSAMENTE (100%)!")

if __name__ == "__main__":
    test_crud_enhancements()

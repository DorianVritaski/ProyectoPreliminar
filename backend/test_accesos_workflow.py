import urllib.request
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"

def request(url, method="GET", data=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8") if data else None,
        headers={"Content-Type": "application/json"} if data else {}
    )
    req.get_method = lambda: method
    with urllib.request.urlopen(req) as resp:
        return resp.getcode(), json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("=== 1. TEST GET /accesos ===")
    status, data = request(f"{BASE_URL}/accesos")
    print(f"Status: {status}, Total accesos: {len(data)}")
    assert status == 200

    print("\n=== 2. TEST POST /accesos (Crear Caso A con Riesgo SSOMA) ===")
    now = datetime.now()
    inicio = (now + timedelta(days=1)).replace(hour=8, minute=0, second=0).isoformat()
    fin = (now + timedelta(days=1)).replace(hour=17, minute=0, second=0).isoformat()

    payload_create = {
        "anfitrion_nombre": "Ing. Maribel Torres",
        "anfitrion_correo": "mtorres@continental.edu.pe",
        "anfitrion_area": "Facultad de Arquitectura",
        "sede": "Campus Huancayo",
        "ubicacion_especifica": "Pabellón F - Terraza Superior",
        "motivo": "Mantenimiento Preventivo de Paneles Solares y Luminarias",
        "fecha_inicio": inicio,
        "fecha_fin": fin,
        "detalles": "Acceso con andamios certificados y arneses de seguridad.",
        "requiere_ssoma_riesgo": True,
        "url_sctr_pdf": "https://drive.google.com/file/d/demo-sctr-paneles/view",
        "url_lista_personal_pdf": "https://drive.google.com/file/d/demo-nomina-paneles/view",
        "visitantes": [
            {"id": 1, "nombre": "Jorge Quispe Mamani", "dni": "70123456", "empresa": "SolarTech SAC"},
            {"id": 2, "nombre": "Alberto Ramos Díaz", "dni": "70987654", "empresa": "SolarTech SAC"}
        ]
    }

    status, new_acceso = request(f"{BASE_URL}/accesos", method="POST", data=payload_create)
    print(f"Status: {status}, Código: {new_acceso['codigo_acceso']}, Estado Inicial: {new_acceso['estado']}")
    assert status in (200, 201)
    assert new_acceso["estado"] == "PENDIENTE" # Caso A inicia PENDIENTE
    acceso_id = new_acceso["id"]
    codigo_acceso = new_acceso["codigo_acceso"]

    print("\n=== 3. TEST PATCH /admin/accesos/{id}/ssoma (Autorización y Lineamientos SSOMA) ===")
    payload_ssoma = {
        "estado": "AUTORIZADO",
        "lineamientos_ssoma": "Obligatorio uso de casco dieléctrico clase E, arnés con doble línea de vida y barbiquejo. Inspección de andamios por prevencionista antes de iniciar.",
        "observacion_ssoma": None
    }
    status, updated_ssoma = request(f"{BASE_URL}/admin/accesos/{acceso_id}/ssoma", method="PATCH", data=payload_ssoma)
    print(f"Status: {status}, Nuevo Estado: {updated_ssoma['estado']}")
    print(f"Lineamientos asignados: {updated_ssoma['lineamientos_ssoma']}")
    assert status == 200
    assert updated_ssoma["estado"] == "AUTORIZADO"

    print("\n=== 4. TEST POST /admin/accesos/{id}/check-in (Registro de Garita) ===")
    payload_checkin = {
        "check_in_realizado": True,
        "visitantes": [
            {"id": 1, "nombre": "Jorge Quispe Mamani", "dni": "70123456", "empresa": "SolarTech SAC", "ingresado": True, "hora_ingreso": "08:15"},
            {"id": 2, "nombre": "Alberto Ramos Díaz", "dni": "70987654", "empresa": "SolarTech SAC", "ingresado": False, "hora_ingreso": None}
        ]
    }
    status, updated_checkin = request(f"{BASE_URL}/admin/accesos/{acceso_id}/check-in", method="POST", data=payload_checkin)
    print(f"Status: {status}, Check-in realizado: {updated_checkin['check_in_realizado']}")
    visitantes_res = updated_checkin["visitantes"]
    print(f"Visitante 1 ingresado: {visitantes_res[0]['ingresado']}, Hora: {visitantes_res[0]['hora_ingreso']}")
    print(f"Visitante 2 ingresado: {visitantes_res[1]['ingresado']}")
    assert status == 200
    assert updated_checkin["check_in_realizado"] is True

    print("\n=== 5. TEST GET /accesos/{codigo} (Consulta Pública de Pase Digital con QR) ===")
    status, public_pase = request(f"{BASE_URL}/accesos/{codigo_acceso}")
    print(f"Status: {status}, Pase consultado: {public_pase['codigo_acceso']}")
    print(f"Estado público: {public_pase['estado']}")
    print(f"Lineamientos mostrados: {public_pase['lineamientos_ssoma']}")
    assert status == 200
    assert public_pase["codigo_acceso"] == codigo_acceso

    print("\n>>> ¡TODOS LOS TESTS DEL MÓDULO DE ACCESOS PASARON EXITOSAMENTE! <<<")

if __name__ == "__main__":
    run_tests()

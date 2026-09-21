import urllib.request
import urllib.parse
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"

def test_intervalo_mobiliario_flow():
    # 1. Obtener un ambiente y un área solicitante activos
    req_amb = urllib.request.Request(f"{BASE_URL}/ambientes")
    with urllib.request.urlopen(req_amb) as resp:
        ambientes = json.loads(resp.read().decode())
    assert len(ambientes) > 0, "No hay ambientes registrados"
    test_ambiente = ambientes[0]
    ambiente_id = test_ambiente["id"]
    print(f"Ambiente de prueba: {test_ambiente['nombre']} (ID: {ambiente_id})")

    req_areas = urllib.request.Request(f"{BASE_URL}/areas-solicitantes")
    with urllib.request.urlopen(req_areas) as resp:
        areas = json.loads(resp.read().decode())
    area_id = areas[0]["id"]

    # Definir fecha base para prueba: 15 de octubre de 2026
    # Evento Base A: 10:00 a 12:00
    base_date_str = "2026-10-15"
    evt_a_inicio = f"{base_date_str}T10:00:00"
    evt_a_fin = f"{base_date_str}T12:00:00"

    # 2. Registrar Evento Base A
    payload_a = json.dumps({
        "correo_solicitante": "docente.prueba@continental.edu.pe",
        "telefono": "999888777",
        "area_solicitante_id": area_id,
        "ambiente_id": ambiente_id,
        "fecha_inicio": evt_a_inicio,
        "fecha_fin": evt_a_fin,
        "detalles": "Evento Base A para prueba de intervalo de mobiliario",
        "recursos": []
    }).encode("utf-8")

    req_create_a = urllib.request.Request(
        f"{BASE_URL}/solicitudes",
        data=payload_a,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req_create_a) as resp:
            res_a = json.loads(resp.read().decode())
            print(f"1. Evento Base A creado: {res_a['codigo_ticket']} de 10:00 a 12:00")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode()
        print(f"Nota: Evento previo ya existía o error: {err_msg}")

    # 3. Test Endpoint de Verificación en Tiempo Real:
    # Caso 3.1: Solapamiento directo (11:00 a 13:00)
    params_directo = urllib.parse.urlencode({
        "fecha_inicio": f"{base_date_str}T11:00:00",
        "fecha_fin": f"{base_date_str}T13:00:00"
    })
    req_v1 = urllib.request.Request(f"{BASE_URL}/ambientes/{ambiente_id}/verificar-horario?{params_directo}")
    with urllib.request.urlopen(req_v1) as resp:
        v1 = json.loads(resp.read().decode())
        print("2. Verificación Solapamiento Directo:", v1)
        assert v1["disponible"] == False
        assert v1["tipo_conflicto"] == "SOLAPAMIENTO_DIRECTO"

    # Caso 3.2: Intervalo Posterior Insuficiente (12:30 a 14:00) -> Solo 30 min de margen (< 1h)
    params_gap_post = urllib.parse.urlencode({
        "fecha_inicio": f"{base_date_str}T12:30:00",
        "fecha_fin": f"{base_date_str}T14:00:00"
    })
    req_v2 = urllib.request.Request(f"{BASE_URL}/ambientes/{ambiente_id}/verificar-horario?{params_gap_post}")
    with urllib.request.urlopen(req_v2) as resp:
        v2 = json.loads(resp.read().decode())
        print("3. Verificación Intervalo Posterior (< 1h):", v2)
        assert v2["disponible"] == False
        assert v2["tipo_conflicto"] == "INTERVALO_POSTERIOR_INSUFICIENTE"
        assert "1 hora" in v2["mensaje"]
        assert "13:00" in v2["mensaje"] or v2["hora_sugerida"] == "13:00"

    # Caso 3.3: Intervalo Anterior Insuficiente (08:30 a 09:30) -> Solo 30 min antes de las 10:00 (< 1h)
    params_gap_ant = urllib.parse.urlencode({
        "fecha_inicio": f"{base_date_str}T08:30:00",
        "fecha_fin": f"{base_date_str}T09:30:00"
    })
    req_v3 = urllib.request.Request(f"{BASE_URL}/ambientes/{ambiente_id}/verificar-horario?{params_gap_ant}")
    with urllib.request.urlopen(req_v3) as resp:
        v3 = json.loads(resp.read().decode())
        print("4. Verificación Intervalo Anterior (< 1h):", v3)
        assert v3["disponible"] == False
        assert v3["tipo_conflicto"] == "INTERVALO_ANTERIOR_INSUFICIENTE"
        assert "1 hora" in v3["mensaje"]
        assert "09:00" in v3["mensaje"] or v3["hora_sugerida"] == "09:00"

    # Caso 3.4: Intervalo Válido posterior (13:00 a 15:00) -> Exactamente 1 hora después
    params_ok = urllib.parse.urlencode({
        "fecha_inicio": f"{base_date_str}T13:00:00",
        "fecha_fin": f"{base_date_str}T15:00:00"
    })
    req_v4 = urllib.request.Request(f"{BASE_URL}/ambientes/{ambiente_id}/verificar-horario?{params_ok}")
    with urllib.request.urlopen(req_v4) as resp:
        v4 = json.loads(resp.read().decode())
        print("5. Verificación Intervalo Válido (>= 1h):", v4)
        assert v4["disponible"] == True

    # 4. Probar Bloqueo en POST /solicitudes cuando hay violación de intervalo de 1 hora
    payload_violacion = json.dumps({
        "correo_solicitante": "docente2@continental.edu.pe",
        "telefono": "999111222",
        "area_solicitante_id": area_id,
        "ambiente_id": ambiente_id,
        "fecha_inicio": f"{base_date_str}T12:15:00",
        "fecha_fin": f"{base_date_str}T14:00:00",
        "detalles": "Intento con solo 15 min de intervalo",
        "recursos": []
    }).encode("utf-8")

    req_post_fail = urllib.request.Request(
        f"{BASE_URL}/solicitudes",
        data=payload_violacion,
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req_post_fail)
        print("ERROR: La solicitud con intervalo insuficiente debió ser rechazada!")
        assert False, "Debe rechazar con 400"
    except urllib.error.HTTPError as err:
        print(f"6. Rechazo esperado con HTTP {err.code}:")
        err_res = json.loads(err.read().decode())
        print("   Detalle retornado al usuario:", err_res.get("detail"))
        assert err.code == 400
        assert "1 hora" in err_res.get("detail", "")
        assert "mobiliario" in err_res.get("detail", "").lower()

    # 5. Probar Creación Exitosa respetando la hora de intervalo
    payload_exito = json.dumps({
        "correo_solicitante": "docente3@continental.edu.pe",
        "telefono": "999333444",
        "area_solicitante_id": area_id,
        "ambiente_id": ambiente_id,
        "fecha_inicio": f"{base_date_str}T13:00:00",
        "fecha_fin": f"{base_date_str}T15:00:00",
        "detalles": "Evento respetando intervalo logístico de 1 hora",
        "recursos": []
    }).encode("utf-8")

    req_post_ok = urllib.request.Request(
        f"{BASE_URL}/solicitudes",
        data=payload_exito,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_post_ok) as resp:
        res_ok = json.loads(resp.read().decode())
        print(f"7. Solicitud exitosa creada con intervalo reglamentario: {res_ok['codigo_ticket']}")
        assert res_ok["codigo_ticket"]

    print("\nTODAS LAS PRUEBAS DE INTERVALO DE 1 HORA PASARON SATISFACTORIAMENTE!")

if __name__ == "__main__":
    test_intervalo_mobiliario_flow()

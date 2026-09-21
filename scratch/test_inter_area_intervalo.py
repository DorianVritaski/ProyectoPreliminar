import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_inter_area_flow():
    # 1. Obtener al menos 2 ambientes distintos
    req_amb = urllib.request.Request(f"{BASE_URL}/ambientes")
    with urllib.request.urlopen(req_amb) as resp:
        ambientes = json.loads(resp.read().decode())
    assert len(ambientes) >= 2, "Se requieren al menos 2 ambientes para la prueba inter-área"
    
    punto_a = ambientes[0]
    punto_b = ambientes[1]
    print(f"Ambiente A: {punto_a['nombre']} (ID: {punto_a['id']})")
    print(f"Ambiente B: {punto_b['nombre']} (ID: {punto_b['id']})")

    req_areas = urllib.request.Request(f"{BASE_URL}/areas-solicitantes")
    with urllib.request.urlopen(req_areas) as resp:
        areas = json.loads(resp.read().decode())
    area_id = areas[0]["id"]

    # Fecha para la prueba: 20 de noviembre de 2026
    test_date = "2026-11-20"
    
    # 2. Registrar Evento en Punto A de 12:00 a 13:00
    payload_a = json.dumps({
        "correo_solicitante": "docente.a@continental.edu.pe",
        "telefono": "987654321",
        "area_solicitante_id": area_id,
        "ambiente_id": punto_a["id"],
        "fecha_inicio": f"{test_date}T12:00:00",
        "fecha_fin": f"{test_date}T13:00:00",
        "detalles": "Evento en Punto A de 12 pm a 1 pm",
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
            print(f"1. Evento creado en Punto A ({punto_a['nombre']}): {res_a['codigo_ticket']} de 12:00 a 13:00")
    except urllib.error.HTTPError as e:
        print("Nota evento previo ya existía:", e.read().decode())

    # 3. Caso del usuario: Evento en Punto B de 1:00 pm a 2:00 pm (0 min de margen tras el evento en Punto A)
    params_caso_usuario = urllib.parse.urlencode({
        "fecha_inicio": f"{test_date}T13:00:00",
        "fecha_fin": f"{test_date}T14:00:00"
    })
    req_v1 = urllib.request.Request(f"{BASE_URL}/ambientes/{punto_b['id']}/verificar-horario?{params_caso_usuario}")
    with urllib.request.urlopen(req_v1) as resp:
        v1 = json.loads(resp.read().decode())
        print("\n2. Caso usuario (Punto B de 13:00 a 14:00):", v1)
        assert v1["disponible"] == False, "Debió bloquearse por intervalo inter-área"
        assert v1["tipo_conflicto"] == "INTERVALO_INTER_AREA_POSTERIOR"
        assert v1["es_inter_area"] == True
        assert "inter-área" in v1["mensaje"].lower() or "inter-área" in v1["mensaje"]
        assert "14:00" in v1["mensaje"] or v1["hora_sugerida"] == "14:00"
        print("   -> Éxito: Detectó restricción inter-área posterior y sugiere iniciar a las 14:00")

    # 4. Caso inter-área posterior con 30 min de margen (13:30 a 14:30 en Punto B)
    params_gap_30 = urllib.parse.urlencode({
        "fecha_inicio": f"{test_date}T13:30:00",
        "fecha_fin": f"{test_date}T14:30:00"
    })
    req_v2 = urllib.request.Request(f"{BASE_URL}/ambientes/{punto_b['id']}/verificar-horario?{params_gap_30}")
    with urllib.request.urlopen(req_v2) as resp:
        v2 = json.loads(resp.read().decode())
        print("\n3. Caso Punto B de 13:30 a 14:30 (30 min < 1h):", v2)
        assert v2["disponible"] == False
        assert v2["tipo_conflicto"] == "INTERVALO_INTER_AREA_POSTERIOR"

    # 5. Caso inter-área válido (Punto B a partir de las 14:00 -> 1 hora completa de traslado)
    params_gap_60 = urllib.parse.urlencode({
        "fecha_inicio": f"{test_date}T14:00:00",
        "fecha_fin": f"{test_date}T15:00:00"
    })
    req_v3 = urllib.request.Request(f"{BASE_URL}/ambientes/{punto_b['id']}/verificar-horario?{params_gap_60}")
    with urllib.request.urlopen(req_v3) as resp:
        v3 = json.loads(resp.read().decode())
        print("\n4. Caso Punto B de 14:00 a 15:00 (1 hora exacta tras Punto A):", v3)
        assert v3["disponible"] == True, "Debió permitir horario con 1 hora de margen"

    # 6. Caso inter-área anterior insuficiente (Punto B de 10:30 a 11:30 -> solo 30 min antes de las 12:00 en Punto A)
    params_ant_30 = urllib.parse.urlencode({
        "fecha_inicio": f"{test_date}T10:30:00",
        "fecha_fin": f"{test_date}T11:30:00"
    })
    req_v4 = urllib.request.Request(f"{BASE_URL}/ambientes/{punto_b['id']}/verificar-horario?{params_ant_30}")
    with urllib.request.urlopen(req_v4) as resp:
        v4 = json.loads(resp.read().decode())
        print("\n5. Caso Punto B de 10:30 a 11:30 (anterior < 1h):", v4)
        assert v4["disponible"] == False
        assert v4["tipo_conflicto"] == "INTERVALO_INTER_AREA_ANTERIOR"
        assert "11:00" in v4["mensaje"] or v4["hora_sugerida"] == "11:00"

    # 7. Caso simultáneo en diferentes ambientes (Punto B a la misma hora 12:00 a 13:00)
    params_simultaneo = urllib.parse.urlencode({
        "fecha_inicio": f"{test_date}T12:00:00",
        "fecha_fin": f"{test_date}T13:00:00"
    })
    req_v5 = urllib.request.Request(f"{BASE_URL}/ambientes/{punto_b['id']}/verificar-horario?{params_simultaneo}")
    with urllib.request.urlopen(req_v5) as resp:
        v5 = json.loads(resp.read().decode())
        print("\n6. Caso eventos simultáneos en Punto B (12:00 a 13:00):", v5)
        assert v5["disponible"] == True, "Eventos simultáneos en diferentes áreas deben permitirse si stock lo permite"

    # 8. Mismo ambiente simultáneo (Punto A de 12:00 a 13:00) -> Debe bloquearse por solapamiento directo
    req_v6 = urllib.request.Request(f"{BASE_URL}/ambientes/{punto_a['id']}/verificar-horario?{params_simultaneo}")
    with urllib.request.urlopen(req_v6) as resp:
        v6 = json.loads(resp.read().decode())
        print("\n7. Caso mismo ambiente simultáneo (Punto A de 12:00 a 13:00):", v6)
        assert v6["disponible"] == False
        assert v6["tipo_conflicto"] == "SOLAPAMIENTO_DIRECTO"

    # 9. Verificación de rechazo HTTP 400 en POST /solicitudes para el caso del usuario (Punto B a las 13:00)
    payload_b_invalido = json.dumps({
        "correo_solicitante": "docente.b@continental.edu.pe",
        "telefono": "987654321",
        "area_solicitante_id": area_id,
        "ambiente_id": punto_b["id"],
        "fecha_inicio": f"{test_date}T13:00:00",
        "fecha_fin": f"{test_date}T14:00:00",
        "detalles": "Intento de registro en Punto B a la 1 pm",
        "recursos": []
    }).encode("utf-8")
    req_post_b = urllib.request.Request(
        f"{BASE_URL}/solicitudes",
        data=payload_b_invalido,
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req_post_b)
        assert False, "POST /solicitudes debió fallar con 400"
    except urllib.error.HTTPError as err:
        print(f"\n8. POST /solicitudes rechazado correctamente con HTTP {err.code}:")
        err_res = json.loads(err.read().decode())
        print("   Detalle retornado:", err_res.get("detail"))
        assert err.code == 400
        assert "inter-área" in err_res.get("detail", "").lower() or "inter-área" in err_res.get("detail", "")

    # 10. POST /solicitudes exitoso en Punto B con 1 hora de margen (14:00 a 15:00)
    payload_b_valido = json.dumps({
        "correo_solicitante": "docente.b@continental.edu.pe",
        "telefono": "987654321",
        "area_solicitante_id": area_id,
        "ambiente_id": punto_b["id"],
        "fecha_inicio": f"{test_date}T14:00:00",
        "fecha_fin": f"{test_date}T15:00:00",
        "detalles": "Registro en Punto B a las 2 pm (respetando 1 hora de margen)",
        "recursos": []
    }).encode("utf-8")
    req_post_b_ok = urllib.request.Request(
        f"{BASE_URL}/solicitudes",
        data=payload_b_valido,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_post_b_ok) as resp:
        res_b_ok = json.loads(resp.read().decode())
        print(f"\n9. Solicitud exitosa creada en Punto B a las 14:00: {res_b_ok['codigo_ticket']}")
        assert res_b_ok["codigo_ticket"]

    print("\nTODAS LAS PRUEBAS DE INTERVALO LOGÍSTICO INTER-ÁREA PASARON SATISFACTORIAMENTE!")

if __name__ == "__main__":
    test_inter_area_flow()

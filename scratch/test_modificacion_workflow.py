import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000/api/v1"

def request_json(url, method="GET", data=None):
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.getcode(), json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"error": err_body}

def main():
    print("=== TEST WORKFLOW: GESTIÓN DE MODIFICACIONES Y REPROGRAMACIONES ASÍNCRONAS ===")

    # 1. Crear solicitud inicial
    payload_crear = {
        "correo_solicitante": "test.docente@continental.edu.pe",
        "telefono": "987654321",
        "area_solicitante_id": 1,
        "ambiente_id": 1,
        "fecha_inicio": "2027-01-25T09:00:00",
        "fecha_fin": "2027-01-25T12:00:00",
        "horarios": [
            {"fecha_inicio": "2027-01-25T09:00:00", "fecha_fin": "2027-01-25T12:00:00"}
        ],
        "detalles": "Conferencia magistral inicial",
        "protocolo_ssoma": False,
        "requiere_ssoma": False,
        "recursos": [{"recurso_id": 1, "cantidad": 5}]
    }

    code, resp_crear = request_json(f"{BASE_URL}/solicitudes", method="POST", data=payload_crear)
    print(f"1. Crear Solicitud: Status {code}")
    assert code in (200, 201), f"Error creando solicitud: {resp_crear}"
    ticket = resp_crear["codigo_ticket"]
    pin = resp_crear.get("pin_seguridad")
    print(f"   Ticket: {ticket} | PIN generado: {pin} | Estado: {resp_crear['estado']}")
    assert pin is not None and len(pin) == 4, f"PIN inválido: {pin}"

    # 2. Consultar seguimiento
    code, resp_seg = request_json(f"{BASE_URL}/solicitudes/seguimiento?search={ticket}")
    print(f"2. Seguimiento Solicitud: Status {code}, Items: {len(resp_seg)}")
    assert code == 200 and len(resp_seg) > 0
    sol = resp_seg[0]
    assert sol["pin_seguridad"] == pin
    assert sol["edicion_solicitada"] is False

    # 3. Intentar modificar con PIN erróneo y correo erróneo -> debe fallar con 403
    payload_bad_auth = {
        "motivo_modificacion": "Ajuste de prueba",
        "pin_seguridad": "9999",
        "correo_solicitante": "otro@continental.edu.pe",
        "ambiente_id": 1,
        "fecha_inicio": "2027-01-25T10:00:00",
        "fecha_fin": "2027-01-25T13:00:00",
        "horarios": [{"fecha_inicio": "2027-01-25T10:00:00", "fecha_fin": "2027-01-25T13:00:00"}],
        "recursos": []
    }
    code, resp_bad = request_json(f"{BASE_URL}/solicitudes/{ticket}/modificar", method="POST", data=payload_bad_auth)
    print(f"3. Intento con PIN y correo incorrectos: Status {code} (esperado 403)")
    assert code == 403, f"Se esperaba 403, obtenido {code}"

    # 4. Modificar exitosamente usando PIN correcto
    payload_mod = {
        "motivo_modificacion": "Reprogramacion por cruce de vuelos del expositor",
        "pin_seguridad": pin,
        "correo_solicitante": "",
        "ambiente_id": 1,
        "fecha_inicio": "2027-01-25T14:00:00",
        "fecha_fin": "2027-01-25T17:00:00",
        "horarios": [
            {"fecha_inicio": "2027-01-25T14:00:00", "fecha_fin": "2027-01-25T17:00:00"}
        ],
        "detalles": "Horario vespertino actualizado",
        "recursos": [{"recurso_id": 1, "cantidad": 8}],
        "requiere_ssoma": False
    }
    code, resp_mod = request_json(f"{BASE_URL}/solicitudes/{ticket}/modificar", method="POST", data=payload_mod)
    print(f"4. Modificación con PIN: Status {code}")
    print(f"   resp_mod estado: {resp_mod.get('estado')!r}")
    print(f"   resp_mod edicion_solicitada: {resp_mod.get('edicion_solicitada')!r}")
    print(f"   resp_mod motivo_modificacion: {resp_mod.get('motivo_modificacion')!r}")
    print(f"   resp_mod fecha_inicio: {resp_mod.get('fecha_inicio')!r}")
    assert code == 200, f"Error modificando: {resp_mod}"
    assert resp_mod["estado"] == "EN REVISIÓN POR MODIFICACIÓN"
    assert resp_mod["edicion_solicitada"] is True
    assert resp_mod["motivo_modificacion"] == "Reprogramacion por cruce de vuelos del expositor"
    assert resp_mod["fecha_inicio"] == "2027-01-25T14:00:00"
    print("   ✓ Solicitud actualizada a 'EN REVISIÓN POR MODIFICACIÓN' y horarios actualizados.")

    # 5. Verificar que el filtro del panel admin muestre la solicitud
    code, resp_admin = request_json(f"{BASE_URL}/admin/solicitudes?estado=MODIFICACION")
    print(f"5. Admin Filter 'MODIFICACION': Status {code}, Items: {len(resp_admin)}")
    assert code == 200
    matched = [s for s in resp_admin if s["codigo_ticket"] == ticket]
    assert len(matched) == 1, "No se encontró la solicitud en el filtro MODIFICACION"
    print("   ✓ Solicitud visible bajo filtro administrativo de modificaciones.")

    # 6. Jefatura aprueba la modificación
    sol_id = resp_mod["id"]
    code, resp_appr = request_json(f"{BASE_URL}/admin/solicitudes/{sol_id}/estado", method="PATCH", data={"estado": "APROBADO"})
    print(f"6. Aprobación por Jefatura: Status {code}")
    assert code == 200
    assert resp_appr["estado"] == "APROBADO"
    assert resp_appr["edicion_solicitada"] is False
    print("   ✓ Aprobación completada y flag edicion_solicitada limpiado.")

    # 7. Solicitud aprobada pide nueva modificación
    payload_mod2 = {
        "motivo_modificacion": "Añadir sillas y proyector de TI de última hora",
        "pin_seguridad": "",
        "correo_solicitante": "test.docente@continental.edu.pe", # Autenticación con correo
        "ambiente_id": 1,
        "fecha_inicio": "2027-01-25T14:00:00",
        "fecha_fin": "2027-01-25T17:00:00",
        "horarios": [
            {"fecha_inicio": "2027-01-25T14:00:00", "fecha_fin": "2027-01-25T17:00:00"}
        ],
        "recursos": [{"recurso_id": 1, "cantidad": 12}],
        "requiere_ssoma": False
    }
    code, resp_mod2 = request_json(f"{BASE_URL}/solicitudes/{ticket}/modificar", method="POST", data=payload_mod2)
    print(f"7. Modificación autenticada con Correo sobre ticket APROBADO: Status {code}")
    assert code == 200
    assert resp_mod2["estado"] == "EN REVISIÓN POR MODIFICACIÓN"
    assert resp_mod2["edicion_solicitada"] is True
    print("   ✓ Solicitud aprobada pasó a 'EN REVISIÓN POR MODIFICACIÓN' exitosamente sin conflicto de horario consigo misma.")

    # 8. Jefatura rechaza la solicitud
    code, resp_rech = request_json(f"{BASE_URL}/admin/solicitudes/{sol_id}/estado", method="PATCH", data={
        "estado": "RECHAZADO",
        "motivo_rechazo": "Falta adjuntar formato de autorización de decanatura"
    })
    print(f"8. Rechazo por Jefatura: Status {code}")
    assert code == 200
    assert resp_rech["estado"] == "RECHAZADO"

    # 9. Solicitante subsana y reapertura trámite (misma solicitud)
    payload_reapertura = {
        "motivo_modificacion": "Se adjunta autorización de decanatura y se corrigen detalles",
        "pin_seguridad": pin,
        "ambiente_id": 1,
        "fecha_inicio": "2027-01-25T14:00:00",
        "fecha_fin": "2027-01-25T17:00:00",
        "horarios": [
            {"fecha_inicio": "2027-01-25T14:00:00", "fecha_fin": "2027-01-25T17:00:00"}
        ],
        "detalles": "Subsanado con decanatura",
        "recursos": [{"recurso_id": 1, "cantidad": 12}],
        "requiere_ssoma": False
    }
    code, resp_reap = request_json(f"{BASE_URL}/solicitudes/{ticket}/modificar", method="POST", data=payload_reapertura)
    print(f"9. Reapertura de trámite rechazado con corrección: Status {code}")
    if code != 200:
        print(f"   Error detail: {resp_reap}")
    assert code == 200, f"Error reabriendo: {resp_reap}"
    assert resp_reap["estado"] == "EN REVISIÓN POR MODIFICACIÓN"
    assert resp_reap["motivo_rechazo"] is None
    print("   ✓ Trámite rechazado reabierto exitosamente conservando el mismo ticket.")

    print("\n🎉 ¡TODAS LAS PRUEBAS DEL FLUJO DE MODIFICACIONES Y REPROGRAMACIONES ASÍNCRONAS PASARON SATISFACTORIAMENTE!")

if __name__ == "__main__":
    main()

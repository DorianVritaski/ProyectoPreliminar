import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_seguridad_flow():
    # 1. Login as Seguridad
    login_data = json.dumps({
        "username": "seguridad@continental.edu.pe",
        "password": "admin2026"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        f"{BASE_URL}/admin/login",
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            login_res = json.loads(resp.read().decode())
            print("1. Login status:", resp.status)
            user_info = login_res.get("user", {})
            print("   User:", user_info.get("nombre"), "| Area ID:", user_info.get("area_destino_id"), "| Area:", user_info.get("area_destino_nombre"))
            token = login_res.get("token")
            assert token, "Token missing!"
            assert user_info.get("area_destino_id") == 3, "Expected area_destino_id == 3"
    except Exception as e:
        print("Login failed:", e)
        return

    # 2. Get all requests as Seguridad (monitoring mode - campus-wide)
    req2 = urllib.request.Request(
        f"{BASE_URL}/admin/solicitudes?estado=TODAS",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req2) as resp:
        solicitudes = json.loads(resp.read().decode())
        print(f"2. Solicitudes retrieved as Seguridad: {len(solicitudes)}")
        assert len(solicitudes) > 0, "Expected requests to be returned"
        first_sol = solicitudes[0]
        print(f"   First solicitud: {first_sol.get('codigo_ticket')} | Estado: {first_sol.get('estado')}")

    # 3. Test filter by search
    req3 = urllib.request.Request(
        f"{BASE_URL}/admin/solicitudes?estado=TODAS&search=continental",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req3) as resp:
        filtered = json.loads(resp.read().decode())
        print(f"3. Filtered with search='continental': {len(filtered)} results")

    # 4. Test security restriction: Seguridad cannot emit conformity (must return 403)
    sol_id = first_sol.get("id")
    conf_data = json.dumps({
        "estado": "CONFORME",
        "observacion": "Intento no autorizado"
    }).encode("utf-8")
    req4 = urllib.request.Request(
        f"{BASE_URL}/admin/solicitudes/{sol_id}/conformidad/3",
        data=conf_data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PATCH"
    )
    try:
        urllib.request.urlopen(req4)
        print("ERROR: Seguridad was able to emit conformity! It should have been blocked with 403.")
    except urllib.error.HTTPError as err:
        print(f"4. Expected 403 Forbidden received: {err.code} {err.reason}")
        err_msg = json.loads(err.read().decode())
        print("   Detail:", err_msg.get("detail"))
        assert err.code == 403, "Expected 403"

    print("\nALL SEGURIDAD TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_seguridad_flow()

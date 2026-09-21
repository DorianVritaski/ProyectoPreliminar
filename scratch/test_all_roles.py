import urllib.request
import json

BASE = "http://localhost:8000/api/v1"
creds = [
    ("operaciones@continental.edu.pe", "admin2026", "Jefatura de Operaciones"),
    ("coordinador.ti@continental.edu.pe", "admin2026", "TI"),
    ("ssoma@continental.edu.pe", "admin2026", "SSOMA"),
    ("seguridad@continental.edu.pe", "admin2026", "Seguridad Interna y Vigilancia")
]

for email, pwd, expected_name in creds:
    data = json.dumps({"username": email, "password": pwd}).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/admin/login", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        u = res.get("user", {})
        print(f"OK: {email} -> {u.get('nombre')} | Area ID: {u.get('area_destino_id')} ({u.get('area_destino_nombre')})")

print("All 4 admin roles authenticated perfectly!")

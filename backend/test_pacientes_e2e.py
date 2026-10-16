import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def run_e2e():
    print("=== TEST E2E: SUB-MODULO PACIENTES CLINICOS ===")
    
    # 1. Crear nuevo paciente clínico
    payload = {
        "escuela_profesional": "ODONTOLOGIA",
        "estudiante_correo": "74819203@continental.edu.pe",
        "estudiante_nombre": "Fiorella Huaman Quispe",
        "estudiante_dni": "74819203",
        "estudiante_telefono": "954123987",
        "paciente_nombre": "Mateo Gomez Sanchez",
        "paciente_dni": "78912345",
        "paciente_telefono": "987654321",
        "es_menor_edad": True,
        "apoderado_nombre": "Elena Sanchez Ramos",
        "apoderado_dni": "10492837",
        "asignatura": "Odontopediatría I",
        "nrc": "15920",
        "docente_nombre": "Dr. Fernando Castro",
        "fecha_atencion": "2026-10-16",
        "horario_inicio": "08:30",
        "horario_fin": "10:30",
        "url_consentimiento_pdf": "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing",
        "declaracion_aceptada": True
    }
    
    req = urllib.request.Request(
        f"{BASE_URL}/pacientes",
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201, f"Expected 201, got {resp.status}"
        data = json.loads(resp.read().decode('utf-8'))
        pac_id = data["id"]
        codigo = data["codigo_ticket"]
        print(f"1. Paciente creado exitosamente: ID={pac_id}, Ticket={codigo}, Estado={data['estado']}")
        assert codigo.startswith("PAC-2026-")
        assert data["es_menor_edad"] is True
        assert data["apoderado_nombre"] == "Elena Sanchez Ramos"
        assert data["ingresado_garita"] is False

    # 2. Consultar por ticket
    req_get = urllib.request.Request(f"{BASE_URL}/pacientes/{codigo}")
    with urllib.request.urlopen(req_get) as resp:
        assert resp.status == 200
        get_data = json.loads(resp.read().decode('utf-8'))
        print(f"2. Consulta por ticket exitosa: Paciente={get_data['paciente_nombre']}, Escuela={get_data['escuela_profesional']}")
        assert get_data["id"] == pac_id

    # 3. Check-in en Garita de Vigilancia
    req_checkin = urllib.request.Request(
        f"{BASE_URL}/pacientes/{pac_id}/check-in",
        data=json.dumps({"ingresado": True}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req_checkin) as resp:
        assert resp.status == 200
        checkin_data = json.loads(resp.read().decode('utf-8'))
        print(f"3. Check-in de Vigilancia exitoso: ingresado_garita={checkin_data['ingresado_garita']}, hora={checkin_data['fecha_ingreso_real']}")
        assert checkin_data["ingresado_garita"] is True
        assert checkin_data["fecha_ingreso_real"] is not None

    # 4. Revisión SSOMA (Otorgar conformidad)
    req_ssoma = urllib.request.Request(
        f"{BASE_URL}/pacientes/{pac_id}/ssoma",
        data=json.dumps({
            "estado": "CONFORME",
            "observaciones_ssoma": "Consentimiento informado y DNI de apoderada validados conforme."
        }).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    with urllib.request.urlopen(req_ssoma) as resp:
        assert resp.status == 200
        ssoma_data = json.loads(resp.read().decode('utf-8'))
        print(f"4. SSOMA actualizado: estado={ssoma_data['estado']}, obs={ssoma_data['observaciones_ssoma']}")
        assert ssoma_data["estado"] == "CONFORME"

    # 5. Listado con filtros
    req_list = urllib.request.Request(f"{BASE_URL}/pacientes?escuela_profesional=ODONTOLOGIA")
    with urllib.request.urlopen(req_list) as resp:
        assert resp.status == 200
        list_data = json.loads(resp.read().decode('utf-8'))
        print(f"5. Listado por escuela ODONTOLOGIA: {len(list_data)} pacientes encontrados.")
        assert len(list_data) >= 2

    print("=== TODOS LOS TESTS E2E PASARON CON EXITO ===")

if __name__ == "__main__":
    run_e2e()

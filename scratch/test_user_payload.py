import urllib.request
import json

url = "http://localhost:8000/api/v1/accesos"
payload = {
    "anfitrion_correo": "jcastromu@continental.edu.pe",
    "anfitrion_nombre": "Jhonny Paul Castro Mucha",
    "anfitrion_area": "Dirección de Estudios Generales de Humanidades",
    "sede": "Campus Huancayo",
    "ubicacion_especifica": "Pabellón C 503 8:pm",
    "motivo": "Charla de Liderazgo a los estudiantes del NRC 48599 de la asignatura de Laboratorio de LIderazgo e Innovación Avanzado en el aula C503 a horas 8:00 p. m.",
    "fecha_inicio": "2026-11-18T13:00:00Z",
    "fecha_fin": "2026-11-18T14:00:00Z",
    "detalles": "Ninguno",
    "requiere_ssoma_riesgo": False,
    "url_sctr_pdf": None,
    "url_lista_personal_pdf": None,
    "visitantes": [
        {"id": 1, "nombre": "Angie Adriana Machuca Ledesma", "dni": "75330961", "empresa": "clínica Bienestar Integral"}
    ]
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
req.get_method = lambda: "POST"

try:
    with urllib.request.urlopen(req) as resp:
        print("Status code:", resp.getcode())
        print("Response:", resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Error body:", e.read().decode("utf-8"))

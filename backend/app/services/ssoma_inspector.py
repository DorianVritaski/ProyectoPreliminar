import re
import io
import requests
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import pdfplumber
import pandas as pd
from pypdf import PdfReader

# Headers de navegador moderno para evitar bloqueos
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

DICCIONARIO_RIESGOS = {
    "Trabajo en Altura (Escaleras/Andamios)": [
        "altura", "andamio", "escalera", "arnes", "arnés", "fachada", "elevacion", "elevación", "caidas", "caídas", "línea de vida", "linea de vida"
    ],
    "Riesgo Eléctrico / Sonido": [
        "electrico", "eléctrico", "tablero", "cableado", "sonido", "iluminacion", "iluminación", "potencia", "luces", "amplificador", "generador", "voltaje", "transformador"
    ],
    "Montaje y Carga Pesada": [
        "montaje", "escenario", "vallas", "estructuras", "desmontaje", "mobiliario", "carga", "toldos", "fierros", "metalica", "metálica", "rigging", "truss", "estrado"
    ],
    "Trabajos en Caliente / Soldadura": [
        "caliente", "soldadura", "esmeril", "corte", "fuego", "chispas", "oxiacetileno"
    ],
    "Catering y Alimentos": [
        "catering", "comida", "alimentos", "buffet", "mozos", "vajilla", "cocina", "gas", "glp", "manipulacion de alimentos"
    ]
}


def extraer_id_drive(url_drive: str) -> Optional[str]:
    """Extrae el ID del archivo desde cualquier formato de URL pública de Google Drive."""
    if not url_drive:
        return None
    url = url_drive.strip()
    patron = r'(?:/d/|id=)([a-zA-Z0-9_-]{15,})'
    coincidencia = re.search(patron, url)
    if coincidencia:
        return coincidencia.group(1)
    return None


def descargar_contenido_drive(url_drive: str) -> Tuple[bytes, str]:
    """
    Descarga el archivo a memoria y detecta automáticamente si es PDF, Excel o Google Sheet.
    Soporta enlaces de Google Drive, Google Sheets, Google Docs y URLs directas.
    """
    url = url_drive.strip()
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    file_id = extraer_id_drive(url)

    # 1. Caso Google Sheets (Spreadsheet)
    if "google.com/spreadsheets" in url and file_id:
        url_descarga = f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx"
        resp = session.get(url_descarga, timeout=25)
        if resp.status_code == 200 and not resp.text.startswith("<!doctype html>"):
            return resp.content, "excel"
        # Si falló, intentar descarga estándar

    # 2. Caso Google Docs (Documento de texto exportable a PDF)
    if "docs.google.com/document" in url and file_id:
        url_descarga = f"https://docs.google.com/document/d/{file_id}/export?format=pdf"
        resp = session.get(url_descarga, timeout=25)
        if resp.status_code == 200 and resp.content.startswith(b"%PDF"):
            return resp.content, "pdf"

    # 3. Caso Google Drive estándar (PDF, XLSX u otro binario)
    if file_id:
        # Primer intento: endpoint de exportación
        url_descarga = f"https://drive.google.com/uc?export=download&id={file_id}"
        resp = session.get(url_descarga, stream=True, timeout=25)

        # Confirmación para advertencias de antivirus de Google (archivos grandes)
        for key, value in resp.cookies.items():
            if key.startswith("download_warning"):
                url_descarga = f"{url_descarga}&confirm={value}"
                resp = session.get(url_descarga, stream=True, timeout=25)
                break

        # Si devolvió HTML de confirmación o de inicio de sesión
        if resp.status_code == 200:
            content = resp.content
            if content.startswith(b"%PDF"):
                return content, "pdf"
            if content.startswith(b"PK\x03\x04"):
                return content, "excel"

            # Revisar si hay un token de confirmación en el HTML
            confirm_match = re.search(r'confirm=([0-9A-Za-z_-]+)', resp.text)
            if confirm_match:
                token = confirm_match.group(1)
                resp2 = session.get(f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm={token}", timeout=25)
                if resp2.status_code == 200:
                    if resp2.content.startswith(b"%PDF"):
                        return resp2.content, "pdf"
                    if resp2.content.startswith(b"PK\x03\x04"):
                        return resp2.content, "excel"
                    content = resp2.content

            # Intentar fallback con drive.usercontent directo
            resp_uc = session.get(f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t", timeout=25)
            if resp_uc.status_code == 200:
                if resp_uc.content.startswith(b"%PDF"):
                    return resp_uc.content, "pdf"
                if resp_uc.content.startswith(b"PK\x03\x04"):
                    return resp_uc.content, "excel"

            # Si es HTML con pantalla de Sign-In de Google
            if b"accounts.google.com" in content or b"ServiceLogin" in content or b"<!doctype html>" in content[:100].lower():
                raise ValueError(
                    "El archivo de Google Drive requiere inicio de sesión. "
                    "Por favor configure los permisos en Google Drive como 'Cualquier persona con el enlace' (Lector) "
                    "para que el sistema pueda inspeccionarlo automáticamente."
                )

            return content, "desconocido"
        else:
            raise ValueError(f"No se pudo descargar de Google Drive (Código HTTP {resp.status_code}). Verifique que el enlace sea público.")

    # 4. Caso URL directa no-Drive (ej. almacenamiento interno o directo)
    try:
        resp = session.get(url, timeout=25)
        if resp.status_code == 200:
            content = resp.content
            if content.startswith(b"%PDF"):
                return content, "pdf"
            if content.startswith(b"PK\x03\x04"):
                return content, "excel"
            return content, "desconocido"
        raise ValueError(f"Error al descargar URL externa (HTTP {resp.status_code}).")
    except Exception as e:
        raise ValueError(f"No se pudo acceder al enlace del documento: {str(e)}")


def extraer_texto_de_excel(contenido_bytes: bytes) -> str:
    """Extrae todo el contenido tabular de todas las pestañas de un libro de Excel."""
    texto_total = ""
    try:
        excel_file = pd.read_excel(io.BytesIO(contenido_bytes), sheet_name=None, dtype=str)
        for nombre_hoja, df in excel_file.items():
            texto_total += f"\n--- HOJA EXCEL: {nombre_hoja} ---\n"
            df_limpio = df.fillna("")
            texto_total += df_limpio.to_string(index=False, header=True) + "\n"
        return texto_total
    except Exception as e:
        raise ValueError(f"Error al procesar archivo Excel: {str(e)}")


def extraer_texto_de_pdf(contenido_bytes: bytes) -> str:
    """Extrae texto de un archivo PDF usando pdfplumber con fallback a pypdf."""
    texto_total = ""
    try:
        with pdfplumber.open(io.BytesIO(contenido_bytes)) as pdf:
            for num_pagina, pagina in enumerate(pdf.pages[:15]):  # Lee hasta 15 páginas
                txt = pagina.extract_text()
                if txt:
                    texto_total += f"\n--- PÁGINA {num_pagina + 1} ---\n" + txt
    except Exception:
        # Fallback a pypdf
        try:
            reader = PdfReader(io.BytesIO(contenido_bytes))
            for num_pagina, pagina in enumerate(reader.pages[:15]):
                txt = pagina.extract_text()
                if txt:
                    texto_total += f"\n--- PÁGINA {num_pagina + 1} ---\n" + txt
        except Exception as e:
            raise ValueError(f"Error al extraer texto del PDF: {str(e)}")

    return texto_total


def verificar_coincidencia_trabajo(descripcion_trabajo: str, riesgos_detectados: List[str], texto_documento: str) -> Dict[str, Any]:
    """
    Evalúa si las actividades de riesgo detectadas en la póliza/documento coinciden
    con el trabajo, montaje o servicio que se realizará.
    """
    desc_lower = (descripcion_trabajo or "").lower()
    doc_lower = (texto_documento or "").lower()

    # Extraer palabras clave de la descripción del trabajo
    riesgos_mencionados_en_trabajo = [
        riesgo for riesgo, palabras in DICCIONARIO_RIESGOS.items()
        if any(p in desc_lower for p in palabras)
    ]

    coincidencias = []
    alertas = []

    for r in riesgos_detectados:
        if r in riesgos_mencionados_en_trabajo:
            coincidencias.append(r)
        elif r != "Trabajo Estándar / Sin Riesgo Crítico Detectado":
            alertas.append(f"El documento cubre '{r}', aunque no fue detallado expresamente en la solicitud.")

    for r in riesgos_mencionados_en_trabajo:
        if r not in riesgos_detectados:
            alertas.append(f"Se declaró '{r}' en la solicitud, pero no figura expresamente en el documento analizado.")

    # Calcular nivel de concordancia
    if not riesgos_mencionados_en_trabajo and (not riesgos_detectados or "Trabajo Estándar / Sin Riesgo Crítico Detectado" in riesgos_detectados):
        nivel = "ALTA"
        detalle = "Trabajo estándar sin actividades de alto riesgo. El documento respalda adecuadamente la labor."
    elif coincidencias and not alertas:
        nivel = "ALTA"
        detalle = f"Cobertura excelente: las actividades de la solicitud ({', '.join(coincidencias)}) coinciden plenamente con el documento."
    elif coincidencias and alertas:
        nivel = "MODERADA"
        detalle = f"Cobertura parcial. Coincidencias: {', '.join(coincidencias)}. Observaciones: {'; '.join(alertas[:2])}."
    elif alertas:
        nivel = "REVISION_SUGERIDA"
        detalle = f"Atención SSOMA: {'; '.join(alertas[:3])}."
    else:
        nivel = "MODERADA"
        detalle = "No se detectaron discrepancias críticas entre el trabajo y la documentación."

    return {
        "coincide": nivel in ["ALTA", "MODERADA"],
        "nivel": nivel,
        "detalle": detalle,
        "riesgos_mencionados_en_trabajo": riesgos_mencionados_en_trabajo,
        "coincidencias": coincidencias,
        "alertas": alertas
    }


def extraer_personal_de_documento(texto_completo: str) -> List[Dict[str, str]]:
    """Extrae todos los pares de DNI (8 dígitos) y posibles Nombres hallados en el texto."""
    personal_detectado = []
    dnis_vistos = set()
    lineas = texto_completo.split("\n")

    for linea in lineas:
        dnis_en_linea = re.findall(r'\b\d{8}\b', linea)
        for dni in dnis_en_linea:
            # Filtrar si parece un año o número no-DNI común
            if dni.startswith("2026") or dni.startswith("2025") or dni.startswith("2024") or dni in dnis_vistos:
                continue
            dnis_vistos.add(dni)

            # Limpiar la línea para aislar el nombre del trabajador
            linea_sin_dni = re.sub(r'\b\d{8}\b', '', linea)
            linea_limpia = re.sub(r'[^A-Za-zÁÉÍÓÚáéíóúñÑ\s]', '', linea_sin_dni)
            palabras = [p for p in linea_limpia.split() if len(p) > 2 and p.upper() not in ["SCTR", "SALUD", "PENSION", "PENSIONES", "POLIZA", "ASEGURADO", "TRABAJADOR", "DNI"]]
            nombre = " ".join(palabras[:4]) if palabras else "Personal Asegurado"
            personal_detectado.append({"dni": dni, "nombre": nombre})

    return personal_detectado


def analizar_documento_ssoma(
    url_drive: str,
    fecha_evento_str: Optional[str] = None,
    dnis_esperados: Optional[List[str]] = None,
    descripcion_trabajo: str = ""
) -> Dict[str, Any]:
    """
    Analiza un documento de Google Drive (PDF, Excel o Google Sheets), extrayendo:
    - Formato de archivo
    - Razón Social / Empresa
    - RUC
    - Rango de Fechas y Vigencia contra la fecha del evento
    - Clasificación de Trabajos de Riesgo
    - Coincidencia con el trabajo que se hará
    - Cruce de nómina con DNIs esperados
    - Dictamen estructurado listo para SSOMA
    """
    if not url_drive or not url_drive.strip():
        raise ValueError("Se requiere una URL válida de Google Drive para la inspección.")

    dnis_esperados = [str(d).strip() for d in (dnis_esperados or []) if str(d).strip()]

    # 1. Descarga y detección de formato
    contenido_bytes, tipo_formato = descargar_contenido_drive(url_drive)

    # 2. Extracción de Texto
    if tipo_formato == "pdf":
        texto_completo = extraer_texto_de_pdf(contenido_bytes)
    elif tipo_formato == "excel":
        texto_completo = extraer_texto_de_excel(contenido_bytes)
    else:
        # Intento de lectura fallback
        try:
            texto_completo = extraer_texto_de_pdf(contenido_bytes)
            tipo_formato = "pdf"
        except Exception:
            texto_completo = extraer_texto_de_excel(contenido_bytes)
            tipo_formato = "excel"

    if not texto_completo.strip():
        raise ValueError("El documento descargado está vacío o no contiene texto legible (posible escaneo como imagen pura sin OCR).")

    # 3. Razón Social y RUC
    patron_empresa = r'([A-Z0-9\s\.\&\-]{3,}(?:S\.A\.C\.|S\.A\.|E\.I\.R\.L\.|S\.R\.L\.|S\.C\.R\.L\.))'
    empresas_halladas = re.findall(patron_empresa, texto_completo)
    empresa_detectada = empresas_halladas[0].strip() if empresas_halladas else "No detectada expresamente"

    patron_ruc = r'\b(10\d{9}|20\d{9})\b'
    rucs_hallados = re.findall(patron_ruc, texto_completo)
    ruc_detectado = rucs_hallados[0] if rucs_hallados else None

    # 4. Fechas de Vigencia
    patron_fechas = r'\b(\d{2}[/-]\d{2}[/-]\d{4})\b'
    fechas_raw = re.findall(patron_fechas, texto_completo)
    fechas_limpias = list(set([f.replace('-', '/') for f in fechas_raw]))

    fechas_dt = []
    for f in fechas_limpias:
        try:
            fechas_dt.append(datetime.strptime(f, "%d/%m/%Y"))
        except ValueError:
            continue

    vigencia_ok = False
    fecha_maxima_str = None
    fecha_evento_dt = None

    if fecha_evento_str:
        try:
            fecha_evento_dt = datetime.strptime(str(fecha_evento_str)[:10], "%Y-%m-%d")
        except ValueError:
            pass

    if fechas_dt:
        fecha_maxima = max(fechas_dt)
        fecha_maxima_str = fecha_maxima.strftime("%d/%m/%Y")
        if fecha_evento_dt:
            vigencia_ok = fecha_evento_dt <= fecha_maxima
        else:
            vigencia_ok = fecha_maxima >= datetime.now()
    else:
        vigencia_ok = False

    # 5. Clasificación de Riesgos
    texto_lower = texto_completo.lower()
    riesgos_detectados = [
        riesgo for riesgo, palabras in DICCIONARIO_RIESGOS.items()
        if any(p in texto_lower for p in palabras)
    ]
    if not riesgos_detectados:
        riesgos_detectados = ["Trabajo Estándar / Sin Riesgo Crítico Detectado"]

    # 6. Coincidencia con el trabajo que se hará
    analisis_trabajo = verificar_coincidencia_trabajo(descripcion_trabajo, riesgos_detectados, texto_completo)

    # 7. Personal y Cruce de DNIs
    todos_personal = extraer_personal_de_documento(texto_completo)
    dnis_en_documento = {p["dni"]: p["nombre"] for p in todos_personal}

    personal_validado = []
    dnis_faltantes = []

    if dnis_esperados:
        for dni in dnis_esperados:
            if dni in dnis_en_documento:
                personal_validado.append({"dni": dni, "nombre": dnis_en_documento[dni]})
            else:
                dnis_faltantes.append(dni)
    else:
        # Si no había lista de DNIs esperados, el personal validado son los encontrados
        personal_validado = todos_personal[:25]

    # 8. Determinación de Dictamen
    if dnis_esperados:
        personal_ok = len(dnis_faltantes) == 0
    else:
        personal_ok = len(personal_validado) > 0

    aprobacion_sugerida = vigencia_ok and personal_ok and (analisis_trabajo["nivel"] in ["ALTA", "MODERADA"])

    if aprobacion_sugerida:
        estado_dictamen = "CONFORME_SUGERIDO"
        mensaje_dictamen = (
            f"Vigencia válida hasta {fecha_maxima_str or 'fecha conforme'}. "
            f"Personal asegurado verificado ({len(personal_validado)}/{len(dnis_esperados) if dnis_esperados else len(personal_validado)}). "
            f"Las actividades detectadas ({', '.join(riesgos_detectados[:2])}) concuerdan con el requerimiento."
        )
    elif not vigencia_ok and fechas_dt:
        estado_dictamen = "OBSERVADO_SUGERIDO"
        mensaje_dictamen = (
            f"Póliza vencida: la fecha máxima encontrada ({fecha_maxima_str}) es anterior a la fecha requerida. "
            f"Requiere renovación de SCTR."
        )
    elif dnis_faltantes:
        estado_dictamen = "OBSERVADO_SUGERIDO"
        mensaje_dictamen = (
            f"Faltan trabajadores en la póliza: {len(dnis_faltantes)} DNI(s) no figuran en el documento ({', '.join(dnis_faltantes[:3])})."
        )
    elif not fechas_dt:
        estado_dictamen = "REVISION_MANUAL_SUGERIDA"
        mensaje_dictamen = (
            "No se detectaron fechas explícitas de vigencia en formato DD/MM/YYYY. Se recomienda revisión manual por SSOMA."
        )
    else:
        estado_dictamen = "REVISION_MANUAL_SUGERIDA"
        mensaje_dictamen = "Documento procesado. SSOMA debe validar las observaciones técnicas antes de aprobar."

    return {
        "url_analizada": url_drive,
        "formato_archivo": tipo_formato,
        "empresa_detectada": empresa_detectada,
        "ruc_detectado": ruc_detectado,
        "fechas_vigencia": fechas_limpias[:8],
        "fecha_maxima_vigencia": fecha_maxima_str,
        "vigencia_valida": vigencia_ok,
        "riesgos_detectados": riesgos_detectados,
        "coincidencia_trabajo": analisis_trabajo,
        "total_esperados": len(dnis_esperados),
        "total_validados": len(personal_validado),
        "personal_validado": personal_validado,
        "dnis_faltantes": dnis_faltantes,
        "todos_los_dnis_detectados": todos_personal[:30],
        "aprobacion_sugerida": aprobacion_sugerida,
        "estado_dictamen": estado_dictamen,
        "mensaje_dictamen": mensaje_dictamen,
        "inspeccionado_at": datetime.now().isoformat()
    }


def inspeccionar_conjunto_documentos(
    documentos_urls: List[str],
    fecha_evento_str: Optional[str] = None,
    dnis_esperados: Optional[List[str]] = None,
    descripcion_trabajo: str = ""
) -> Dict[str, Any]:
    """
    Inspecciona múltiples enlaces de documentos para una solicitud (Eventos o Accesos)
    y consolida los hallazgos en un dictamen unificado.
    """
    clean_urls = list(dict.fromkeys([u.strip() for u in documentos_urls if u and u.strip()]))
    if not clean_urls:
        return {
            "estado_dictamen": "SIN_DOCUMENTOS",
            "mensaje_dictamen": "No se proporcionaron enlaces a documentos para inspección.",
            "aprobacion_sugerida": False,
            "documentos_inspeccionados": []
        }

    resultados_docs = []
    empresas = set()
    riesgos_totales = set()
    todos_dnis_unificados = {}
    personal_validado_map = {}
    todas_fechas_maximas = []
    alguna_vigencia_valida = False
    errores_descarga = []

    for url in clean_urls:
        try:
            res = analizar_documento_ssoma(
                url_drive=url,
                fecha_evento_str=fecha_evento_str,
                dnis_esperados=dnis_esperados,
                descripcion_trabajo=descripcion_trabajo
            )
            resultados_docs.append(res)
            if res.get("empresa_detectada") and res["empresa_detectada"] != "No detectada expresamente":
                empresas.add(res["empresa_detectada"])
            for r in res.get("riesgos_detectados", []):
                if r != "Trabajo Estándar / Sin Riesgo Crítico Detectado":
                    riesgos_totales.add(r)
            if res.get("vigencia_valida"):
                alguna_vigencia_valida = True
            if res.get("fecha_maxima_vigencia"):
                todas_fechas_maximas.append(res["fecha_maxima_vigencia"])
            for p in res.get("personal_validado", []):
                personal_validado_map[p["dni"]] = p["nombre"]
            for p in res.get("todos_los_dnis_detectados", []):
                todos_dnis_unificados[p["dni"]] = p["nombre"]
        except Exception as e:
            errores_descarga.append({"url": url, "error": str(e)})
            resultados_docs.append({
                "url_analizada": url,
                "estado_dictamen": "ERROR_INSPECCION",
                "mensaje_dictamen": f"No se pudo inspeccionar el documento: {str(e)}",
                "error": str(e)
            })

    # DNIs faltantes globales respecto a los esperados
    dnis_esp = [str(d).strip() for d in (dnis_esperados or []) if str(d).strip()]
    dnis_faltantes_global = [dni for dni in dnis_esp if dni not in personal_validado_map and dni not in todos_dnis_unificados]
    personal_validado_final = [
        {"dni": dni, "nombre": personal_validado_map.get(dni) or todos_dnis_unificados.get(dni, "Personal Asegurado")}
        for dni in dnis_esp if dni in personal_validado_map or dni in todos_dnis_unificados
    ]

    # Evaluación de concordancia de trabajo global
    concordancia_global = verificar_coincidencia_trabajo(
        descripcion_trabajo,
        list(riesgos_totales) if riesgos_totales else ["Trabajo Estándar / Sin Riesgo Crítico Detectado"],
        " ".join(empresas)
    )

    if not riesgos_totales:
        riesgos_totales.add("Trabajo Estándar / Sin Riesgo Crítico Detectado")

    docs_exitosos = [d for d in resultados_docs if d.get("estado_dictamen") != "ERROR_INSPECCION"]

    if not docs_exitosos:
        estado_dictamen = "REVISION_MANUAL_SUGERIDA"
        mensaje_dictamen = f"No se pudo inspeccionar automáticamente los enlaces de Google Drive. {errores_descarga[0]['error'] if errores_descarga else ''} Se requiere revisión manual en SSOMA."
        aprobacion_sugerida = False
    elif dnis_esp and dnis_faltantes_global:
        estado_dictamen = "OBSERVADO_SUGERIDO"
        mensaje_dictamen = f"Se validaron {len(personal_validado_final)} de {len(dnis_esp)} trabajadores. Faltan en la documentación: {', '.join(dnis_faltantes_global[:4])}."
        aprobacion_sugerida = False
    elif not alguna_vigencia_valida and todas_fechas_maximas:
        estado_dictamen = "OBSERVADO_SUGERIDO"
        mensaje_dictamen = f"Póliza(s) vencidas para la fecha requerida. Último vencimiento: {todas_fechas_maximas[0]}. Requiere SCTR vigente."
        aprobacion_sugerida = False
    elif alguna_vigencia_valida:
        estado_dictamen = "CONFORME_SUGERIDO"
        mensaje_dictamen = f"Documentación conforme: SCTR vigente, personal acreditado ({len(personal_validado_final) if dnis_esp else len(todos_dnis_unificados)}) y cobertura alineada ({', '.join(list(riesgos_totales)[:2])})."
        aprobacion_sugerida = True
    else:
        estado_dictamen = "REVISION_MANUAL_SUGERIDA"
        mensaje_dictamen = "Documentos descargados pero requieren verificación visual de fechas por SSOMA."
        aprobacion_sugerida = False

    return {
        "estado_dictamen": estado_dictamen,
        "mensaje_dictamen": mensaje_dictamen,
        "aprobacion_sugerida": aprobacion_sugerida,
        "total_documentos": len(clean_urls),
        "total_procesados_exito": len(docs_exitosos),
        "empresas_detectadas": list(empresas) if empresas else ["No detectada expresamente"],
        "riesgos_detectados": list(riesgos_totales),
        "coincidencia_trabajo": concordancia_global,
        "vigencia_valida": alguna_vigencia_valida,
        "fechas_maximas": todas_fechas_maximas,
        "total_esperados": len(dnis_esp),
        "total_validados": len(personal_validado_final),
        "personal_validado": personal_validado_final,
        "dnis_faltantes": dnis_faltantes_global,
        "todos_los_dnis_detectados": [{"dni": k, "nombre": v} for k, v in list(todos_dnis_unificados.items())[:40]],
        "documentos_inspeccionados": resultados_docs,
        "errores_descarga": errores_descarga,
        "inspeccionado_at": datetime.now().isoformat()
    }


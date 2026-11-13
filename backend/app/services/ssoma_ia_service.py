import os
import re
import io
import json
import requests
from datetime import datetime
from typing import List, Optional, Tuple

import pdfplumber
import pandas as pd
from openai import OpenAI

from app.core.config import settings
from app.schemas.ssoma_ia import AnalisisSSOMAResponse, TrabajadorVerificado, CoincidenciaTrabajo

# Inicializar cliente OpenAI
_api_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
client = OpenAI(api_key=_api_key) if _api_key else None

def get_openai_client() -> OpenAI:
    global client
    if client is None:
        key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
        if not key:
            raise ValueError("OPENAI_API_KEY no configurada. Configure la variable de entorno.")
        client = OpenAI(api_key=key)
    return client

# ==============================================================================
# DESCARGA Y LECTURA MULTI-FORMATO (GOOGLE DRIVE EN MEMORIA)
# ==============================================================================

def extraer_id_drive(url_drive: str) -> str:
    """Extrae el ID del archivo desde cualquier formato de URL pública de Google Drive."""
    patron = r'(?:/d/|id=)([a-zA-Z0-9_-]+)'
    coincidencia = re.search(patron, url_drive)
    if coincidencia:
        return coincidencia.group(1)
    raise ValueError("No se pudo extraer el ID de Google Drive. Verifique que la URL sea válida y pública.")

def descargar_contenido_drive(url_drive: str) -> Tuple[bytes, str]:
    """
    Descarga el archivo a memoria sin escribir en disco.
    Detecta automáticamente si es PDF, Excel (.xlsx), Google Sheets/Docs o Imagen.
    """
    file_id = extraer_id_drive(url_drive)
    session = requests.Session()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GestEvents-SSOMA-IA/2.0'
    }

    # 1. Hojas de Cálculo de Google Sheets
    if "spreadsheets" in url_drive:
        url_descarga = f'https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx'
        resp = session.get(url_descarga, headers=headers, timeout=25)
        if resp.status_code == 200:
            return resp.content, "excel"
        raise Exception(f"No se pudo exportar el Google Sheet (código HTTP {resp.status_code}). Verifique permisos públicos.")

    # 2. Documentos de Google Docs
    if "document/d/" in url_drive:
        url_descarga = f'https://docs.google.com/document/d/{file_id}/export?format=pdf'
        resp = session.get(url_descarga, headers=headers, timeout=25)
        if resp.status_code == 200:
            return resp.content, "pdf"

    # 3. Archivo binario directo en Drive (PDF, Excel o Imagen)
    url_descarga = f'https://drive.google.com/uc?export=download&id={file_id}'
    resp = session.get(url_descarga, headers=headers, stream=True, timeout=25)

    # Confirmación de advertencia de antivirus para archivos grandes
    for key, value in resp.cookies.items():
        if key.startswith('download_warning'):
            url_descarga = f'{url_descarga}&confirm={value}'
            resp = session.get(url_descarga, headers=headers, stream=True, timeout=25)
            break

    if resp.status_code == 200:
        contenido = resp.content

        # Verificación de pantalla de login de Google
        if b'accounts.google.com' in contenido[:2000] and b'ServiceLogin' in contenido[:2000]:
            raise Exception(
                "El archivo de Google Drive requiere inicio de sesión. Por favor configure los permisos en Google Drive como 'Cualquier persona con el enlace' (Lector) para que el sistema pueda inspeccionarlo automáticamente."
            )

        # Identificación por firma binaria
        if contenido.startswith(b'%PDF'):
            return contenido, "pdf"
        elif contenido.startswith(b'PK\x03\x04'):
            return contenido, "excel"
        elif contenido.startswith(b'\x89PNG') or contenido.startswith(b'\xff\xd8\xff') or contenido.startswith(b'GIF'):
            return contenido, "imagen"
        else:
            return contenido, "desconocido"
    else:
        # Fallback a drive usercontent
        url_directa = f'https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0'
        resp_dir = session.get(url_directa, headers=headers, timeout=25)
        if resp_dir.status_code == 200:
            contenido = resp_dir.content
            if contenido.startswith(b'%PDF'):
                return contenido, "pdf"
            elif contenido.startswith(b'PK\x03\x04'):
                return contenido, "excel"
            elif contenido.startswith(b'\x89PNG') or contenido.startswith(b'\xff\xd8\xff'):
                return contenido, "imagen"
            return contenido, "desconocido"

        raise Exception(f"Error al acceder a Google Drive (HTTP {resp.status_code}). Verifique que el enlace sea público.")

def extraer_texto_de_pdf(contenido_bytes: bytes, max_paginas: int = 15) -> str:
    """Extrae texto de un archivo PDF usando pdfplumber con fallback a pypdf."""
    texto_total = ""
    try:
        with pdfplumber.open(io.BytesIO(contenido_bytes)) as pdf:
            for i, pagina in enumerate(pdf.pages[:max_paginas]):
                txt = pagina.extract_text()
                if txt:
                    texto_total += f"\n--- PÁGINA {i + 1} ---\n" + txt
    except Exception:
        pass

    # Si no se extrajo texto o fue insuficiente, probar pypdf
    if len(texto_total.strip()) < 20:
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(contenido_bytes))
            for i, page in enumerate(reader.pages[:max_paginas]):
                txt = page.extract_text()
                if txt:
                    texto_total += f"\n--- PÁGINA {i + 1} (pypdf) ---\n" + txt
        except Exception:
            pass

    return texto_total

def extraer_texto_de_excel(contenido_bytes: bytes) -> str:
    """Extrae el contenido de todas las pestañas de una hoja de cálculo Excel."""
    texto_total = ""
    try:
        excel_file = pd.read_excel(io.BytesIO(contenido_bytes), sheet_name=None, dtype=str)
        for nombre_hoja, df in excel_file.items():
            texto_total += f"\n--- HOJA EXCEL: {nombre_hoja} ---\n"
            df_limpio = df.fillna("")
            texto_total += df_limpio.to_string(index=False, header=True) + "\n"
    except Exception as e:
        texto_total = f"[No se pudo leer la hoja Excel: {str(e)}]"

    return texto_total

def descargar_texto_drive(url_drive: str) -> Tuple[str, str]:
    """
    Descarga y extrae el texto del archivo en Google Drive de forma tolerante.
    Si es una imagen o escaneo gráfico, no lanza excepción fatal sino que lo describe.
    Retorna (texto_extraido, tipo_formato).
    """
    contenido_bytes, tipo_formato = descargar_contenido_drive(url_drive)

    if tipo_formato == "imagen":
        return f"[Archivo de imagen / captura gráfica adjunta al expediente ({len(contenido_bytes)} bytes)]", "imagen"

    if tipo_formato == "pdf":
        texto = extraer_texto_de_pdf(contenido_bytes)
        if len(texto.strip()) < 15:
            texto = f"[Documento PDF adjunto ({len(contenido_bytes)} bytes) - escaneo o imagen digitalizada]"
        return texto, "pdf"

    if tipo_formato == "excel":
        texto = extraer_texto_de_excel(contenido_bytes)
        return texto, "excel"

    # Desconocido
    try:
        texto = extraer_texto_de_pdf(contenido_bytes)
        if len(texto.strip()) > 15:
            return texto, "pdf"
    except Exception:
        pass

    try:
        texto = extraer_texto_de_excel(contenido_bytes)
        if len(texto.strip()) > 15:
            return texto, "excel"
    except Exception:
        pass

    texto = contenido_bytes.decode('utf-8', errors='ignore')[:15000]
    if len(texto.strip()) < 15:
        texto = f"[Archivo complementario adjunto al expediente ({len(contenido_bytes)} bytes)]"
    return texto, "adjunto"

# ==============================================================================
# AUDITORÍA INTEGRAL DE EXPEDIENTE / DOSSIER SSOMA CON OPENAI (gpt-4o-mini)
# ==============================================================================

async def auditar_dossier_ssoma_ia(
    documentos_urls: list[str],
    fecha_evento: str,
    dnis_esperados: list[str],
    motivo_trabajo: str = ""
) -> dict:
    """
    Audita el Expediente SSOMA completo (Dossier Integrado) analizando todos los documentos
    subidos (SCTR, ATS, IPERC, PETS, inducciones, imágenes) en una sola consulta coherente
    a OpenAI gpt-4o-mini con Structured Outputs (Pydantic).
    """
    urls_validas = [u.strip() for u in documentos_urls if u and u.strip().startswith("http")]
    if not urls_validas:
        return {
            "exito": False,
            "motor": "OpenAI gpt-4o-mini",
            "total_documentos": 0,
            "aprobacion_sugerida": False,
            "dictamen_sugerido": "OBSERVADO",
            "observaciones": ["No se proporcionaron enlaces de documentos válidos para evaluar."],
            "alertas": ["No se proporcionaron enlaces de documentos válidos para evaluar."],
            "fecha_inspeccion": datetime.utcnow().isoformat()
        }

    # 1. Descarga y consolidación de cada documento en el Dossier
    dossier_partes = []
    formatos_detectados = []

    for idx, url in enumerate(urls_validas, start=1):
        try:
            texto_doc, formato = descargar_texto_drive(url)
            formatos_detectados.append(formato)
            dossier_partes.append(f"""
================================================================================
DOCUMENTO #{idx} (Formato: {formato.upper()})
ENLACE: {url}
--------------------------------------------------------------------------------
{texto_doc[:15000]}
================================================================================
""")
        except Exception as doc_err:
            dossier_partes.append(f"""
================================================================================
DOCUMENTO #{idx} (Error de acceso)
ENLACE: {url}
--------------------------------------------------------------------------------
[No se pudo descargar este archivo: {str(doc_err)}]
================================================================================
""")

    texto_dossier_completo = "\n".join(dossier_partes)

    # 2. Llamada a OpenAI gpt-4o-mini con Structured Outputs
    try:
        ai_client = get_openai_client()

        prompt_sistema = """
Eres un auditor experto en Seguridad, Salud Ocupacional y Medio Ambiente (SSOMA) de la Universidad Continental.
Tienes ante ti el Expediente / Dossier Completo de Seguridad SSOMA presentado por una empresa contratista o proveedor para autorizar una labor en el campus.

El expediente está compuesto por uno o más documentos que pueden incluir:
- Póliza de Seguro Complementario de Trabajo de Riesgo (SCTR - Salud y Pensión).
- Análisis de Trabajo Seguro (ATS).
- Matriz de Identificación de Peligros y Evaluación de Riesgos (IPERC).
- Procedimientos Escritos de Trabajo Seguro (PETS).
- Registro de inducción / charlas de capacitación de 5 minutos.
- Nómina de personal o constancia de aseguramiento.
- Archivos complementarios (imágenes, correos).

DEBES AUDITAR EL EXPEDIENTE EN SU TOTALIDAD (UNIFICADO), APLICANDO ESTAS REGLAS CRÍTICAS:

1. DOCUMENTOS DETECTADOS (documentos_detectados):
   Identifica qué tipos de documentos están presentes en el expediente (ej. ["Póliza SCTR Salud y Pensión", "Análisis de Trabajo Seguro (ATS)", "Matriz IPERC", "PETS", "Constancia de Coordinación"]).

2. RAZÓN SOCIAL Y RUC:
   Identifica la Razón Social principal y RUC de la empresa contratista (ej. "BJ ARROYO INGENIERIA Y CONSTRUCCION E.I.R.L." - RUC: ...). NO mezcles con la Universidad Continental ni uses nombres genéricos.

3. PÓLIZA SCTR Y VIGENCIA:
   Busca la póliza SCTR en cualquiera de los documentos del expediente (usualmente en el archivo SCTR o nómina de seguros).
   - numero_poliza: Número de la póliza (ej. "88472910").
   - vigencia_inicio y vigencia_fin: Fechas en formato YYYY-MM-DD.
   - vigencia_valida: boolean. Debe ser TRUE si vigencia_fin es igual o posterior a la fecha programada.

4. CRUCE DE PERSONAL Y NÓMINA (REGLA FUNDAMENTAL):
   Para cada uno de los DNIs esperados:
   - Revisa si el DNI figura en CUALQUIERA de los documentos del expediente (especialmente en la póliza SCTR, relación de asegurados, ATS o nóminas).
   - ¡MUY IMPORTANTE!: Si el DNI está registrado como asegurado en la póliza SCTR o en la nómina, debe marcarse estrictamente como asegurado: TRUE, con su nombre completo real (ej. si el DNI 71695043 aparece en la póliza SCTR como Sierra Castro Jhon, márcalo asegurado: true).
   - Solo marca asegurado: FALSE si el DNI NO figura en la póliza SCTR ni en ningún documento de cobertura del expediente.

5. CONCORDANCIA Y RIESGOS DEL TRABAJO:
   - Evalúa si los documentos técnicos (ATS, IPERC, PETS) y la póliza SCTR amparan adecuadamente la labor a realizar.
   - actividades_riesgo: Lista clara de riesgos involucrados (ej. "Riesgo Eléctrico / Luminarias", "Trabajo en Altura (Escaleras/Andamios)", "Montaje").
   - coincidencia_trabajo: { coincide: bool, nivel: "ALTA"|"MEDIA"|"BAJA", detalle: "explicación clara y sintética" }.

6. DICTAMEN SUGERIDO Y OBSERVACIONES:
   - dictamen_sugerido:
     * "APROBADO": Si la póliza SCTR está vigente para la fecha, todo el personal requerido está asegurado y los documentos respaldan el trabajo.
     * "OBSERVADO": Si algún trabajador requerido no figura asegurado, si la póliza vence antes de la fecha, o si falta algún documento esencial.
     * "RECHAZADO": Si la póliza está vencida y no hay cobertura.
   - observaciones: Redacta un resumen conciso y coherente del estado del expediente, SIN contradecirte (NO digas que un DNI no está asegurado si sí lo está en la póliza SCTR).
"""

        dnis_str = ', '.join([str(d).strip() for d in dnis_esperados if str(d).strip()]) if dnis_esperados else "No se especificaron DNIs previos para cruce"
        motivo_str = motivo_trabajo.strip() if motivo_trabajo else "Trabajos generales / Operaciones en campus"

        prompt_usuario = f"""
FECHA PROGRAMADA DEL EVENTO / ACCESO A AUDITAR: {fecha_evento or 'Fecha actual'}
DESCRIPCIÓN DEL TRABAJO / MOTIVO DECLARADO: {motivo_str}
LISTA DE DNIs ESPERADOS A VERIFICAR: {dnis_str}

CONTENIDO DEL EXPEDIENTE / DOSSIER COMPLETO DE GOOGLE DRIVE ({len(urls_validas)} ARCHIVO(S)):
\"\"\"
{texto_dossier_completo}
\"\"\"
"""

        completion = ai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt_sistema},
                {"role": "user", "content": prompt_usuario},
            ],
            response_format=AnalisisSSOMAResponse,
            temperature=0.1
        )

        parsed_model: AnalisisSSOMAResponse = completion.choices[0].message.parsed
        parsed_dict = parsed_model.model_dump()

        # Adaptación para el frontend y compatibilidad completa
        personal_verificado = parsed_dict.get("personal_verificado", [])
        personal_validado = [
            {"dni": p["dni"], "nombre": p.get("nombre_completo") or "Asegurado verificado"}
            for p in personal_verificado if p.get("asegurado")
        ]
        dnis_faltantes = [
            p["dni"] for p in personal_verificado if not p.get("asegurado")
        ]

        vigencia_ok = bool(parsed_dict.get("vigencia_valida", False))
        vigencia_fin = parsed_dict.get("vigencia_fin")
        vigencia_inicio = parsed_dict.get("vigencia_inicio")
        fechas_vigencia = [f for f in [vigencia_inicio, vigencia_fin] if f]

        aprobacion_sugerida = parsed_dict.get("dictamen_sugerido") == "APROBADO"
        empresa = parsed_dict.get("empresa_detectada") or "No detectada expresamente"
        ruc = parsed_dict.get("ruc_detectado")

        dictamen_completo = {
            "exito": True,
            "motor": "OpenAI gpt-4o-mini (Auditoría Integral de Dossier SSOMA)",
            "total_documentos": len(urls_validas),
            "formatos_archivos": list(set(formatos_detectados)),
            "formato_archivo": ", ".join(list(set(formatos_detectados))) if formatos_detectados else "Varios",
            "documentos_detectados": parsed_dict.get("documentos_detectados", []),
            "empresa_detectada": empresa,
            "empresas_detectadas": [empresa] if empresa and empresa != "No detectada expresamente" else [],
            "ruc_detectado": ruc,
            "numero_poliza": parsed_dict.get("numero_poliza"),
            "vigencia_inicio": vigencia_inicio,
            "vigencia_fin": vigencia_fin,
            "fecha_maxima_vigencia": vigencia_fin,
            "fechas_vigencia": fechas_vigencia,
            "vigencia_valida": vigencia_ok,
            "actividades_riesgo": parsed_dict.get("actividades_riesgo", []),
            "riesgos_detectados": parsed_dict.get("actividades_riesgo", []),
            "personal_verificado": personal_verificado,
            "personal_validado": personal_validado,
            "dnis_faltantes": dnis_faltantes,
            "total_esperados": len(personal_verificado) if personal_verificado else len(dnis_esperados),
            "total_validados": len(personal_validado),
            "coincidencia_trabajo": parsed_dict.get("coincidencia_trabajo") or {
                "coincide": True,
                "nivel": "ALTA",
                "detalle": "Los documentos amparan adecuadamente la labor a realizar."
            },
            "observaciones": parsed_dict.get("observaciones", []),
            "alertas": parsed_dict.get("observaciones", []),
            "dictamen_sugerido": parsed_dict.get("dictamen_sugerido", "OBSERVADO"),
            "aprobacion_sugerida": aprobacion_sugerida,
            "fecha_inspeccion": datetime.utcnow().isoformat()
        }

        return dictamen_completo

    except Exception as e:
        error_msg = str(e)
        return {
            "exito": False,
            "motor": "OpenAI gpt-4o-mini (Fallo)",
            "error": error_msg,
            "total_documentos": len(urls_validas),
            "empresa_detectada": "No disponible por error de lectura",
            "empresas_detectadas": [],
            "documentos_detectados": [],
            "fechas_vigencia": [],
            "vigencia_valida": False,
            "riesgos_detectados": ["Evaluación manual requerida"],
            "personal_verificado": [],
            "personal_validado": [],
            "dnis_faltantes": dnis_esperados,
            "total_esperados": len(dnis_esperados),
            "total_validados": 0,
            "coincidencia_trabajo": {
                "coincide": False,
                "nivel": "NO_DETECTADO",
                "detalle": f"No se pudo completar la verificación automática: {error_msg}"
            },
            "observaciones": [f"Error de procesamiento: {error_msg}"],
            "alertas": [f"Error de procesamiento automático: {error_msg}"],
            "dictamen_sugerido": "OBSERVADO",
            "aprobacion_sugerida": False,
            "fecha_inspeccion": datetime.utcnow().isoformat()
        }

# ==============================================================================
# ALIAS COMPATIBLES PARA LLAMADAS INDIVIDUALES Y COLECTIVAS
# ==============================================================================

async def inspeccionar_documento_sctr_ia(
    url_drive: str,
    fecha_evento: str,
    dnis_esperados: list[str],
    motivo_trabajo: str = ""
) -> dict:
    """Inspección de un único documento Google Drive delegada al auditor de dossier."""
    return await auditar_dossier_ssoma_ia(
        documentos_urls=[url_drive],
        fecha_evento=fecha_evento,
        dnis_esperados=dnis_esperados,
        motivo_trabajo=motivo_trabajo
    )

async def auditar_conjunto_documentos_ia(
    documentos_urls: list[str],
    fecha_evento: str,
    dnis_esperados: list[str],
    motivo_trabajo: str = ""
) -> dict:
    """Auditoría unificada del conjunto completo de documentos del expediente."""
    return await auditar_dossier_ssoma_ia(
        documentos_urls=documentos_urls,
        fecha_evento=fecha_evento,
        dnis_esperados=dnis_esperados,
        motivo_trabajo=motivo_trabajo
    )

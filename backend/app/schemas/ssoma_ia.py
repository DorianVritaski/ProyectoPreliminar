from pydantic import BaseModel
from typing import List, Optional

class TrabajadorVerificado(BaseModel):
    dni: str
    nombre_completo: Optional[str] = None
    asegurado: bool

class CoincidenciaTrabajo(BaseModel):
    coincide: bool
    nivel: str # "ALTA", "MEDIA", "BAJA", "NO_DETECTADO"
    detalle: str

class AnalisisSSOMAResponse(BaseModel):
    documentos_detectados: List[str]      # Ej: ["Póliza SCTR", "ATS", "IPERC", "PETS"]
    empresa_detectada: Optional[str] = None
    ruc_detectado: Optional[str] = None
    numero_poliza: Optional[str] = None
    vigencia_inicio: Optional[str] = None # Formato YYYY-MM-DD
    vigencia_fin: Optional[str] = None    # Formato YYYY-MM-DD
    vigencia_valida: bool                 # True si cubre la fecha del evento/acceso
    actividades_riesgo: List[str]         # Ej: ["Trabajo en Altura", "Riesgo Eléctrico"]
    personal_verificado: List[TrabajadorVerificado]
    coincidencia_trabajo: Optional[CoincidenciaTrabajo] = None
    observaciones: List[str]              # Discrepancias u observaciones consolidadas
    dictamen_sugerido: str                # "APROBADO", "OBSERVADO" o "RECHAZADO"

class InspeccionDocumentoRequest(BaseModel):
    url_drive: str
    fecha_evento: Optional[str] = None
    dnis_esperados: Optional[List[str]] = None
    motivo_trabajo: Optional[str] = None

import os
import re
import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException, status

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "documentos_ssoma"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")).strip()
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "documentos-ssoma").strip()


def sanitize_filename(filename: str) -> str:
    """Elimina caracteres peligrosos del nombre original conservando la extensión."""
    name, ext = os.path.splitext(filename)
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", name)[:50]
    return f"{clean_name}{ext.lower()}"


async def save_uploaded_pdf(file: UploadFile) -> dict:
    """
    Valida y guarda un documento en PDF.
    En fase actual guarda en el disco local y retorna la URL relativa /api/v1/archivos/{filename}.
    Si están configuradas las credenciales de Supabase, sube al Bucket de Supabase Storage.
    """
    # 1. Validación de extensión y tipo MIME
    original_name = file.filename or "documento.pdf"
    if not original_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos en formato PDF (.pdf)."
        )

    clean_name = sanitize_filename(original_name)
    unique_name = f"{uuid.uuid4().hex[:12]}_{clean_name}"
    
    # 2. Leer contenido y verificar tamaño
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo adjunto está vacío."
        )
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo supera el tamaño máximo permitido de 15MB ({round(len(content)/(1024*1024), 1)}MB)."
        )

    # 3. Almacenamiento
    # Si Supabase Storage está configurado
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            import urllib.request
            upload_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{SUPABASE_BUCKET}/{unique_name}"
            req = urllib.request.Request(
                upload_url,
                data=content,
                headers={
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "apikey": SUPABASE_KEY,
                    "Content-Type": "application/pdf"
                },
                method="POST"
            )
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 201):
                    public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{SUPABASE_BUCKET}/{unique_name}"
                    return {
                        "url": public_url,
                        "filename": unique_name,
                        "original_name": original_name,
                        "size": len(content),
                        "storage": "supabase"
                    }
        except Exception as e:
            # Si falla supabase, recurrir a almacenamiento local seguro
            print(f"[Storage] Advertencia: Error al subir a Supabase ({e}), guardando localmente...")

    # Almacenamiento local (Default / Desarrollo / Render Temp)
    local_path = UPLOAD_DIR / unique_name
    with open(local_path, "wb") as f:
        f.write(content)

    relative_url = f"/api/v1/archivos/{unique_name}"
    return {
        "url": relative_url,
        "filename": unique_name,
        "original_name": original_name,
        "size": len(content),
        "storage": "local"
    }


def get_uploaded_file_path(filename: str) -> Path | None:
    """Retorna la ruta al archivo en disco verificando que no salga del directorio de subidas."""
    # Prevención de Directory Traversal
    safe_name = os.path.basename(filename)
    path = UPLOAD_DIR / safe_name
    if path.exists() and path.is_file():
        return path
    return None

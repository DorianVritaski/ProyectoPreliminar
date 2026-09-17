import os
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse
from app.services.storage_service import save_uploaded_pdf, get_uploaded_file_path

router = APIRouter(prefix="/archivos", tags=["Archivos y Documentos SSOMA"])


@router.post("/upload")
async def subir_documento_pdf(file: UploadFile = File(...)):
    """
    Sube un documento en formato PDF (SCTR o Lista de Personal Externo).
    Retorna la URL accesible del documento.
    """
    res = await save_uploaded_pdf(file)
    return res


@router.get("/{filename}")
def obtener_documento(filename: str):
    """
    Sirve el archivo PDF directamente para previsualización en el navegador
    con Content-Disposition inline.
    """
    path = get_uploaded_file_path(filename)
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El documento solicitado no fue encontrado en el servidor."
        )

    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{path.name}\"",
            "Cache-Control": "public, max-age=86400"
        }
    )

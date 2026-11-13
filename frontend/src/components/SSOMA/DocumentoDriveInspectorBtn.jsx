import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Users,
  Zap,
  ExternalLink,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../../api/client';

export default function DocumentoDriveInspectorBtn({
  urlDrive,
  fechaEvento = '',
  dnisEsperados = [],
  motivoTrabajo = '',
  onInspeccionComplete = null,
  compact = false,
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [openDetail, setOpenDetail] = useState(false);

  const handleInspect = async () => {
    if (!urlDrive || !urlDrive.trim()) {
      setError('Pegue primero un enlace válido de Google Drive.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        url_drive: urlDrive.trim(),
        fecha_evento: fechaEvento ? fechaEvento.split('T')[0] : null,
        dnis_esperados: dnisEsperados.map((d) => String(d).trim()).filter(Boolean),
        motivo_trabajo: motivoTrabajo || null,
      };

      const res = await api.inspeccionarDocumentoSSOMA(payload);
      setResult(res);
      setOpenDetail(true);
      if (onInspeccionComplete) {
        onInspeccionComplete(res);
      }
    } catch (err) {
      setError(err.message || 'Error al inspeccionar documento de Drive.');
    } finally {
      setLoading(false);
    }
  };

  if (!urlDrive || !urlDrive.includes('drive.google.com') && !urlDrive.includes('docs.google.com')) {
    return null;
  }

  return (
    <div className="mt-1 space-y-2">
      {/* Botón trigger */}
      {!result && !loading && (
        <button
          type="button"
          onClick={handleInspect}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs group cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
          <span>Verificar enlace con SSOMA</span>
        </button>
      )}

      {/* Loading State */}
      {loading && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          <span>Descargando y analizando archivo en memoria (0 costos API)...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
          <div className="flex items-start gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleInspect}
            className="text-[11px] text-rose-700 font-bold underline hover:text-rose-900 cursor-pointer"
          >
            Reintentar verificación
          </button>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="p-3 bg-white border border-emerald-300 rounded-xl text-xs space-y-2 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="font-extrabold text-emerald-950 text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Archivo verificado ({result.formato_archivo?.toUpperCase()})
              </span>
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                  result.aprobacion_sugerida
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {result.aprobacion_sugerida ? 'Favorable' : 'Observación'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpenDetail(!openDetail)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5 cursor-pointer"
              >
                <span>{openDetail ? 'Menos' : 'Detalles'}</span>
                {openDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={handleInspect}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Volver a inspeccionar"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
              </button>
            </div>
          </div>

          {/* Quick Summary Pill Row */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700 flex items-center gap-1 font-semibold">
              <Building2 className="w-3 h-3 text-slate-500" />
              {result.empresa_detectada || 'Empresa particular'}
            </span>

            <span
              className={`px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${
                result.vigencia_valida
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {result.vigencia_valida ? 'Póliza vigente' : 'Revisar vigencia'}
            </span>

            <span className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-800 flex items-center gap-1 font-bold">
              <Users className="w-3 h-3 text-blue-600" />
              {result.total_validados || 0}/{result.total_esperados || 0} DNI(s)
            </span>
          </div>

          {/* Open Detail Section */}
          {openDetail && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
              {result.riesgos_detectados?.length > 0 && (
                <div className="flex items-start gap-1">
                  <Zap className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Riesgos detectados:</strong> {result.riesgos_detectados.join(', ')}
                  </span>
                </div>
              )}
              {result.fechas_vigencia?.length > 0 && (
                <div>
                  <strong>Fechas encontradas:</strong> {result.fechas_vigencia.join(', ')}
                </div>
              )}
              {result.personal_validado?.length > 0 && (
                <div>
                  <strong>Personal identificado:</strong>{' '}
                  {result.personal_validado.map((p) => `${p.nombre} (${p.dni})`).join('; ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

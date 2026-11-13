import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  AlertTriangle,
  Users,
  Building2,
  Calendar,
  Zap,
  RotateCw,
  Check,
  X,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Search,
} from 'lucide-react';

export default function DictamenSSOMACard({
  dictamen,
  onReinspect,
  isReinspecting = false,
  showReinspectButton = true,
  compact = false,
  title = 'Dictamen de Inspección Automática SSOMA',
}) {
  const [expandedDetails, setExpandedDetails] = useState(false);

  if (!dictamen) {
    return (
      <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>No se ha generado inspección automática para los documentos de esta solicitud.</span>
        </div>
        {showReinspectButton && onReinspect && (
          <button
            type="button"
            onClick={onReinspect}
            disabled={isReinspecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs disabled:opacity-50 text-xs shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isReinspecting ? 'animate-spin' : ''}`} />
            <span>{isReinspecting ? 'Auditando...' : 'Auditar con IA'}</span>
          </button>
        )}
      </div>
    );
  }

  if (dictamen.estado_dictamen === "AUDITORIA_IA_EN_CURSO") {
    return (
      <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-950 animate-pulse shadow-xs">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
          <div>
            <strong className="block font-bold text-indigo-900 text-xs">
              Auditoría SSOMA con Inteligencia Artificial en curso...
            </strong>
            <span className="text-[11px] text-indigo-700">
              Analizando póliza SCTR, vigencia de cobertura y cruce de nómina con OpenAI (gpt-4o-mini).
            </span>
          </div>
        </div>
        {showReinspectButton && onReinspect && (
          <button
            type="button"
            onClick={onReinspect}
            disabled={isReinspecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 text-xs font-bold transition-all shadow-2xs shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isReinspecting ? 'animate-spin' : ''}`} />
            <span>{isReinspecting ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        )}
      </div>
    );
  }

  const isFavorable = Boolean(dictamen.aprobacion_sugerida || dictamen.dictamen_sugerido === 'APROBADO');
  const empresas = dictamen.empresas_detectadas || (dictamen.empresa_detectada ? [dictamen.empresa_detectada] : []);
  const riesgos = dictamen.riesgos_detectados || dictamen.actividades_riesgo || [];
  const formato = dictamen.formato_archivo || 'N/A';
  const vigenciaOk = dictamen.vigencia_valida;
  const fechaMax = dictamen.fecha_maxima_vigencia || dictamen.vigencia_fin || (dictamen.fechas_vigencia && dictamen.fechas_vigencia[0]);
  const personalVal = dictamen.personal_validado || [];
  const dnisFaltantes = dictamen.dnis_faltantes || [];
  const coincidencia = dictamen.coincidencia_trabajo;
  const alertas = dictamen.alertas || dictamen.observaciones || [];
  const totalEsperados = dictamen.total_esperados || (personalVal.length + dnisFaltantes.length);
  const totalValidados = dictamen.total_validados || personalVal.length;
  const numeroPoliza = dictamen.numero_poliza;
  const motor = dictamen.motor || 'OpenAI gpt-4o-mini';

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isFavorable
          ? 'bg-linear-to-br from-emerald-50/90 via-white to-emerald-50/50 border-emerald-300/80 shadow-xs'
          : 'bg-linear-to-br from-amber-50/90 via-white to-amber-50/50 border-amber-300/80 shadow-xs'
      } ${compact ? 'p-3.5 text-xs' : 'p-4 sm:p-5 text-xs'} space-y-3.5`}
    >
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200/70">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              isFavorable
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-600 text-white'
            }`}
          >
            {isFavorable ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">{title}</h4>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isFavorable
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {dictamen.dictamen_sugerido || (isFavorable ? 'APROBADO ✓' : 'OBSERVADO ⚠️')}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>{motor.includes('OpenAI') ? 'IA Auditora gpt-4o-mini' : motor}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Auditoría inteligente de pólizas SCTR, vigencia y nómina de contratistas (Drive)
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {showReinspectButton && onReinspect && (
            <button
              type="button"
              onClick={onReinspect}
              disabled={isReinspecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-all shadow-2xs hover:shadow-xs disabled:opacity-50"
              title="Volver a descargar y analizar los documentos desde Google Drive"
            >
              <RotateCw className={`w-3.5 h-3.5 text-slate-600 ${isReinspecting ? 'animate-spin' : ''}`} />
              <span>{isReinspecting ? 'Inspeccionando...' : 'Re-inspeccionar'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpandedDetails(!expandedDetails)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <span>{expandedDetails ? 'Ocultar' : 'Ver detalle'}</span>
            {expandedDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Alertas destacadas si existen */}
      {alertas.length > 0 && (
        <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl space-y-1">
          {alertas.map((alerta, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[11px] font-bold text-amber-950">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>{alerta}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grid de Métricas Clave del Dictamen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Razón Social */}
        <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase">
            <Building2 className="w-3.5 h-3.5 text-brand-600" />
            <span>Empresa / Contratista</span>
          </div>
          <div className="font-extrabold text-slate-900 text-xs truncate" title={empresas.join(', ') || 'No detectada'}>
            {empresas.length > 0 ? empresas.join(', ') : 'No detectada expresamente'}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {dictamen.ruc_detectado ? `RUC: ${dictamen.ruc_detectado}` : 'Detectada en expediente'}
          </span>
        </div>

        {/* Vigencia Póliza SCTR */}
        <div
          className={`p-3 rounded-xl border shadow-2xs space-y-1 ${
            vigenciaOk
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/70 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Vigencia SCTR</span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded-md font-black text-[9px] ${
                vigenciaOk ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
              }`}
            >
              {vigenciaOk ? 'VÁLIDA' : 'VENCIDA / OBS'}
            </span>
          </div>
          <div className="font-extrabold text-xs">
            {fechaMax ? `Vence: ${fechaMax}` : 'Sin fecha explícita'}
          </div>
          <span className="text-[10px] text-slate-500 block truncate" title={numeroPoliza ? `Póliza N° ${numeroPoliza}` : ''}>
            {numeroPoliza ? `Póliza N° ${numeroPoliza}` : (vigenciaOk ? 'Cubre fecha programada' : 'Verificar vencimiento')}
          </span>
        </div>

        {/* Coincidencia de Trabajo */}
        <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Concordancia con Trabajo</span>
          </div>
          <div className="flex items-center gap-1.5">
            {(() => {
              const nivel = coincidencia?.nivel || coincidencia?.nivel_coincidencia || 'ESTÁNDAR';
              const isAlto = nivel === 'ALTA' || nivel === 'ALTO';
              const isMedio = nivel === 'MEDIA' || nivel === 'MEDIO';
              return (
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                    isAlto
                      ? 'bg-emerald-100 text-emerald-900'
                      : isMedio
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {nivel}
                </span>
              );
            })()}
          </div>
          <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight" title={coincidencia?.detalle || coincidencia?.motivo}>
            {coincidencia?.detalle || coincidencia?.motivo || 'Evaluación de riesgos coherente.'}
          </p>
        </div>

        {/* Personal Acreditado / Nómina */}
        <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Personal Acreditado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-slate-900">
              {totalValidados} / {totalEsperados}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                totalValidados >= totalEsperados && totalEsperados > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {totalValidados >= totalEsperados && totalEsperados > 0 ? '100% Validado' : 'Pendiente / Cruce'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block">DNIs cotejados en archivo</span>
        </div>
      </div>

      {/* Documentos del Expediente Detectados por la IA */}
      {dictamen.documentos_detectados && dictamen.documentos_detectados.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-brand-600" />
            Expediente detectado:
          </span>
          {dictamen.documentos_detectados.map((doc, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px] flex items-center gap-1 shadow-2xs"
            >
              <Check className="w-3 h-3 text-emerald-600" />
              <span>{doc}</span>
            </span>
          ))}
        </div>
      )}

      {/* Riesgos Detectados (Chips) */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Riesgos identificados:
        </span>
        {riesgos.length > 0 ? (
          riesgos.map((r, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[10px]"
            >
              {r}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-slate-400 italic">Sin riesgos críticos detectados</span>
        )}
      </div>

      {/* Sección Expandida: Detalle del Personal Cotejado */}
      {expandedDetails && (
        <div className="pt-3 border-t border-slate-200/80 space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Personal Validado */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Personal Encontrado en el Documento ({personalVal.length}):
                </span>
              </div>
              {personalVal.length > 0 ? (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-[11px]">
                  {personalVal.map((p, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-800 truncate">
                        {p.nombre || 'Nombre no aislado'}
                      </div>
                      <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                        DNI {p.dni}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No se aislaron nombres asociados a DNIs en el documento.</p>
              )}
            </div>

            {/* DNIs Faltantes */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  DNIs Esperados NO Hallados ({dnisFaltantes.length}):
                </span>
              </div>
              {dnisFaltantes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {dnisFaltantes.map((dni, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-[10px]"
                    >
                      DNI {dni}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Todos los trabajadores registrados figuran en la documentación.
                </p>
              )}
            </div>
          </div>

          {/* Formato y Fuente */}
          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
            <span>
              Formato procesado: <strong className="text-slate-600 uppercase">{formato}</strong> (Memoria directa / 0 costos API)
            </span>
            {dictamen.fecha_inspeccion && (
              <span>Inspeccionado: {new Date(dictamen.fecha_inspeccion).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

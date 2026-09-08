import React, { useState, useEffect } from 'react';
import {
  Search,
  Building,
  Calendar,
  Clock,
  Mail,
  Phone,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  Sparkles,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatTimeRange, formatDateFull, formatDateShort } from '../../utils/formatters';
import { api } from '../../api/client';

export default function TrackingView({ initialSearchQuery = '' }) {
  const [query, setQuery] = useState(initialSearchQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (initialSearchQuery) {
      setQuery(initialSearchQuery);
      executeSearch(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const executeSearch = async (searchTerm) => {
    const term = searchTerm.trim();
    if (!term) return;

    setLoading(true);
    setErrorMessage('');
    setSearched(true);

    try {
      const data = await api.getSeguimiento(term);
      setResults(data);
    } catch (err) {
      setErrorMessage(err.message || 'Error al consultar el seguimiento.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-brand-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-800 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
          Módulo de Consulta Pública (RF-01.4)
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Consultar Estado de Solicitud
        </h2>
        <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
          Ingrese el código de trámite (ej. <code className="text-brand-300 font-mono">EVT-2026-X89F</code>) o el correo institucional con el que realizó el registro para consultar el dictamen de la Jefatura de Operaciones.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="pt-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Código de ticket (EVT-...) o Correo institucional (@continental.edu.pe)"
                className="w-full bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-slate-400 border border-white/20 focus:border-white rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3.5 bg-brand-500 hover:bg-brand-400 text-white text-sm font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Consultar</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Search Tips */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
          <span>Ejemplos rápidos:</span>
          <button
            type="button"
            onClick={() => {
              setQuery('EVT-2026-X89F');
              executeSearch('EVT-2026-X89F');
            }}
            className="font-mono bg-white/10 hover:bg-white/20 text-brand-200 px-2 py-0.5 rounded transition-colors"
          >
            EVT-2026-X89F
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('j.morales@continental.edu.pe');
              executeSearch('j.morales@continental.edu.pe');
            }}
            className="font-mono bg-white/10 hover:bg-white/20 text-brand-200 px-2 py-0.5 rounded transition-colors"
          >
            j.morales@continental.edu.pe
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Results List */}
      {searched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 px-2">
            <span>Resultados encontrados: {results.length}</span>
          </div>

          {results.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-base">
                No se encontraron solicitudes
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No se hallaron registros coincidentes con &quot;{query}&quot;. Verifique que el código o correo institucional sean correctos.
              </p>
            </div>
          ) : (
            results.map((sol) => (
              <div
                key={sol.id}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 hover:border-slate-300 transition-all"
              >
                {/* Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-lg text-brand-700">
                        {sol.codigo_ticket}
                      </span>
                      <span className="text-xs text-slate-400">
                        • Registrado el {formatDateShort(sol.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      Área: <strong className="text-slate-900">{sol.area_solicitante}</strong>
                    </p>
                  </div>

                  <StatusBadge status={sol.estado} />
                </div>

                {/* Event Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building className="w-4 h-4 text-brand-600 shrink-0" />
                      <span>
                        Espacio:{' '}
                        <strong className="text-slate-900 text-sm">{sol.ambiente_nombre}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
                      <span>{formatDateFull(sol.fecha_inicio)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock className="w-4 h-4 text-brand-600 shrink-0" />
                      <span className="font-semibold text-slate-900">
                        {formatTimeRange(sol.fecha_inicio, sol.fecha_fin)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{sol.correo_solicitante}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{sol.telefono}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className={`w-4 h-4 shrink-0 ${
                          sol.protocolo_ssoma ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <span className={sol.protocolo_ssoma ? 'text-emerald-800 font-medium' : 'text-slate-500'}>
                        {sol.protocolo_ssoma ? 'Protocolo SSOMA validado' : 'Sin protocolo especial SSOMA'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recursos y Ruteo Interno (RN-04) */}
                {sol.recursos && sol.recursos.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Desglose de Recursos y Ruteo Operativo (RN-04)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sol.recursos.map((rec, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                        >
                          <span className="font-semibold text-slate-800">
                            {rec.cantidad} × {rec.nombre}
                          </span>
                          <span className="text-[11px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded font-medium border border-brand-100">
                            {rec.area_destino_nombre}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Motivo de Rechazo (si la solicitud fue rechazada) */}
                {sol.estado === 'RECHAZADO' && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <span className="font-bold text-rose-900 block text-sm">
                        Solicitud Denegada por Jefatura de Operaciones
                      </span>
                      <p className="text-rose-800 leading-relaxed font-medium">
                        <strong>Motivo del rechazo:</strong>{' '}
                        {sol.motivo_rechazo || 'No se especificó un motivo adicional. Para mayor detalle, comuníquese con la Jefatura de Operaciones.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

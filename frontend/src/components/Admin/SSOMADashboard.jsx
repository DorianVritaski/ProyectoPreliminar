import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  FileText,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  LogOut,
  Building,
  Calendar,
  Clock,
  Mail,
  Phone,
  Layers,
  Save,
  Loader2,
  Info,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatTimeRange, formatDateFull, formatDateShort } from '../../utils/formatters';

export default function SSOMADashboard({ adminUser, onLogout, onRefreshPublicData }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null); // { message, type: 'success' | 'error' }
  const [filterTab, setFilterTab] = useState('TODAS'); // 'TODAS' | 'PENDIENTES' | 'CONFORMES' | 'OBSERVADAS'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null); // id de solicitud en proceso

  // Estado local para los lineamientos editables por tarjeta de solicitud
  const [localLineamientos, setLocalLineamientos] = useState({}); // { [solicitudId]: string }

  // Modal para registrar u observar solicitud
  const [observingSol, setObservingSol] = useState(null); // solicitud objeto
  const [observacionTexto, setObservacionTexto] = useState('');

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadSolicitudesSSOMA = async () => {
    setLoading(true);
    try {
      // Traer todas las solicitudes para filtrar las que requieren SSOMA
      const data = await api.adminGetSolicitudes(null, null);
      // Bandeja filtrada: únicamente solicitudes donde requiere_ssoma = TRUE
      const filtradas = data.filter((s) => Boolean(s.requiere_ssoma));
      setSolicitudes(filtradas);

      // Inicializar lineamientos locales
      const initialMap = {};
      filtradas.forEach((s) => {
        initialMap[s.id] = s.lineamientos_ssoma || '';
      });
      setLocalLineamientos(initialMap);
    } catch (err) {
      showFeedback(err.message || 'Error al cargar solicitudes de SSOMA.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSolicitudesSSOMA();
  }, []);

  // Obtener la conformidad de SSOMA (área 7 o fallback nombre) para una solicitud dada
  const getSSOMAConformidad = (sol) => {
    if (!sol.conformidades) return null;
    return (
      sol.conformidades.find(
        (c) => c.area_destino_id === 7 || c.area_destino_nombre?.toUpperCase().includes('SSOMA') || c.area_destino_id === 3
      ) || null
    );
  };

  // Manejador para Dar Conformidad SSOMA
  const handleGiveConformidadSSOMA = async (sol) => {
    const conf = getSSOMAConformidad(sol);
    const lineamientos = (localLineamientos[sol.id] || '').trim();
    const targetAreaId = conf?.area_destino_id || (adminUser?.area_destino_id === 3 ? 7 : adminUser?.area_destino_id) || 7;

    setActionInProgress(sol.id);
    try {
      // Registrar conformidad técnica (CONFORME) y guardar lineamientos
      await api.adminUpdateConformidad(sol.id, targetAreaId, {
        estado: 'CONFORME',
        usuario_admin_id: adminUser?.id,
        lineamientos_ssoma: lineamientos || null,
      });

      showFeedback(`Conformidad SSOMA otorgada exitosamente para ${sol.codigo_ticket}.`);
      await loadSolicitudesSSOMA();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message || 'Error al registrar conformidad SSOMA.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Manejador para Guardar solo Lineamientos
  const handleSaveLineamientos = async (solId) => {
    const lineamientos = (localLineamientos[solId] || '').trim();
    setActionInProgress(solId);
    try {
      await api.adminUpdateLineamientosSSOMA(solId, lineamientos);
      showFeedback('Lineamientos y normas de seguridad guardados correctamente.');
      await loadSolicitudesSSOMA();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message || 'Error al guardar lineamientos.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Abrir modal de Observación
  const handleOpenObservar = (sol) => {
    const conf = getSSOMAConformidad(sol);
    setObservingSol(sol);
    setObservacionTexto(conf?.observacion || '');
  };

  // Guardar Observación
  const handleSubmitObservacion = async (e) => {
    e.preventDefault();
    if (!observingSol) return;
    const solId = observingSol.id;
    const conf = getSSOMAConformidad(observingSol);
    const lineamientos = (localLineamientos[solId] || '').trim();
    const targetAreaId = conf?.area_destino_id || (adminUser?.area_destino_id === 3 ? 7 : adminUser?.area_destino_id) || 7;

    setActionInProgress(solId);
    try {
      await api.adminUpdateConformidad(solId, targetAreaId, {
        estado: 'OBSERVADO',
        observacion: observacionTexto.trim(),
        usuario_admin_id: adminUser?.id,
        lineamientos_ssoma: lineamientos || null,
      });

      showFeedback(`Observación técnica de SSOMA registrada para ${observingSol.codigo_ticket}.`);
      setObservingSol(null);
      setObservacionTexto('');
      await loadSolicitudesSSOMA();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message || 'Error al registrar la observación.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Métricas
  const stats = useMemo(() => {
    const total = solicitudes.length;
    let pendientes = 0;
    let conformes = 0;
    let observadas = 0;

    solicitudes.forEach((s) => {
      const conf = getSSOMAConformidad(s);
      if (!conf || conf.estado === 'PENDIENTE') pendientes++;
      else if (conf.estado === 'CONFORME') conformes++;
      else if (conf.estado === 'OBSERVADO') observadas++;
    });

    return { total, pendientes, conformes, observadas };
  }, [solicitudes]);

  // Filtrado de solicitudes
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((s) => {
      const conf = getSSOMAConformidad(s);
      const confEstado = conf?.estado || 'PENDIENTE';

      // Filtro por pestaña
      if (filterTab === 'PENDIENTES' && confEstado !== 'PENDIENTE') return false;
      if (filterTab === 'CONFORMES' && confEstado !== 'CONFORME') return false;
      if (filterTab === 'OBSERVADAS' && confEstado !== 'OBSERVADO') return false;

      // Filtro por búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ticket = (s.codigo_ticket || '').toLowerCase();
        const correo = (s.correo_solicitante || '').toLowerCase();
        const ambiente = (s.ambiente_nombre || '').toLowerCase();
        const area = (s.area_solicitante || '').toLowerCase();
        if (!ticket.includes(q) && !correo.includes(q) && !ambiente.includes(q) && !area.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [solicitudes, filterTab, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner SSOMA */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-emerald-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Dashboard Operativo SSOMA
              </span>
              <span className="text-xs text-slate-400">
                • Seguridad Ocupacional y Medio Ambiente
              </span>
            </div>
            <h2 className="text-xl font-bold mt-0.5">
              Evaluación de Proveedores Externos y Conformidad SSOMA
            </h2>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white">{adminUser?.nombre || 'Supervisor SSOMA'}</div>
            <div className="text-[11px] text-slate-400">{adminUser?.email || adminUser?.correo}</div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-sm font-medium flex items-center gap-3 shadow-lg animate-in fade-in duration-200 border ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Con Proveedores Externos</div>
            <div className="text-xl font-extrabold text-slate-900">{stats.total}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <Clock3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Pendientes SSOMA</div>
            <div className="text-xl font-extrabold text-amber-700">{stats.pendientes}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Conformidades Otorgadas</div>
            <div className="text-xl font-extrabold text-emerald-700">{stats.conformes}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Con Observación Activa</div>
            <div className="text-xl font-extrabold text-rose-700">{stats.observadas}</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {[
            { id: 'TODAS', label: `Todas (${stats.total})` },
            { id: 'PENDIENTES', label: `Pendientes (${stats.pendientes})` },
            { id: 'CONFORMES', label: `Conformes (${stats.conformes})` },
            { id: 'OBSERVADAS', label: `Observadas (${stats.observadas})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ticket o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Cargando requerimientos de SSOMA...</p>
        </div>
      ) : solicitudesFiltradas.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No hay solicitudes en esta bandeja</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No se encontraron resultados que coincidan con la búsqueda.'
              : 'No hay solicitudes pendientes con protocolo SSOMA en el filtro seleccionado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {solicitudesFiltradas.map((sol) => {
            const confSSOMA = getSSOMAConformidad(sol);
            const estadoSSOMA = confSSOMA?.estado || 'PENDIENTE';
            const isConforme = estadoSSOMA === 'CONFORME';
            const isObservado = estadoSSOMA === 'OBSERVADO';
            const isBusy = actionInProgress === sol.id;

            return (
              <div
                key={sol.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden p-6 space-y-5"
              >
                {/* Header Card */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-base text-slate-900 tracking-wider">
                        {sol.codigo_ticket}
                      </span>
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          isConforme
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : isObservado
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        SSOMA: {estadoSSOMA}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200">
                        Estado General: {sol.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{sol.ambiente_nombre}</span>
                      <span>•</span>
                      <span>{sol.area_solicitante}</span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="text-right space-y-0.5">
                    <div className="text-xs font-bold text-slate-800 flex items-center md:justify-end gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{formatDateFull(sol.fecha_inicio)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center md:justify-end gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatTimeRange(sol.fecha_inicio, sol.fecha_fin)}</span>
                    </div>
                  </div>
                </div>

                {/* Requester Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">{sol.correo_solicitante}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Tel: {sol.telefono}</span>
                  </div>
                  {sol.detalles && (
                    <div className="col-span-full pt-1 text-slate-700 border-t border-slate-200/60">
                      <span className="font-bold text-slate-500 text-[10px] uppercase block">
                        Detalles del Requerimiento:
                      </span>
                      <p className="mt-0.5 whitespace-pre-line">{sol.detalles}</p>
                    </div>
                  )}
                </div>

                {/* Documentos Adjuntos de Proveedores Externos (PDFs) */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/90 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      Documentación de Proveedores Externos Adjunta:
                    </span>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                      Protocolo SSOMA Activo
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Botón SCTR */}
                    {sol.url_sctr_pdf ? (
                      <button
                        type="button"
                        onClick={() => window.open(api.getFileUrl(sol.url_sctr_pdf), '_blank')}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 text-xs font-bold transition-all shadow-sm group"
                      >
                        <FileText className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span>Ver Documento SCTR (PDF)</span>
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    ) : (
                      <span className="text-xs text-rose-700 italic flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> SCTR no adjunto
                      </span>
                    )}

                    {/* Botón Lista Personal Externo */}
                    {sol.url_personal_externo_pdf ? (
                      <button
                        type="button"
                        onClick={() => window.open(api.getFileUrl(sol.url_personal_externo_pdf), '_blank')}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 text-xs font-bold transition-all shadow-sm group"
                      >
                        <FileText className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span>Ver Lista de Personal Externo (PDF)</span>
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    ) : (
                      <span className="text-xs text-rose-700 italic flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Lista de personal no adjunta
                      </span>
                    )}

                    {/* Croquis si existe */}
                    {sol.croquis_url && (
                      <button
                        type="button"
                        onClick={() => window.open(sol.croquis_url, '_blank')}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold transition-all shadow-sm"
                      >
                        <span>🗺️ Croquis de Mobiliario (Drive)</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Historial de Observación de SSOMA (Visible siempre con su contexto) */}
                {confSSOMA?.observacion && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs space-y-1.5 border transition-all ${
                      isConforme
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-1.5">
                        {isConforme ? (
                          <Info className="w-4 h-4 text-amber-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>
                          {isConforme
                            ? 'Nota de observación previa (atendida con la conformidad):'
                            : 'Observación técnica activa de SSOMA:'}
                        </span>
                        {confSSOMA.aprobado_por_nombre && (
                          <span
                            className={`text-[11px] font-normal ${
                              isConforme ? 'text-amber-700' : 'text-rose-700'
                            }`}
                          >
                            — registrado por {confSSOMA.aprobado_por_nombre}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                          isConforme
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {isConforme ? 'Conformidad Otorgada ✓' : 'Observación Activa'}
                      </span>
                    </div>
                    <p
                      className={`whitespace-pre-line leading-relaxed font-medium pl-5 ${
                        isConforme ? 'text-amber-900' : 'text-rose-800'
                      }`}
                    >
                      {confSSOMA.observacion}
                    </p>
                  </div>
                )}

                {/* Formulario de Lineamientos y Normas de Seguridad SSOMA */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Lineamientos y Normas de Seguridad para el Evento (SSOMA):
                    </label>
                    {sol.lineamientos_ssoma && (
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        Lineamientos Registrados ✓
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Escriba las directivas de seguridad para este evento (ej. uso de EPP obligatorio, aforo restringido, prohibición de bloquear rutas de evacuación, horarios autorizados para proveedores externos)..."
                    value={localLineamientos[sol.id] ?? ''}
                    onChange={(e) =>
                      setLocalLineamientos((prev) => ({ ...prev, [sol.id]: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400 leading-relaxed font-medium"
                  />

                  {/* Acciones SSOMA */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSaveLineamientos(sol.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5 text-slate-500" />
                      <span>Guardar Lineamientos</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleOpenObservar(sol)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                          confSSOMA?.observacion
                            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                        } disabled:opacity-50`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{confSSOMA?.observacion ? 'Editar Observación' : 'Observar Solicitud'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleGiveConformidadSSOMA(sol)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 ${
                          isConforme
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/25'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        }`}
                      >
                        {isBusy ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Procesando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isConforme ? 'Conformidad SSOMA Otorgada ✓' : 'Dar Conformidad SSOMA'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Observación SSOMA */}
      {observingSol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-rose-300">
                    Protocolo SSOMA
                  </span>
                  <h3 className="text-base font-bold">Observar Requerimiento</h3>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitObservacion} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <div>
                  <span className="font-semibold text-slate-500">Solicitud:</span>{' '}
                  <strong className="font-mono text-slate-900">{observingSol.codigo_ticket}</strong>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Solicitante:</span>{' '}
                  {observingSol.correo_solicitante}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo o Detalle de la Observación de Seguridad:
                </label>
                <textarea
                  rows={4}
                  required
                  value={observacionTexto}
                  onChange={(e) => setObservacionTexto(e.target.value)}
                  placeholder="Especifique la observación (ej. Documento SCTR ilegible o vencido, la nómina de personal no incluye números de DNI, falta comprobante de EPP adecuado)..."
                  className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-medium leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setObservingSol(null);
                    setObservacionTexto('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!observacionTexto.trim() || actionInProgress}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Guardar Observación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

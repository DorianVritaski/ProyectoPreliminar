import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  ShieldCheck,
  ShieldAlert,
  FileText,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Clock,
  Calendar,
  Building,
  Users,
  HardHat,
  Lock,
  Save,
  Loader2,
  AlertCircle,
  Eye,
  Check,
  MapPin,
  Mail,
  UserCheck
} from 'lucide-react';
import { api } from '../../api/client';
import { formatTimeRange, formatDateShort } from '../../utils/formatters';

export default function SSOMAAccesosTab({ adminUser, showFeedback }) {
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('TODAS'); // 'TODAS' | 'CON_RIESGO' | 'ESTANDAR' | 'PENDIENTES' | 'AUTORIZADOS' | 'OBSERVADOS'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null);

  // Lineamientos locales editables por tarjeta
  const [localLineamientos, setLocalLineamientos] = useState({});

  // Modal para observar SCTR / Solicitud de acceso
  const [observingAcceso, setObservingAcceso] = useState(null);
  const [observacionTexto, setObservacionTexto] = useState('');

  const loadAccesos = async () => {
    setLoading(true);
    try {
      const data = await api.getAccesos();
      setAccesos(data || []);

      const initialMap = {};
      (data || []).forEach((acc) => {
        initialMap[acc.id] = acc.lineamientos_ssoma || '';
      });
      setLocalLineamientos(initialMap);
    } catch (err) {
      showFeedback?.(err.message || 'Error al cargar solicitudes de acceso.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccesos();
  }, []);

  // Métricas para SSOMA
  const stats = useMemo(() => {
    const total = accesos.length;
    const conRiesgo = accesos.filter((a) => Boolean(a.requiere_ssoma_riesgo)).length;
    const estandar = accesos.filter((a) => !a.requiere_ssoma_riesgo).length;
    const pendientes = accesos.filter((a) => a.estado === 'PENDIENTE').length;
    const autorizados = accesos.filter((a) => a.estado === 'AUTORIZADO').length;
    const observados = accesos.filter((a) => a.estado === 'OBSERVADO').length;
    return { total, conRiesgo, estandar, pendientes, autorizados, observados };
  }, [accesos]);

  // Filtrado reactivo
  const filteredAccesos = useMemo(() => {
    return accesos.filter((acc) => {
      // Filtro por pestaña
      if (filterTab === 'CON_RIESGO' && !acc.requiere_ssoma_riesgo) return false;
      if (filterTab === 'ESTANDAR' && acc.requiere_ssoma_riesgo) return false;
      if (filterTab === 'PENDIENTES' && acc.estado !== 'PENDIENTE') return false;
      if (filterTab === 'AUTORIZADOS' && acc.estado !== 'AUTORIZADO') return false;
      if (filterTab === 'OBSERVADOS' && acc.estado !== 'OBSERVADO') return false;

      // Filtro por búsqueda
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const codigo = (acc.codigo_acceso || '').toLowerCase();
        const anfitrion = (acc.anfitrion_correo || '').toLowerCase() + (acc.anfitrion_nombre || '').toLowerCase();
        const motivo = (acc.motivo || '').toLowerCase();
        const ubicacion = (acc.ubicacion_especifica || '').toLowerCase();
        const visitantesStr = JSON.stringify(acc.visitantes || []).toLowerCase();

        return (
          codigo.includes(query) ||
          anfitrion.includes(query) ||
          motivo.includes(query) ||
          ubicacion.includes(query) ||
          visitantesStr.includes(query)
        );
      }

      return true;
    });
  }, [accesos, filterTab, searchQuery]);

  // Handler: Autorizar Acceso (Caso A)
  const handleAutorizarAcceso = async (acc) => {
    const lineamientos = (localLineamientos[acc.id] || '').trim();
    setActionInProgress(acc.id);
    try {
      await api.adminUpdateAccesoSSOMA(acc.id, {
        estado: 'AUTORIZADO',
        lineamientos_ssoma: lineamientos || null,
        observacion_ssoma: null,
      });
      showFeedback?.(`Acceso ${acc.codigo_acceso} AUTORIZADO exitosamente. Pase de acceso habilitado.`);
      await loadAccesos();
    } catch (err) {
      showFeedback?.(err.message || 'Error al autorizar acceso.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Handler: Guardar Lineamientos (Caso B o edición)
  const handleSaveLineamientos = async (acc) => {
    const lineamientos = (localLineamientos[acc.id] || '').trim();
    setActionInProgress(acc.id);
    try {
      await api.adminUpdateAccesoSSOMA(acc.id, {
        estado: acc.estado,
        lineamientos_ssoma: lineamientos || null,
      });
      showFeedback?.(`Lineamientos de seguridad guardados para ${acc.codigo_acceso}.`);
      await loadAccesos();
    } catch (err) {
      showFeedback?.(err.message || 'Error al guardar lineamientos.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Handler: Abrir modal de Observación
  const handleOpenObservar = (acc) => {
    setObservingAcceso(acc);
    setObservacionTexto(acc.observacion_ssoma || '');
  };

  // Handler: Guardar Observación (Caso A)
  const handleSubmitObservacion = async (e) => {
    e.preventDefault();
    if (!observingAcceso) return;
    const accId = observingAcceso.id;
    const lineamientos = (localLineamientos[accId] || '').trim();
    setActionInProgress(accId);
    try {
      await api.adminUpdateAccesoSSOMA(accId, {
        estado: 'OBSERVADO',
        observacion_ssoma: observacionTexto.trim(),
        lineamientos_ssoma: lineamientos || null,
      });
      showFeedback?.(`Solicitud ${observingAcceso.codigo_acceso} marcada como OBSERVADA.`);
      setObservingAcceso(null);
      setObservacionTexto('');
      await loadAccesos();
    } catch (err) {
      showFeedback?.(err.message || 'Error al observar solicitud.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Bar Accesos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Ticket className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Solicitudes Acceso</div>
            <div className="text-xl font-extrabold text-slate-900">{stats.total}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <HardHat className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Trabajos de Riesgo (SCTR)</div>
            <div className="text-xl font-extrabold text-amber-700">{stats.conRiesgo}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Pases Autorizados</div>
            <div className="text-xl font-extrabold text-emerald-700">{stats.autorizados}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Observados / Pendientes</div>
            <div className="text-xl font-extrabold text-rose-700">{stats.pendientes + stats.observados}</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filtros y Buscador */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Pestañas de Filtro */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {[
            { id: 'TODAS', label: `Todas (${stats.total})` },
            { id: 'CON_RIESGO', label: `⚠️ Con Riesgo / SCTR (${stats.conRiesgo})` },
            { id: 'ESTANDAR', label: `Visitas Estándar (${stats.estandar})` },
            { id: 'PENDIENTES', label: `Pendientes (${stats.pendientes})` },
            { id: 'AUTORIZADOS', label: `Autorizados (${stats.autorizados})` },
            { id: 'OBSERVADOS', label: `Observados (${stats.observados})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por pase ACC, visitante, DNI o anfitrión..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-all font-medium"
          />
        </div>
      </div>

      {/* Contenido: Lista de Solicitudes de Acceso */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          <span className="text-sm font-semibold">Cargando solicitudes de acceso...</span>
        </div>
      ) : filteredAccesos.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-500 space-y-2">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-sm text-slate-700">No se encontraron solicitudes de acceso con este filtro</p>
          <p className="text-xs text-slate-400">Intente modificando la búsqueda o el filtro activo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredAccesos.map((acc) => {
            const isRiesgo = Boolean(acc.requiere_ssoma_riesgo);
            const isAutorizado = acc.estado === 'AUTORIZADO';
            const isObservado = acc.estado === 'OBSERVADO';
            const isPendiente = acc.estado === 'PENDIENTE';
            const isBusy = actionInProgress === acc.id;
            const visitantes = acc.visitantes || [];

            return (
              <div
                key={acc.id}
                className={`bg-white rounded-3xl border p-6 shadow-sm transition-all space-y-5 ${
                  isObservado
                    ? 'border-rose-300 hover:border-rose-400'
                    : isPendiente && isRiesgo
                    ? 'border-amber-300 hover:border-amber-400 ring-1 ring-amber-400/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200">
                      {acc.codigo_acceso}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>{acc.motivo}</span>
                        {isRiesgo ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300 flex items-center gap-1">
                            <HardHat className="w-3 h-3 text-amber-700" />
                            Trabajo de Riesgo (Apartado 3)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">
                            Visita Estándar / Académica
                          </span>
                        )}
                      </h3>
                      <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>Anfitrión: <strong className="text-slate-700">{acc.anfitrion_nombre || acc.anfitrion_correo}</strong></span>
                        {acc.anfitrion_area && <span>• {acc.anfitrion_area}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        isAutorizado
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isObservado
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isAutorizado ? 'AUTORIZADO ✓' : isObservado ? 'OBSERVADO ⚠️' : 'PENDIENTE DE REVISIÓN'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Registrado: {formatDateShort(acc.created_at, true)}
                    </span>
                  </div>
                </div>

                {/* Ubicación y Fechas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 block uppercase font-semibold text-[10px]">Sede y Campus</span>
                    <strong className="text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                      <Building className="w-4 h-4 text-brand-600 shrink-0" />
                      {acc.sede}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block uppercase font-semibold text-[10px]">Ubicación en Campus</span>
                    <strong className="text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      {acc.ubicacion_especifica}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block uppercase font-semibold text-[10px]">Horario de Ingreso Autorizado</span>
                    <span className="text-slate-800 font-bold block mt-0.5">
                      {formatDateShort(acc.fecha_inicio)} • {formatTimeRange(acc.fecha_inicio, acc.fecha_fin)}
                    </span>
                  </div>
                </div>

                {/* SECCIÓN DIFERENCIADA SSOMA */}
                {isRiesgo ? (
                  /* CASO A: TRABAJOS DE RIESGO / PROVEEDORES */
                  <div className="space-y-4">
                    {/* Alerta de Caso A */}
                    <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-950">
                      <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold uppercase text-amber-950 text-xs">
                            Caso A: Proveedor Externo / Trabajo de Riesgo
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-bold">
                            Revisión de SCTR Obligatoria
                          </span>
                        </div>
                        <p className="text-amber-900 leading-relaxed font-medium">
                          Verifique la póliza SCTR y la nómina de personal antes de autorizar.
                          El pase de acceso permanece <strong>BLOQUEADO</strong> en garita hasta que emita la autorización.
                        </p>
                      </div>
                    </div>

                    {/* Documentos SCTR y Personal */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-brand-600" />
                        Documentación de Seguridad Adjunta (SCTR y Personal):
                      </span>

                      <div className="flex flex-wrap items-center gap-3">
                        {acc.url_sctr_pdf ? (
                          <button
                            type="button"
                            onClick={() => window.open(api.getFileUrl(acc.url_sctr_pdf), '_blank')}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 text-xs font-bold transition-all shadow-xs"
                          >
                            <FileText className="w-4 h-4 text-brand-600" />
                            <span>Póliza SCTR (PDF)</span>
                            <ExternalLink className="w-3.5 h-3.5 text-brand-600" />
                          </button>
                        ) : (
                          <span className="text-xs text-rose-700 italic flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> Sin póliza SCTR adjunta
                          </span>
                        )}

                        {acc.url_lista_personal_pdf ? (
                          <button
                            type="button"
                            onClick={() => window.open(api.getFileUrl(acc.url_lista_personal_pdf), '_blank')}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition-all shadow-xs"
                          >
                            <FileText className="w-4 h-4 text-emerald-600" />
                            <span>Nómina de Personal (PDF)</span>
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            Sin PDF adicional de nómina (revisar lista abajo)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* CASO B: VISITA ESTÁNDAR / ACADÉMICA */
                  <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-950">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold uppercase text-blue-950 text-xs">
                          Caso B: Visita Estándar / Ponente Académico
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-200 text-blue-900 text-[10px] font-bold">
                          Autorizado Automático
                        </span>
                      </div>
                      <p className="text-blue-900 leading-relaxed font-medium">
                        No requiere revisión de póliza SCTR obligatoria. El aforo de visitantes queda registrado.
                        Puede ingresar lineamientos y directivas generales opcionales para la garita.
                      </p>
                    </div>
                  </div>
                )}

                {/* Lista de Visitantes / Nómina */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-brand-600" />
                      Visitantes / Personal Autorizado ({visitantes.length}):
                    </span>
                    {acc.check_in_realizado && (
                      <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ingreso registrado en garita
                      </span>
                    )}
                  </div>

                  {visitantes.length > 0 ? (
                    <div className="divide-y divide-slate-200/70 border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                      {visitantes.map((v, i) => (
                        <div key={v.id || i} className="p-2.5 px-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                              {i + 1}
                            </span>
                            <strong className="text-slate-800">{v.nombre}</strong>
                            <span className="text-slate-400 font-mono">DNI: {v.dni}</span>
                            {v.empresa && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                {v.empresa}
                              </span>
                            )}
                          </div>
                          {v.ingresado ? (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Ingresó a las {v.hora_ingreso || 'garita'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No ha ingresado</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Sin visitantes desglosados (acceso anfitrión directo).</p>
                  )}
                </div>

                {/* Banner de Observación Activa si existe */}
                {acc.observacion_ssoma && (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-1 text-rose-900">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        Observación Técnica Activa de SSOMA:
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 text-[10px]">
                        Acceso Bloqueado
                      </span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed font-medium pl-5 text-rose-800">
                      {acc.observacion_ssoma}
                    </p>
                  </div>
                )}

                {/* Formulario de Lineamientos SSOMA */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Lineamientos y Directivas de Seguridad para el Acceso (SSOMA):
                    </label>
                    {acc.lineamientos_ssoma && (
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        Lineamientos Registrados ✓
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    value={localLineamientos[acc.id] ?? ''}
                    onChange={(e) =>
                      setLocalLineamientos((prev) => ({ ...prev, [acc.id]: e.target.value }))
                    }
                    placeholder={
                      isRiesgo
                        ? 'Ingrese directivas de seguridad obligatorias (ej. uso obligatorio de casco y botas punta de acero, ruta autorizada de carga por portón 3)...'
                        : 'Recomendaciones operativas generales para la garita (ej. ingreso exclusivo por garita peatonal 2, portar credencial visible)...'
                    }
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium leading-relaxed"
                  />

                  {/* Acciones para SSOMA */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {/* Botón de solo guardar lineamientos */}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSaveLineamientos(acc)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5 text-slate-500" />
                      <span>Guardar Lineamientos</span>
                    </button>

                    {/* Acciones principales de autorización / observación */}
                    <div className="flex items-center gap-2">
                      {isRiesgo && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleOpenObservar(acc)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                            isObservado
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{acc.observacion_ssoma ? 'Editar Observación' : 'Observar SCTR'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy || (isAutorizado && !isObservado)}
                        onClick={() => handleAutorizarAcceso(acc)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 ${
                          isAutorizado && !isObservado
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                        }`}
                      >
                        {isBusy ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Procesando...</span>
                          </>
                        ) : isAutorizado && !isObservado ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Acceso Autorizado ✓</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>{isRiesgo ? 'Autorizar Acceso (Validar SCTR)' : 'Autorizar y Guardar'}</span>
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

      {/* Modal de Observación de SCTR / Acceso */}
      {observingAcceso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-rose-300">
                    Protocolo SSOMA — Control de Accesos
                  </span>
                  <h3 className="text-base font-bold">Observar SCTR / Requerimiento</h3>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitObservacion} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <div>
                  <span className="font-semibold text-slate-500">Pase:</span>{' '}
                  <strong className="font-mono text-slate-900">{observingAcceso.codigo_acceso}</strong>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Motivo:</span> {observingAcceso.motivo}
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Anfitrión:</span> {observingAcceso.anfitrion_correo}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motivo o Justificación de la Observación Técnica:
                </label>
                <textarea
                  rows={4}
                  required
                  value={observacionTexto}
                  onChange={(e) => setObservacionTexto(e.target.value)}
                  placeholder="Especifique el motivo (ej. La póliza SCTR adjunta no cubre el periodo de la actividad, no coincide el número de DNI de los trabajadores, falta firma médica autorizada)..."
                  className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all font-medium leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setObservingAcceso(null);
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
                  <span>Confirmar Observación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

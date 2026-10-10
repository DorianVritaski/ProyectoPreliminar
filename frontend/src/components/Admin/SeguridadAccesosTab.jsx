import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  ShieldCheck,
  ShieldAlert,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Building,
  HardHat,
  Search,
  Filter,
  Check,
  UserCheck,
  ExternalLink,
  Printer,
  AlertTriangle,
  AlertCircle,
  FileText,
  MapPin,
  RefreshCw,
  LogOut,
  ChevronDown,
  Layers,
  ArrowRight,
  UserX
} from 'lucide-react';
import { api } from '../../api/client';
import { formatDateShort, formatTimeRange } from '../../utils/formatters';

export default function SeguridadAccesosTab({ adminUser, showFeedback }) {
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDatePreset, setFilterDatePreset] = useState('TODAS'); // 'HOY' | 'MANANA' | 'TODAS'
  const [filterEstado, setFilterEstado] = useState('TODAS'); // 'TODAS' | 'AUTORIZADO' | 'PENDIENTE' | 'OBSERVADO' | 'CON_CHECKIN'
  const [actionInProgress, setActionInProgress] = useState(null);

  // Estados locales para los visitantes (para poder marcar check-in individual antes de guardar)
  const [localVisitantes, setLocalVisitantes] = useState({}); // { [accesoId]: Array<Visitor> }

  const loadAccesos = async () => {
    setLoading(true);
    try {
      const data = await api.getAccesos();
      setAccesos(data || []);

      // Mapear visitantes locales
      const map = {};
      (data || []).forEach((acc) => {
        map[acc.id] = Array.isArray(acc.visitantes) ? [...acc.visitantes] : [];
      });
      setLocalVisitantes(map);
    } catch (err) {
      showFeedback?.(err.message || 'Error al cargar los pases de acceso para garita.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccesos();
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Cálculos estadísticos para Garita y Aforo
  const stats = useMemo(() => {
    const total = accesos.length;
    let ingresadosCount = 0;
    let pendientesIngresoCount = 0;
    let bloqueadosCount = 0;

    accesos.forEach((acc) => {
      if (acc.estado === 'OBSERVADO' || (acc.estado === 'PENDIENTE' && acc.requiere_ssoma_riesgo)) {
        bloqueadosCount++;
      }
      const visList = acc.visitantes || [];
      const visIngresados = visList.filter((v) => Boolean(v.ingresado)).length;
      ingresadosCount += visIngresados;
      if (acc.estado === 'AUTORIZADO') {
        pendientesIngresoCount += (visList.length - visIngresados);
      }
    });

    return {
      total,
      ingresadosCount,
      pendientesIngresoCount,
      bloqueadosCount,
    };
  }, [accesos]);

  // Filtrado reactivo de pases
  const filteredAccesos = useMemo(() => {
    return accesos.filter((acc) => {
      // Filtro de fecha
      const fechaAcceso = (acc.fecha_inicio || '').split('T')[0];
      if (filterDatePreset === 'HOY' && fechaAcceso !== todayStr) return false;
      if (filterDatePreset === 'MANANA' && fechaAcceso !== tomorrowStr) return false;

      // Filtro de estado
      if (filterEstado === 'AUTORIZADO' && acc.estado !== 'AUTORIZADO') return false;
      if (filterEstado === 'PENDIENTE' && acc.estado !== 'PENDIENTE') return false;
      if (filterEstado === 'OBSERVADO' && acc.estado !== 'OBSERVADO') return false;
      if (filterEstado === 'CON_CHECKIN' && !acc.check_in_realizado) return false;

      // Búsqueda textual por código, anfitrión, motivo, o DNI/Nombre de visitantes
      if (searchQuery.trim()) {
        let q = searchQuery.toLowerCase().trim();
        if (q.includes('codigo=')) {
          const match = q.match(/codigo=([a-z0-9-]+)/);
          if (match) q = match[1];
        }
        const cod = (acc.codigo_acceso || '').toLowerCase();
        const anf = (acc.anfitrion_nombre || '').toLowerCase() + (acc.anfitrion_correo || '').toLowerCase();
        const mot = (acc.motivo || '').toLowerCase();
        const ubi = (acc.ubicacion_especifica || '').toLowerCase();
        const visJson = JSON.stringify(acc.visitantes || []).toLowerCase();

        if (!cod.includes(q) && !anf.includes(q) && !mot.includes(q) && !ubi.includes(q) && !visJson.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [accesos, filterDatePreset, filterEstado, searchQuery, todayStr, tomorrowStr]);

  // Manejador para alternar el ingreso individual de un visitante
  const handleToggleVisitorIngreso = (accesoId, visitorIndex) => {
    setLocalVisitantes((prev) => {
      const currentList = prev[accesoId] ? [...prev[accesoId]] : [];
      if (!currentList[visitorIndex]) return prev;

      const isIngresado = Boolean(currentList[visitorIndex].ingresado);
      const nowStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

      currentList[visitorIndex] = {
        ...currentList[visitorIndex],
        ingresado: !isIngresado,
        hora_ingreso: !isIngresado ? nowStr : null,
      };

      return {
        ...prev,
        [accesoId]: currentList,
      };
    });
  };

  // Manejador para registrar / guardar Check-in en Garita
  const handleSaveCheckIn = async (acceso) => {
    setActionInProgress(acceso.id);
    try {
      const updatedVisitors = localVisitantes[acceso.id] || acceso.visitantes || [];
      const anyIngresado = updatedVisitors.some((v) => Boolean(v.ingresado));

      await api.adminCheckInAcceso(acceso.id, {
        visitantes: updatedVisitors,
        check_in_realizado: anyIngresado,
      });

      showFeedback?.(`Check-in registrado exitosamente para el pase ${acceso.codigo_acceso}.`, 'success');
      await loadAccesos();
    } catch (err) {
      showFeedback?.(err.message || 'Error al guardar check-in en garita.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Manejador para marcar a TODOS los visitantes como ingresados rápidamente
  const handleCheckInAll = (accesoId) => {
    setLocalVisitantes((prev) => {
      const currentList = prev[accesoId] ? [...prev[accesoId]] : [];
      const nowStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

      const updated = currentList.map((v) => ({
        ...v,
        ingresado: true,
        hora_ingreso: v.hora_ingreso || nowStr,
      }));

      return {
        ...prev,
        [accesoId]: updated,
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Métricas de Garita en Tiempo Real */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Programados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Pases Registrados</div>
            <div className="text-xl font-extrabold text-slate-900">{stats.total}</div>
          </div>
        </div>

        {/* Personas en Campus (Live Aforo) */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Ingresados (En Campus)</div>
            <div className="text-xl font-extrabold text-emerald-700">{stats.ingresadosCount}</div>
          </div>
        </div>

        {/* Pendientes de Ingreso */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Pendientes de Ingreso</div>
            <div className="text-xl font-extrabold text-blue-700">{stats.pendientesIngresoCount}</div>
          </div>
        </div>

        {/* Bloqueados por SSOMA */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Bloqueados / Observados</div>
            <div className="text-xl font-extrabold text-rose-700">{stats.bloqueadosCount}</div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros y Búsqueda Operativa */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Preset de Fechas */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {[
            { id: 'HOY', label: 'Hoy' },
            { id: 'MANANA', label: 'Mañana' },
            { id: 'TODAS', label: 'Todas las Fechas' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setFilterDatePreset(preset.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterDatePreset === preset.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Filtro de Estado */}
        <div className="flex items-center gap-2">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="TODAS">Todos los Estados</option>
            <option value="AUTORIZADO">Solo Autorizados (Listos para pase)</option>
            <option value="PENDIENTE">Pendientes de SSOMA</option>
            <option value="OBSERVADO">Observados / Bloqueados</option>
            <option value="CON_CHECKIN">Con Ingreso Registrado</option>
          </select>
        </div>

        {/* Buscador Rápido (DNI, Código, Nombre) */}
        <div className="relative flex-1 md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por DNI, Nombre o Código ACC..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 3. Listado de Tarjetas de Pases de Acceso */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Consultando registros de accesos en garita...</p>
        </div>
      ) : filteredAccesos.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Ticket className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No se encontraron registros de acceso</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No hay pases que coincidan con los filtros seleccionados o la fecha especificada.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAccesos.map((acceso) => {
            const isCasoA = Boolean(acceso.requiere_ssoma_riesgo);
            const isAutorizado = acceso.estado === 'AUTORIZADO';
            const isObservado = acceso.estado === 'OBSERVADO';
            const isPendiente = acceso.estado === 'PENDIENTE';

            const visitors = localVisitantes[acceso.id] || acceso.visitantes || [];
            const ingresadosCount = visitors.filter((v) => Boolean(v.ingresado)).length;
            const canEnter = isAutorizado;

            return (
              <div
                key={acceso.id}
                className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  isObservado
                    ? 'border-rose-300 ring-1 ring-rose-100'
                    : isAutorizado
                    ? 'border-emerald-300'
                    : 'border-amber-300'
                }`}
              >
                {/* Cabecera de la Tarjeta del Pase */}
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        isObservado
                          ? 'bg-rose-100 text-rose-700'
                          : isAutorizado
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <Ticket className="w-6 h-6" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                          {acceso.codigo_acceso}
                        </span>

                        {/* Badge de Estado Operativo */}
                        {isAutorizado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>AUTORIZADO PARA INGRESO</span>
                          </span>
                        ) : isObservado ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>BLOQUEADO POR SSOMA (NO PERMITIR ACCESO)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>PENDIENTE REVISIÓN SSOMA</span>
                          </span>
                        )}

                        {/* Clasificación Caso A vs Caso B */}
                        {isCasoA ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <HardHat className="w-3 h-3 text-rose-600" />
                            <span>Trabajo de Riesgo / SCTR</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Users className="w-3 h-3 text-blue-600" />
                            <span>Visita Estándar / Ponente</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {acceso.motivo}
                      </h3>
                    </div>
                  </div>

                  {/* Resumen de Personas y Sede */}
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" />
                      <span className="font-semibold text-slate-900">{acceso.sede}</span>
                      <span className="text-slate-400">•</span>
                      <span>{acceso.ubicacion_especifica}</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-bold text-slate-900">{ingresadosCount}/{visitors.length}</span>
                      <span className="text-slate-500">en campus</span>
                    </div>
                  </div>
                </div>

                {/* Contenido: Datos del Anfitrión, Horario y Lineamientos */}
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
                    <div>
                      <span className="text-slate-400 block font-medium">Anfitrión Institucional:</span>
                      <span className="font-bold text-slate-900">{acceso.anfitrion_nombre}</span>
                      <span className="text-slate-500 block text-[11px]">{acceso.anfitrion_area}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Correo Electrónico:</span>
                      <span className="font-mono text-slate-800">{acceso.anfitrion_correo}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Horario Autorizado:</span>
                      <span className="font-bold text-slate-900">
                        {formatDateShort(acceso.fecha_inicio)} ({formatTimeRange(acceso.fecha_inicio, acceso.fecha_fin)})
                      </span>
                    </div>
                  </div>

                  {/* CAJA DESTACADA: LINEAMIENTOS OBLIGATORIOS DE SSOMA */}
                  {acceso.lineamientos_ssoma ? (
                    <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs uppercase tracking-wide">
                        <ShieldAlert className="w-4 h-4 text-amber-700" />
                        <span>Lineamientos de Seguridad y Protocolos SSOMA para Garita:</span>
                      </div>
                      <p className="text-xs text-amber-950 font-medium leading-relaxed bg-white/70 p-3 rounded-xl border border-amber-200/60">
                        {acceso.lineamientos_ssoma}
                      </p>
                      <p className="text-[11px] text-amber-800 italic">
                        * El oficial de garita debe exigir el cumplimiento estricto de estos lineamientos antes de autorizar el ingreso físico.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      <span>Sin lineamientos especiales adicionales de SSOMA registrados.</span>
                    </div>
                  )}

                  {/* OBSERVACIÓN ACTIVA DE SSOMA (SI ESTÁ OBSERVADO) */}
                  {isObservado && acceso.observacion_ssoma && (
                    <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs uppercase tracking-wide">
                        <AlertTriangle className="w-4 h-4 text-rose-700" />
                        <span>Motivo de Observación y Bloqueo de Acceso (SSOMA):</span>
                      </div>
                      <p className="text-xs text-rose-950 font-semibold bg-white/80 p-3 rounded-xl border border-rose-200">
                        {acceso.observacion_ssoma}
                      </p>
                    </div>
                  )}

                  {/* Acceso a Documentos SCTR y Nómina (PDFs) */}
                  <div className="flex flex-wrap items-center gap-3">
                    {acceso.url_sctr_pdf ? (
                      <a
                        href={acceso.url_sctr_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                        <span>Ver Póliza SCTR (PDF)</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Sin SCTR adjunto (No requerido)</span>
                    )}

                    {acceso.url_lista_personal_pdf && (
                      <a
                        href={acceso.url_lista_personal_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ver Nómina Oficial (PDF)</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}
                  </div>

                  {/* NÓMINA DE VISITANTES Y CONTROL DE CHECK-IN EN GARITA */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-700" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Nómina de Personas / Control Individual de Ingreso ({visitors.length})
                        </h4>
                      </div>

                      {canEnter && (
                        <button
                          type="button"
                          onClick={() => handleCheckInAll(acceso.id)}
                          className="text-[11px] font-bold text-brand-600 hover:text-brand-700 underline"
                        >
                          Marcar todos como ingresados
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-200/60">
                      {visitors.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No se registraron visitantes individuales en este pase.
                        </div>
                      ) : (
                        visitors.map((vis, idx) => {
                          const isIngresado = Boolean(vis.ingresado);

                          return (
                            <div
                              key={vis.id || idx}
                              className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                isIngresado ? 'bg-emerald-50/40' : 'hover:bg-slate-100/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    isIngresado
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {idx + 1}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                    <span>{vis.nombre}</span>
                                    {isIngresado && (
                                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                        Ingresó: {vis.hora_ingreso || 'Registrado'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    DNI: <strong className="text-slate-800">{vis.dni}</strong> • Empresa/Rol:{' '}
                                    <span className="text-slate-700">{vis.empresa || 'Visitante'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Toggle Check-in Individual */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!canEnter}
                                  onClick={() => handleToggleVisitorIngreso(acceso.id, idx)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    !canEnter
                                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                      : isIngresado
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-700'
                                  }`}
                                >
                                  {isIngresado ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>En Campus</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>Marcar Ingreso</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* BOTÓN GENERAL DE GUARDAR CHECK-IN EN GARITA */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                    <div>
                      {!canEnter ? (
                        <div className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          <span>
                            Acceso bloqueado en garita: Requiere autorización previa de SSOMA.
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          {acceso.check_in_realizado ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Pase con ingreso registrado en Garita
                            </span>
                          ) : (
                            <span>Al guardar, se actualizará el conteo de aforo en tiempo real.</span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!canEnter || actionInProgress === acceso.id}
                      onClick={() => handleSaveCheckIn(acceso)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                        !canEnter
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>
                        {actionInProgress === acceso.id
                          ? 'Guardando...'
                          : 'Guardar Registro de Garita'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

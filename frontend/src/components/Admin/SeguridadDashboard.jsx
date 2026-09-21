import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  Calendar,
  Clock,
  MapPin,
  Users,
  Phone,
  Mail,
  Building,
  FileText,
  ExternalLink,
  Printer,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Layers,
  ChevronDown,
  Info,
  UserCheck,
  Eye,
  X
} from 'lucide-react';
import { api } from '../../api/client';
import { formatTimeRange, formatDateFull, formatDateShort } from '../../utils/formatters';

export default function SeguridadDashboard({ adminUser, onLogout, onRefreshPublicData }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState({ text: '', type: '' });

  // -------------------------------------------------------------
  // Filtros Operativos para Seguridad
  // -------------------------------------------------------------
  const [filterEstado, setFilterEstado] = useState('APROBADO'); // 'APROBADO' (por defecto) | 'PENDIENTE' | 'RECHAZADO' | 'TODAS'
  const [filterFechaPreset, setFilterFechaPreset] = useState('HOY'); // 'HOY' | 'MANANA' | 'SEMANA' | 'TODAS' | 'CUSTOM'
  const [customDate, setCustomDate] = useState('');
  const [filterAmbienteId, setFilterAmbienteId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyExternalPersonnel, setOnlyExternalPersonnel] = useState(false);
  const [onlySecuritySupplies, setOnlySecuritySupplies] = useState(false);

  const showFeedback = (text, type = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage({ text: '', type: '' }), 4500);
  };

  // Cargar ambientes para el filtro
  const loadAmbientes = async () => {
    try {
      const data = await api.getAmbientes();
      setAmbientes(data || []);
    } catch (err) {
      console.error('Error cargando ambientes:', err);
    }
  };

  // Cargar todas las solicitudes del sistema (panel de monitoreo general)
  const loadSolicitudes = async () => {
    setLoading(true);
    try {
      // Seguridad Interna y Vigilancia tiene acceso a todas las solicitudes sin filtrado por área operativa
      const data = await api.adminGetSolicitudes(null, null);
      setSolicitudes(data || []);
    } catch (err) {
      console.error(err);
      showFeedback('Error al cargar la lista de solicitudes de eventos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAmbientes();
    loadSolicitudes();
  }, []);

  // Fechas de referencia local
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Función para determinar si una solicitud contiene insumos de seguridad
  const hasSecuritySupplies = (sol) => {
    if (!sol.recursos || sol.recursos.length === 0) return false;
    return sol.recursos.some((r) => {
      const nom = (r.nombre || '').toLowerCase();
      return (
        nom.includes('valla') ||
        nom.includes('acceso') ||
        nom.includes('resguardo') ||
        nom.includes('seguridad') ||
        nom.includes('vigilancia') ||
        r.area_destino_id === 3
      );
    });
  };

  // Filtrado reactivo en memoria para máxima velocidad de respuesta en campo
  const filteredSolicitudes = useMemo(() => {
    return solicitudes.filter((sol) => {
      // 1. Filtro por Estado
      if (filterEstado !== 'TODAS' && sol.estado !== filterEstado) {
        return false;
      }

      // 2. Filtro por Fecha
      const solDateStr = sol.fecha_inicio ? sol.fecha_inicio.split('T')[0] : '';
      if (filterFechaPreset === 'HOY') {
        if (solDateStr !== todayStr) return false;
      } else if (filterFechaPreset === 'MANANA') {
        if (solDateStr !== tomorrowStr) return false;
      } else if (filterFechaPreset === 'SEMANA') {
        const now = new Date();
        const solDate = new Date(sol.fecha_inicio);
        const dayDiff = (solDate - now) / (1000 * 60 * 60 * 24);
        if (dayDiff < -1 || dayDiff > 7) return false;
      } else if (filterFechaPreset === 'CUSTOM' && customDate) {
        if (solDateStr !== customDate) return false;
      }

      // 3. Filtro por Ambiente Físico
      if (filterAmbienteId && String(sol.ambiente_id) !== String(filterAmbienteId)) {
        return false;
      }

      // 4. Toggle: Solo con Personal Externo / SSOMA
      if (onlyExternalPersonnel && !sol.requiere_ssoma && !sol.protocolo_ssoma) {
        return false;
      }

      // 5. Toggle: Solo con Insumos de Seguridad
      if (onlySecuritySupplies && !hasSecuritySupplies(sol)) {
        return false;
      }

      // 6. Buscador de Texto (Ticket, Correo, Detalles, Ambiente, Solicitante)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchTicket = sol.codigo_ticket?.toLowerCase().includes(query);
        const matchCorreo = sol.correo_solicitante?.toLowerCase().includes(query);
        const matchDetalles = sol.detalles?.toLowerCase().includes(query);
        const matchAmbiente = sol.ambiente_nombre?.toLowerCase().includes(query);
        const matchArea = sol.area_solicitante?.toLowerCase().includes(query);
        if (!matchTicket && !matchCorreo && !matchDetalles && !matchAmbiente && !matchArea) {
          return false;
        }
      }

      return true;
    });
  }, [
    solicitudes,
    filterEstado,
    filterFechaPreset,
    customDate,
    filterAmbienteId,
    onlyExternalPersonnel,
    onlySecuritySupplies,
    searchQuery,
    todayStr,
    tomorrowStr,
  ]);

  // Contadores para métricas rápidas de seguridad
  const metrics = useMemo(() => {
    const totalHoy = solicitudes.filter(
      (s) => s.fecha_inicio && s.fecha_inicio.split('T')[0] === todayStr
    ).length;
    const aprobadosHoy = solicitudes.filter(
      (s) => s.fecha_inicio && s.fecha_inicio.split('T')[0] === todayStr && s.estado === 'APROBADO'
    ).length;
    const conPersonalExterno = solicitudes.filter((s) => s.requiere_ssoma).length;
    const conInsumosSeguridad = solicitudes.filter((s) => hasSecuritySupplies(s)).length;

    return { totalHoy, aprobadosHoy, conPersonalExterno, conInsumosSeguridad };
  }, [solicitudes, todayStr]);

  const handleResetFilters = () => {
    setFilterEstado('APROBADO');
    setFilterFechaPreset('HOY');
    setCustomDate('');
    setFilterAmbienteId('');
    setSearchQuery('');
    setOnlyExternalPersonnel(false);
    setOnlySecuritySupplies(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ============================================================== */}
      {/* 1. Banner Superior: Seguridad Interna y Vigilancia             */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Seguridad Interna y Vigilancia
              </span>
              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                • <span className="text-emerald-400 font-bold">Panel de Monitoreo (Solo Lectura)</span>
              </span>
            </div>
            <h2 className="text-xl font-bold mt-1 text-white">
              Control de Accesos, Garita e Inspección Logística
            </h2>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-xs font-bold transition-all border border-slate-700 shadow-sm"
            title="Imprimir reporte de accesos para garita de guardia"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Imprimir Control del Día</span>
          </button>

          <button
            onClick={loadSolicitudes}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 text-xs font-semibold transition-colors border border-rose-800/50"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Encabezado especial para impresión en Garita */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
              Universidad Continental • Control de Accesos y Seguridad en Puerta
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Hoja de Inspección y Registro de Eventos Diarios • Área de Seguridad Interna y Vigilancia
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900">Fecha de Impresión: {formatDateFull(new Date().toISOString())}</p>
            <p className="text-slate-500">Oficial en Guardia: {adminUser?.nombre || 'Personal de Resguardo'}</p>
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage.text && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 print:hidden animate-in fade-in ${
            feedbackMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {feedbackMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. Tarjetas de Resumen / Métricas Operativas                   */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Eventos Hoy</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.totalHoy}</p>
          <span className="text-[11px] text-slate-400 block">Programados en campus</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Ingreso Autorizado</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{metrics.aprobadosHoy}</p>
          <span className="text-[11px] text-emerald-600 font-medium block">Aprobación Final Otorgada</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Con Personal Externo</span>
            <UserCheck className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700">{metrics.conPersonalExterno}</p>
          <span className="text-[11px] text-amber-600 font-medium block">Requieren SCTR / Lista</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Insumos de Seguridad</span>
            <Shield className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-700">{metrics.conInsumosSeguridad}</p>
          <span className="text-[11px] text-blue-600 font-medium block">Vallas / Resguardo / Accesos</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. Barra de Filtros Operativos Avanzados                       */}
      {/* ============================================================== */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Presets de Fecha */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Fecha:</span>
            </span>
            <button
              onClick={() => {
                setFilterFechaPreset('HOY');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterFechaPreset === 'HOY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                setFilterFechaPreset('MANANA');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterFechaPreset === 'MANANA'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Mañana
            </button>
            <button
              onClick={() => {
                setFilterFechaPreset('SEMANA');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterFechaPreset === 'SEMANA'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => {
                setFilterFechaPreset('TODAS');
                setCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterFechaPreset === 'TODAS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>

            {/* Selector de fecha específica */}
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setFilterFechaPreset(e.target.value ? 'CUSTOM' : 'TODAS');
              }}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-semibold focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Filtro de Estado General */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">Estado:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setFilterEstado('APROBADO')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterEstado === 'APROBADO'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aprobados
              </button>
              <button
                onClick={() => setFilterEstado('PENDIENTE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterEstado === 'PENDIENTE'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFilterEstado('RECHAZADO')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterEstado === 'RECHAZADO'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rechazados
              </button>
              <button
                onClick={() => setFilterEstado('TODAS')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterEstado === 'TODAS'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
            </div>
          </div>
        </div>

        {/* Fila secundaria: Selector de Ambiente, Buscador y Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
          {/* Dropdown de Ambiente */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Ambiente / Ubicación
            </label>
            <select
              value={filterAmbienteId}
              onChange={(e) => setFilterAmbienteId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
            >
              <option value="">Todos los ambientes físicos</option>
              {ambientes.map((amb) => (
                <option key={amb.id} value={amb.id}>
                  {amb.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Buscador de texto */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Búsqueda Rápida (Ticket, Solicitante, Detalle)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por código de ticket, correo, evento o facultad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 font-medium"
              />
            </div>
          </div>

          {/* Botón de Limpiar Filtros */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restablecer Filtros</span>
            </button>
          </div>
        </div>

        {/* Toggles rápidos de Seguridad */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            onClick={() => setOnlyExternalPersonnel((prev) => !prev)}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              onlyExternalPersonnel
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>⚠️ Solo Personal Externo (SSOMA)</span>
          </button>

          <button
            onClick={() => setOnlySecuritySupplies((prev) => !prev)}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              onlySecuritySupplies
                ? 'bg-blue-100 text-blue-900 border-blue-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>🛡️ Solo con Insumos de Seguridad (Vallas/Resguardo)</span>
          </button>

          <span className="text-xs text-slate-400 font-medium ml-auto">
            Mostrando <strong>{filteredSolicitudes.length}</strong> eventos registrados
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. Lista y Tarjetas de Solicitudes para Control de Acceso      */}
      {/* ============================================================== */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-700">Cargando eventos para inspección de seguridad...</p>
        </div>
      ) : filteredSolicitudes.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
          <Shield className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-700">No se encontraron eventos con los filtros seleccionados</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ajuste la fecha, el estado o el ambiente para visualizar los accesos programados en campus.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            Ver eventos aprobados de hoy
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSolicitudes.map((sol) => {
            const isApproved = sol.estado === 'APROBADO';
            const isPending = sol.estado === 'PENDIENTE';
            const isRejected = sol.estado === 'RECHAZADO';
            const hasSupplies = hasSecuritySupplies(sol);

            // Filtrar recursos que son específicamente de seguridad o logística crítica
            const securityResources = (sol.recursos || []).filter((r) => {
              const nom = (r.nombre || '').toLowerCase();
              return (
                nom.includes('valla') ||
                nom.includes('acceso') ||
                nom.includes('resguardo') ||
                nom.includes('seguridad') ||
                nom.includes('vigilancia') ||
                r.area_destino_id === 3
              );
            });

            return (
              <div
                key={sol.id}
                className={`bg-white rounded-3xl border transition-all shadow-xs overflow-hidden ${
                  isApproved
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : isPending
                    ? 'border-amber-200 hover:border-amber-300'
                    : 'border-slate-200 opacity-80'
                }`}
              >
                {/* Cabecera de la Tarjeta */}
                <div
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b ${
                    isApproved
                      ? 'bg-emerald-50/50 border-emerald-100'
                      : isPending
                      ? 'bg-amber-50/50 border-amber-100'
                      : 'bg-slate-50/60 border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-sm px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-2xs">
                      #{sol.codigo_ticket}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatTimeRange(sol.fecha_inicio, sol.fecha_fin)}</span>
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          • {formatDateShort(sol.fecha_inicio)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Insignia de Autorización General para Garita */}
                  <div>
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                        <CheckCircle className="w-4 h-4" />
                        <span>AUTORIZADO PARA INGRESO</span>
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500 text-white shadow-xs">
                        <Clock className="w-4 h-4" />
                        <span>EN EVALUACIÓN (SIN APROBACIÓN FINAL)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-600 text-white shadow-xs">
                        <XCircle className="w-4 h-4" />
                        <span>INGRESO NO AUTORIZADO (RECHAZADO)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Cuerpo de la Tarjeta */}
                <div className="p-5 space-y-4">
                  {/* Fila de Ubicación, Solicitante y Propósito */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Ubicación / Ambiente */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-brand-600" />
                        Ambiente / Espacio Físico
                      </span>
                      <p className="font-bold text-slate-900 text-sm">{sol.ambiente_nombre || 'No especificado'}</p>
                    </div>

                    {/* Solicitante & Contacto Directo */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-brand-600" />
                        Solicitante & Facultad
                      </span>
                      <p className="font-bold text-slate-800">{sol.area_solicitante || 'Facultad no especificada'}</p>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {sol.correo_solicitante}
                        </span>
                        {sol.telefono && (
                          <span className="flex items-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {sol.telefono}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Descripción / Asunto del Evento */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-brand-600" />
                        Detalles / Finalidad del Evento
                      </span>
                      <p className="text-slate-700 italic leading-relaxed text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-3">
                        {sol.detalles || 'Sin detalles adicionales ingresados.'}
                      </p>
                    </div>
                  </div>

                  {/* ========================================================== */}
                  {/* Módulo A: Insumos de Seguridad Físicos Solicitados         */}
                  {/* ========================================================== */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span>Insumos y Dispositivos de Seguridad en Campo</span>
                      </span>
                      {securityResources.length > 0 && (
                        <span className="text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                          {securityResources.length} ítem(s) requeridos
                        </span>
                      )}
                    </div>

                    {securityResources.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {securityResources.map((rec, idx) => (
                          <div
                            key={idx}
                            className="bg-blue-50/80 border border-blue-200 text-blue-900 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-2"
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>{rec.nombre}</span>
                            <span className="bg-blue-200/80 px-2 py-0.5 rounded-md text-[11px] font-mono text-blue-950 font-black">
                              x{rec.cantidad}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No se solicitaron vallas, resguardo especial ni dispositivos de seguridad física para este evento.
                      </p>
                    )}
                  </div>

                  {/* ========================================================== */}
                  {/* Módulo B: Protocolo SSOMA & Personal Externo (Garita)      */}
                  {/* ========================================================== */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-600" />
                        <span>Control de Personal Externo & Protocolo SSOMA</span>
                      </span>
                      {sol.requiere_ssoma ? (
                        <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                          ⚠️ Ingreso de Personal Externo
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Solo Comunidad UC
                        </span>
                      )}
                    </div>

                    {sol.requiere_ssoma ? (
                      <div className="space-y-3">
                        {/* Acceso a Documentos PDF de Garita */}
                        <div className="flex flex-wrap gap-2.5">
                          {sol.url_personal_externo_pdf ? (
                            <a
                              href={sol.url_personal_externo_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition-colors shadow-2xs"
                              title="Abrir lista de nombres y DNI para verificar en puerta"
                            >
                              <FileText className="w-4 h-4 text-amber-700" />
                              <span>Ver Lista de Personal Externo (PDF)</span>
                              <ExternalLink className="w-3.5 h-3.5 text-amber-600 ml-1" />
                            </a>
                          ) : (
                            <span className="text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 font-semibold">
                              ⚠️ Falta adjuntar nómina de personal externo
                            </span>
                          )}

                          {sol.url_sctr_pdf ? (
                            <a
                              href={sol.url_sctr_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition-colors shadow-2xs"
                              title="Verificar póliza de seguro de trabajo de riesgo"
                            >
                              <FileText className="w-4 h-4 text-amber-700" />
                              <span>Ver Póliza SCTR (PDF)</span>
                              <ExternalLink className="w-3.5 h-3.5 text-amber-600 ml-1" />
                            </a>
                          ) : (
                            <span className="text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 font-semibold">
                              ⚠️ Falta adjuntar póliza SCTR
                            </span>
                          )}
                        </div>

                        {/* Caja de Lineamientos de Seguridad SSOMA */}
                        {sol.lineamientos_ssoma ? (
                          <div className="bg-emerald-50/90 border border-emerald-200 p-3.5 rounded-2xl space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-700" />
                              Lineamientos de Seguridad SSOMA Emitidos para este Evento:
                            </span>
                            <p className="text-xs text-emerald-950 leading-relaxed font-medium whitespace-pre-line pl-5 border-l-2 border-emerald-400">
                              {sol.lineamientos_ssoma}
                            </p>
                          </div>
                        ) : (
                          <div className="text-xs text-amber-800 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 flex items-center gap-2 font-medium">
                            <Info className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Pendiente de emisión de lineamientos técnicos por el Supervisor SSOMA.</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        Evento institucional sin requerimiento de proveedores ni cuadrillas externas.
                      </p>
                    )}
                  </div>

                  {/* ========================================================== */}
                  {/* Módulo C: Croquis de Distribución en Campo                 */}
                  {/* ========================================================== */}
                  {sol.croquis_url && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          📐 Croquis de Distribución Física de Mobiliario / Vallas:
                        </span>
                      </div>
                      <a
                        href={sol.croquis_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                      >
                        <span>Abrir Croquis en Google Drive</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. Pie de Página Imprimible para Garita de Seguridad            */}
      {/* ============================================================== */}
      <div className="hidden print:block pt-8 mt-12 border-t border-slate-300">
        <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-800">
          <div className="space-y-12">
            <div className="border-b border-slate-400 mx-8"></div>
            <div>
              <p className="font-bold">Firma del Oficial de Guardia en Turno</p>
              <p className="text-slate-500 text-[10px]">Área de Seguridad Interna y Vigilancia</p>
            </div>
          </div>
          <div className="space-y-12">
            <div className="border-b border-slate-400 mx-8"></div>
            <div>
              <p className="font-bold">V°B° Supervisor General de Seguridad</p>
              <p className="text-slate-500 text-[10px]">Control de Garita y Puertas Campus</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

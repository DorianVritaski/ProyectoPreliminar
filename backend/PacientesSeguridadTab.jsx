import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckCircle,
  Clock,
  Phone,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
  FileText,
  Filter,
  Check,
  Copy,
  HeartPulse,
  Baby,
  RefreshCw
} from 'lucide-react';
import { api } from '../../api/client';
import { formatTimeRange } from '../../utils/formatters';

export default function PacientesSeguridadTab({ adminUser, showFeedback }) {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEscuela, setFilterEscuela] = useState('TODAS'); // 'TODAS' | 'Odontología' | 'Psicología' | 'Enfermería'
  const [filterFechaPreset, setFilterFechaPreset] = useState('HOY'); // 'HOY' | 'TODAS' | 'CUSTOM'
  const [customDate, setCustomDate] = useState('');
  const [filterIngresado, setFilterIngresado] = useState('TODOS'); // 'TODOS' | 'PENDIENTES' | 'INGRESADOS'
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(null);

  const loadPacientes = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const params = {};
      if (filterFechaPreset === 'HOY') {
        params.fecha = todayStr;
      } else if (filterFechaPreset === 'CUSTOM' && customDate) {
        params.fecha = customDate;
      }

      if (filterEscuela !== 'TODAS') {
        params.escuela_profesional = filterEscuela;
      }

      if (filterIngresado === 'PENDIENTES') {
        params.ingresado_garita = false;
      } else if (filterIngresado === 'INGRESADOS') {
        params.ingresado_garita = true;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const data = await api.getPacientes(params);
      setPacientes(data);
    } catch (err) {
      showFeedback?.(err.message || 'Error al cargar pacientes para garita', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacientes();
  }, [filterEscuela, filterFechaPreset, customDate, filterIngresado]);

  // Manejar Check-in de ingreso en puerta
  const handleCheckIn = async (paciente) => {
    if (paciente.ingresado_garita) return;
    setActionInProgress(paciente.id);
    try {
      const updated = await api.checkInPaciente(paciente.id);
      setPacientes((prev) => prev.map((p) => (p.id === paciente.id ? updated : p)));
      showFeedback?.(`¡Ingreso registrado para el paciente ${paciente.paciente_nombre}!`, 'success');
    } catch (err) {
      showFeedback?.(err.message || 'Error al marcar ingreso en garita', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCopyPhone = (phone, id) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(id);
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  // Métricas rápidas
  const totalHoy = pacientes.length;
  const ingresadosHoy = pacientes.filter((p) => p.ingresado_garita).length;
  const pendientesHoy = totalHoy - ingresadosHoy;

  return (
    <div className="space-y-6">
      {/* 1. Header con métricas de garita */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pacientes Programados {filterFechaPreset === 'HOY' ? 'Hoy' : ''}</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalHoy}</p>
          <span className="text-[11px] text-slate-400 block">Total en lista de atención</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pendientes de Ingreso</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{pendientesHoy}</p>
          <span className="text-[11px] text-amber-700/80 block font-medium">Por presentarse en garita</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ingresaron al Campus</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{ingresadosHoy}</p>
          <span className="text-[11px] text-emerald-700/80 block font-medium">Check-in completado en puerta</span>
        </div>
      </div>

      {/* 2. Barra de Filtros Operativos para el Guardia de Vigilancia */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Filtros por Carrera */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'TODAS', label: 'Todas las Carreras' },
              { id: 'Odontología', label: '🦷 Odontología' },
              { id: 'Psicología', label: '🧠 Psicología (Gesell)' },
              { id: 'Enfermería', label: '🩺 Enfermería / T. Física' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterEscuela(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterEscuela === f.id
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Filtro Fecha */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterFechaPreset('HOY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterFechaPreset === 'HOY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📅 Solo Hoy
            </button>
            <button
              type="button"
              onClick={() => setFilterFechaPreset('TODAS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterFechaPreset === 'TODAS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas las Fechas
            </button>
            <button
              type="button"
              onClick={loadPacientes}
              title="Refrescar lista"
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Buscador Rápido por Nombre, DNI o Ticket */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPacientes()}
              placeholder="Buscar por DNI del paciente, Apellidos, Estudiante o Código de Ticket..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={loadPacientes}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* 3. Listado de Pacientes en Puerta */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Cargando lista de pacientes autorizados...</p>
        </div>
      ) : pacientes.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">No hay pacientes programados con estos filtros</p>
          <p className="text-xs text-slate-400">Verifique los filtros de carrera o seleccione "Todas las Fechas".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {pacientes.map((pac) => {
            const isIngresado = Boolean(pac.ingresado_garita);
            const horaIngresoStr = pac.fecha_ingreso_real
              ? new Date(pac.fecha_ingreso_real).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={pac.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xs ${
                  isIngresado
                    ? 'bg-slate-50/80 border-slate-200 opacity-80'
                    : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                {/* Datos del Paciente */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                      {pac.codigo_ticket}
                    </span>
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {pac.escuela_profesional}
                    </span>
                    {pac.es_menor_edad && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Baby className="w-3 h-3" /> Menor de Edad
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                        {pac.paciente_nombre}
                      </h4>
                      <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        DNI: {pac.paciente_dni}
                      </span>
                    </div>

                    {pac.es_menor_edad && pac.apoderado_nombre && (
                      <div className="text-xs text-amber-900 bg-amber-50/70 p-2 rounded-xl border border-amber-200/80 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Apoderado que acompaña: <strong>{pac.apoderado_nombre}</strong> (DNI: {pac.apoderado_dni})</span>
                      </div>
                    )}
                  </div>

                  {/* Asignatura y Docente */}
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Curso: <strong className="text-slate-700">{pac.asignatura}</strong> {pac.nrc ? `(NRC: ${pac.nrc})` : ''}</span>
                    {pac.docente_nombre && (
                      <>
                        <span>•</span>
                        <span>Docente: <strong className="text-slate-700">{pac.docente_nombre}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                {/* Datos del Estudiante a Cargo (Para llamada en garita) */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-[240px] max-w-sm w-full lg:w-auto space-y-1.5 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Estudiante Responsable
                  </span>
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {pac.estudiante_nombre}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-mono text-[11px]">DNI: {pac.estudiante_dni}</span>
                    {pac.estudiante_telefono && (
                      <div className="flex items-center gap-1">
                        <a
                          href={`tel:${pac.estudiante_telefono}`}
                          className="flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 transition-colors"
                          title="Llamar al estudiante para que baje a recibir a su paciente"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{pac.estudiante_telefono}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(pac.estudiante_telefono, pac.id)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="Copiar número"
                        >
                          {copiedPhone === pac.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Horario y Botón de Check-In */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 w-full lg:w-auto shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-800 block">
                      🕒 {pac.horario_inicio} - {pac.horario_fin}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      📅 {pac.fecha_atencion}
                    </span>
                  </div>

                  {isIngresado ? (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Ingresó al Campus {horaIngresoStr ? `(${horaIngresoStr})` : ''}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={actionInProgress === pac.id}
                      onClick={() => handleCheckIn(pac)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {actionInProgress === pac.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Marcar Ingreso en Puerta</span>
                    </button>
                  )}

                  {pac.url_consentimiento_pdf && (
                    <a
                      href={api.getFileUrl(pac.url_consentimiento_pdf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                      title="Ver Consentimiento Informado"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Consentimiento / DNI (Drive)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

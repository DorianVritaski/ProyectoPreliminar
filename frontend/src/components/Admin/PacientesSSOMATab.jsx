import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Search,
  CheckCircle,
  Clock,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
  FileText,
  Filter,
  Check,
  ShieldCheck,
  Baby,
  RefreshCw,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { api } from '../../api/client';

export default function PacientesSSOMATab({ adminUser, showFeedback }) {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEscuela, setFilterEscuela] = useState('TODAS');
  const [filterEstado, setFilterEstado] = useState('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [observingPac, setObservingPac] = useState(null);
  const [observacionTexto, setObservacionTexto] = useState('');
  const [savingObs, setSavingObs] = useState(false);

  const loadPacientes = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterEscuela !== 'TODAS') {
        params.escuela_profesional = filterEscuela;
      }
      if (filterEstado !== 'TODOS') {
        params.estado = filterEstado;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const data = await api.getPacientes(params);
      setPacientes(data);
    } catch (err) {
      showFeedback?.(err.message || 'Error al cargar pacientes para SSOMA', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacientes();
  }, [filterEscuela, filterEstado]);

  const handleOpenObservar = (pac) => {
    setObservingPac(pac);
    setObservacionTexto(pac.observaciones_ssoma || '');
  };

  const handleSaveObservacion = async (estadoNuevo) => {
    if (!observingPac) return;
    setSavingObs(true);
    try {
      const updated = await api.updatePacienteSSOMA(observingPac.id, {
        estado: estadoNuevo,
        observaciones_ssoma: observacionTexto.trim() || null,
      });
      setPacientes((prev) => prev.map((p) => (p.id === observingPac.id ? updated : p)));
      showFeedback?.(`Estado del paciente actualizado a: ${estadoNuevo}`, 'success');
      setObservingPac(null);
    } catch (err) {
      showFeedback?.(err.message || 'Error al actualizar paciente', 'error');
    } finally {
      setSavingObs(false);
    }
  };

  // Contadores
  const total = pacientes.length;
  const registrados = pacientes.filter((p) => p.estado === 'REGISTRADO').length;
  const ingresados = pacientes.filter((p) => p.estado === 'INGRESADO').length;
  const observados = pacientes.filter((p) => p.estado === 'OBSERVADO').length;

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Métricas SSOMA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Pacientes</span>
            <HeartPulse className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{total}</p>
          <span className="text-[11px] text-slate-400 block">Registrados en plataforma</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-teal-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Citas Programadas</span>
            <Clock className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-black text-teal-700">{registrados}</p>
          <span className="text-[11px] text-teal-700/80 block font-medium">Por presentarse</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ingresos Confirmados</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{ingresados}</p>
          <span className="text-[11px] text-emerald-700/80 block font-medium">En campus universitario</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Con Observación</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700">{observados}</p>
          <span className="text-[11px] text-amber-700/80 block font-medium">Revisión de documento</span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Filtros por Carrera */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'TODAS', label: 'Todas las Carreras' },
              { id: 'Odontología', label: '🦷 Odontología' },
              { id: 'Psicología', label: '🧠 Psicología' },
              { id: 'Enfermería', label: '🩺 Enfermería' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterEscuela(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterEscuela === f.id
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Filtro Estado */}
          <div className="flex items-center gap-2">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white cursor-pointer focus:outline-none"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="REGISTRADO">Solo Registrados</option>
              <option value="INGRESADO">Solo Ingresados</option>
              <option value="OBSERVADO">Solo Observados</option>
            </select>

            <button
              type="button"
              onClick={loadPacientes}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Refrescar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPacientes()}
              placeholder="Buscar por DNI, Nombre de Paciente, Estudiante o Código de Ticket..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
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

      {/* 3. Listado de Pacientes para SSOMA */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Cargando pacientes para revisión SSOMA...</p>
        </div>
      ) : pacientes.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <HeartPulse className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">No se encontraron pacientes registrados con los filtros aplicados</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {pacientes.map((pac) => (
            <div
              key={pac.id}
              className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                    {pac.codigo_ticket}
                  </span>
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {pac.escuela_profesional}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    pac.estado === 'INGRESADO'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : pac.estado === 'OBSERVADO'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-teal-50 text-teal-800 border-teal-200'
                  }`}>
                    {pac.estado === 'INGRESADO' ? '✓ Ingresó a Campus' : pac.estado === 'OBSERVADO' ? '⚠️ Con Observación' : '⏳ Cita Registrada'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {pac.paciente_nombre}
                  </h4>
                  <div className="text-xs text-slate-500 font-medium">
                    DNI: <strong className="text-slate-700 font-mono">{pac.paciente_dni}</strong>
                    {pac.es_menor_edad && (
                      <span className="text-amber-700 ml-2 font-semibold">
                        (Menor de edad • Apoderado: {pac.apoderado_nombre} - DNI: {pac.apoderado_dni})
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Estudiante: <strong className="text-slate-800">{pac.estudiante_nombre}</strong> ({pac.estudiante_correo})</span>
                  <span>•</span>
                  <span>Cita: <strong className="text-slate-800 font-mono">{pac.fecha_atencion}</strong> ({pac.horario_inicio} - {pac.horario_fin})</span>
                </div>

                {pac.observaciones_ssoma && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Observación SSOMA: <em>"{pac.observaciones_ssoma}"</em></span>
                  </div>
                )}
              </div>

              {/* Botones de Documentación y Acción */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {pac.url_consentimiento_pdf ? (
                  <a
                    href={api.getFileUrl(pac.url_consentimiento_pdf)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition-all shadow-xs"
                    title="Ver Consentimiento Informado escaneado + DNI"
                  >
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span>Ver Consentimiento (Drive)</span>
                    <ExternalLink className="w-3 h-3 text-emerald-600" />
                  </a>
                ) : (
                  <span className="text-xs text-rose-600 italic">Sin documento adjunto</span>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenObservar(pac)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                  title="Revisar o añadir observación"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                  <span>Evaluar / Observar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para Registrar Observación SSOMA */}
      {observingPac && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Evaluación SSOMA: {observingPac.codigo_ticket}
              </h3>
              <button
                type="button"
                onClick={() => setObservingPac(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>Paciente: <strong>{observingPac.paciente_nombre}</strong> (DNI: {observingPac.paciente_dni})</div>
              <div>Estudiante: <strong>{observingPac.estudiante_nombre}</strong></div>
              <div>Escuela: <strong>{observingPac.escuela_profesional}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Observaciones / Indicaciones para Garita y Estudiante:
              </label>
              <textarea
                rows={3}
                value={observacionTexto}
                onChange={(e) => setObservacionTexto(e.target.value)}
                placeholder="Ej. El documento de consentimiento carece de firma legible o el DNI adjunto se encuentra vencido..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={savingObs}
                onClick={() => handleSaveObservacion('OBSERVADO')}
                className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all disabled:opacity-50"
              >
                Marcar como Observado
              </button>

              <button
                type="button"
                disabled={savingObs}
                onClick={() => handleSaveObservacion('REGISTRADO')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                Conforme / Aprobado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

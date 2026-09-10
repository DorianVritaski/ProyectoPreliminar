import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  LogOut,
  Inbox,
  Building,
  Package,
  GraduationCap,
  Briefcase,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  PlusCircle,
  Check,
  X,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatTimeRange, formatDateFull, formatDateShort } from '../../utils/formatters';

export default function AdminDashboard({ adminUser, onLogout, onRefreshPublicData }) {
  const [activeSubTab, setActiveSubTab] = useState('solicitudes'); // 'solicitudes' | 'ambientes' | 'recursos' | 'areas_destino' | 'areas_solicitantes' | 'usuarios'

  // -------------------------------------------------------------
  // State: Solicitudes (RF-05.1)
  // -------------------------------------------------------------
  const [solicitudes, setSolicitudes] = useState([]);
  const [filterEstado, setFilterEstado] = useState('PENDIENTE'); // 'TODAS' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  // Modal Rechazo
  const [rejectingSolicitud, setRejectingSolicitud] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  // -------------------------------------------------------------
  // State: Ambientes (RF-05.2)
  // -------------------------------------------------------------
  const [ambientes, setAmbientes] = useState([]);
  const [isNewAmbienteOpen, setIsNewAmbienteOpen] = useState(false);
  const [newAmbienteData, setNewAmbienteData] = useState({ nombre: '', capacidad: 50, activo: true });
  const [editingAmbiente, setEditingAmbiente] = useState(null); // { id, nombre, capacidad, activo }

  // -------------------------------------------------------------
  // State: Recursos e Inventario (RF-05.3)
  // -------------------------------------------------------------
  const [catalogoRecursos, setCatalogoRecursos] = useState([]);
  const [editingStock, setEditingStock] = useState({}); // { [recId]: stockValue }
  const [isNewRecursoOpen, setIsNewRecursoOpen] = useState(false);
  const [newRecursoData, setNewRecursoData] = useState({
    nombre: '',
    area_destino_id: 1,
    stock_total: 20,
    es_critico: false,
  });
  const [editingRecurso, setEditingRecurso] = useState(null); // { id, nombre, area_destino_id, stock_total, es_critico }

  // -------------------------------------------------------------
  // State: Áreas Administrativas Responsables (Áreas Destino)
  // -------------------------------------------------------------
  const [areasDestino, setAreasDestino] = useState([]);
  const [isNewAreaDestinoOpen, setIsNewAreaDestinoOpen] = useState(false);
  const [newAreaDestinoData, setNewAreaDestinoData] = useState({ nombre: '', activa: true });
  const [editingAreaDestino, setEditingAreaDestino] = useState(null);

  // -------------------------------------------------------------
  // State: Áreas / Facultades Solicitantes (RF-05.4)
  // -------------------------------------------------------------
  const [areasSolicitantes, setAreasSolicitantes] = useState([]);
  const [isNewAreaOpen, setIsNewAreaOpen] = useState(false);
  const [newAreaNombre, setNewAreaNombre] = useState('');
  const [editingAreaSolicitante, setEditingAreaSolicitante] = useState(null); // { id, nombre, activa }

  // -------------------------------------------------------------
  // State: Cuentas de Administrador (Multi-Admin)
  // -------------------------------------------------------------
  const [usuariosAdmin, setUsuariosAdmin] = useState([]);
  const [isNewAdminOpen, setIsNewAdminOpen] = useState(false);
  const [newAdminData, setNewAdminData] = useState({
    nombre: '',
    correo: '',
    password: '',
    activo: true,
  });

  // Feedback Toast
  const [feedbackMessage, setFeedbackMessage] = useState({ text: '', type: '' });

  const showFeedback = (text, type = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage({ text: '', type: '' }), 4500);
  };

  // Cargas de datos
  const loadSolicitudes = async () => {
    setLoadingSolicitudes(true);
    try {
      const estadoParam = filterEstado === 'TODAS' ? null : filterEstado;
      const data = await api.adminGetSolicitudes(estadoParam);
      setSolicitudes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  const loadAmbientes = async () => {
    try {
      const data = await api.adminGetAmbientes();
      setAmbientes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecursos = async () => {
    try {
      const data = await api.getRecursosCatalogo();
      setCatalogoRecursos(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAreasDestino = async () => {
    try {
      const data = await api.adminGetAreasDestino();
      setAreasDestino(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAreasSolicitantes = async () => {
    try {
      const data = await api.adminGetAreasSolicitantes();
      setAreasSolicitantes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsuariosAdmin = async () => {
    try {
      const data = await api.adminGetUsuarios();
      setUsuariosAdmin(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSolicitudes();
  }, [filterEstado]);

  useEffect(() => {
    loadAmbientes();
    loadRecursos();
    loadAreasDestino();
    loadAreasSolicitantes();
    loadUsuariosAdmin();
  }, []);

  // -------------------------------------------------------------
  // Handlers: Solicitudes (RF-05.1)
  // -------------------------------------------------------------
  const handleApprove = async (id) => {
    setActionInProgress(id);
    try {
      await api.adminUpdateSolicitudEstado(id, 'APROBADO');
      showFeedback('Solicitud APROBADA exitosamente. Espacio y recursos reservados formalmente.');
      loadSolicitudes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOpenRejectModal = (sol) => {
    setRejectingSolicitud(sol);
    setMotivoRechazo('Por motivos de aforo o mantenimiento preventivo programado.');
  };

  const handleConfirmReject = async () => {
    if (!rejectingSolicitud) return;
    setActionInProgress(rejectingSolicitud.id);
    try {
      await api.adminUpdateSolicitudEstado(rejectingSolicitud.id, 'RECHAZADO', motivoRechazo);
      showFeedback('Solicitud RECHAZADA. Se ha liberado la disponibilidad en el calendario.');
      setRejectingSolicitud(null);
      loadSolicitudes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // -------------------------------------------------------------
  // Handlers: Ambientes (RF-05.2)
  // -------------------------------------------------------------
  const handleCreateAmbiente = async (e) => {
    e.preventDefault();
    try {
      await api.adminCreateAmbiente(newAmbienteData);
      showFeedback(`Ambiente '${newAmbienteData.nombre}' creado exitosamente.`);
      setIsNewAmbienteOpen(false);
      setNewAmbienteData({ nombre: '', capacidad: 50, activo: true });
      loadAmbientes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleToggleAmbienteActivo = async (amb) => {
    try {
      await api.adminUpdateAmbiente(amb.id, { activo: !amb.activo });
      showFeedback(`Ambiente ${!amb.activo ? 'activado' : 'desactivado'} correctamente.`);
      loadAmbientes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleUpdateAmbiente = async (e) => {
    e.preventDefault();
    if (!editingAmbiente) return;
    try {
      await api.adminUpdateAmbiente(editingAmbiente.id, {
        nombre: editingAmbiente.nombre.trim(),
        capacidad: Number(editingAmbiente.capacidad),
        activo: editingAmbiente.activo,
      });
      showFeedback(`Ambiente '${editingAmbiente.nombre}' actualizado correctamente.`);
      setEditingAmbiente(null);
      loadAmbientes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleDeleteAmbiente = async (amb) => {
    if (!confirm(`¿Está seguro de eliminar el ambiente '${amb.nombre}' del catálogo?`)) return;
    try {
      await api.adminDeleteAmbiente(amb.id);
      showFeedback(`Ambiente '${amb.nombre}' eliminado correctamente.`);
      loadAmbientes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // -------------------------------------------------------------
  // Handlers: Recursos e Inventario (RF-05.3)
  // -------------------------------------------------------------
  const handleSaveStock = async (recId) => {
    const stockVal = editingStock[recId];
    if (stockVal === undefined) return;
    try {
      await api.adminUpdateStock(recId, stockVal);
      showFeedback('Stock Total actualizado en el inventario.');
      setEditingStock((prev) => {
        const copy = { ...prev };
        delete copy[recId];
        return copy;
      });
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleToggleCritico = async (rec) => {
    try {
      await api.adminUpdateRecurso(rec.id, { es_critico: !rec.es_critico });
      showFeedback(`Recurso '${rec.nombre}' marcado como ${!rec.es_critico ? 'Crítico' : 'Estándar'}.`);
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleCreateRecurso = async (e) => {
    e.preventDefault();
    try {
      await api.adminCreateRecurso(newRecursoData);
      showFeedback(`Recurso '${newRecursoData.nombre}' agregado al catálogo.`);
      setIsNewRecursoOpen(false);
      setNewRecursoData({ nombre: '', area_destino_id: 1, stock_total: 20, es_critico: false });
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleUpdateRecurso = async (e) => {
    e.preventDefault();
    if (!editingRecurso) return;
    try {
      await api.adminUpdateRecurso(editingRecurso.id, {
        nombre: editingRecurso.nombre.trim(),
        area_destino_id: Number(editingRecurso.area_destino_id),
        stock_total: Number(editingRecurso.stock_total),
        es_critico: editingRecurso.es_critico,
      });
      showFeedback(`Recurso '${editingRecurso.nombre}' actualizado correctamente.`);
      setEditingRecurso(null);
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleDeleteRecurso = async (rec) => {
    if (!confirm(`¿Está seguro de eliminar el recurso '${rec.nombre}' del inventario?`)) return;
    try {
      await api.adminDeleteRecurso(rec.id);
      showFeedback(`Recurso '${rec.nombre}' eliminado correctamente del inventario.`);
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // -------------------------------------------------------------
  // Handlers: Áreas Administrativas Responsables (Áreas Destino)
  // -------------------------------------------------------------
  const handleCreateAreaDestino = async (e) => {
    e.preventDefault();
    if (!newAreaDestinoData.nombre.trim()) return;
    try {
      await api.adminCreateAreaDestino(newAreaDestinoData);
      showFeedback(`Área operativa '${newAreaDestinoData.nombre}' registrada correctamente.`);
      setIsNewAreaDestinoOpen(false);
      setNewAreaDestinoData({ nombre: '', activa: true });
      loadAreasDestino();
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleUpdateAreaDestino = async (e) => {
    e.preventDefault();
    if (!editingAreaDestino) return;
    try {
      await api.adminUpdateAreaDestino(editingAreaDestino.id, {
        nombre: editingAreaDestino.nombre,
        activa: editingAreaDestino.activa,
      });
      showFeedback(`Área operativa actualizada.`);
      setEditingAreaDestino(null);
      loadAreasDestino();
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleDeleteAreaDestino = async (area) => {
    if (!confirm(`¿Está seguro de eliminar el área administrativa '${area.nombre}'?`)) return;
    try {
      await api.adminDeleteAreaDestino(area.id);
      showFeedback(`Área operativa '${area.nombre}' eliminada correctamente.`);
      loadAreasDestino();
      loadRecursos();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // -------------------------------------------------------------
  // Handlers: Áreas Solicitantes (RF-05.4)
  // -------------------------------------------------------------
  const handleCreateAreaSolicitante = async (e) => {
    e.preventDefault();
    if (!newAreaNombre.trim()) return;
    try {
      await api.adminCreateAreaSolicitante({ nombre: newAreaNombre.trim(), activa: true });
      showFeedback(`Facultad / Área '${newAreaNombre}' agregada al catálogo.`);
      setIsNewAreaOpen(false);
      setNewAreaNombre('');
      loadAreasSolicitantes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleToggleAreaSolicitanteActiva = async (area) => {
    try {
      await api.adminUpdateAreaSolicitante(area.id, { activa: !area.activa });
      showFeedback(`Área ${!area.activa ? 'habilitada' : 'deshabilitada'} en el formulario público.`);
      loadAreasSolicitantes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleUpdateAreaSolicitante = async (e) => {
    e.preventDefault();
    if (!editingAreaSolicitante) return;
    try {
      await api.adminUpdateAreaSolicitante(editingAreaSolicitante.id, {
        nombre: editingAreaSolicitante.nombre.trim(),
        activa: editingAreaSolicitante.activa,
      });
      showFeedback(`Facultad / Área '${editingAreaSolicitante.nombre}' actualizada correctamente.`);
      setEditingAreaSolicitante(null);
      loadAreasSolicitantes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleDeleteAreaSolicitante = async (area) => {
    if (!confirm(`¿Está seguro de eliminar la facultad / área '${area.nombre}'?`)) return;
    try {
      await api.adminDeleteAreaSolicitante(area.id);
      showFeedback(`Facultad / Área '${area.nombre}' eliminada correctamente.`);
      loadAreasSolicitantes();
      onRefreshPublicData?.();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // -------------------------------------------------------------
  // Handlers: Cuentas de Administrador (Multi-Admin)
  // -------------------------------------------------------------
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.adminCreateUsuario(newAdminData);
      showFeedback(`Cuenta administradora creada para ${newAdminData.correo}.`);
      setIsNewAdminOpen(false);
      setNewAdminData({ nombre: '', correo: '', password: '', activo: true });
      loadUsuariosAdmin();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleToggleAdminActivo = async (user) => {
    try {
      await api.adminUpdateUsuario(user.id, { activo: !user.activo });
      showFeedback(`Estado de cuenta ${!user.activo ? 'activado' : 'desactivado'}.`);
      loadUsuariosAdmin();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleDeleteAdmin = async (user) => {
    if (!confirm(`¿Está seguro de eliminar la cuenta administradora de '${user.nombre}'?`)) return;
    try {
      await api.adminDeleteUsuario(user.id);
      showFeedback(`Cuenta administradora eliminada.`);
      loadUsuariosAdmin();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Administration */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Dashboard Privado
              </span>
              <span className="text-xs text-slate-400">• Jefatura de Operaciones</span>
            </div>
            <h2 className="text-xl font-bold mt-0.5">Gestión y Aprobación Centralizada</h2>
          </div>
        </div>

        {/* User Badge & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-white">{adminUser?.nombre || 'Administrador'}</div>
            <div className="text-[11px] text-slate-400">{adminUser?.email}</div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors border border-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Volver al Portal Público</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage.text && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${feedbackMessage.type === 'error'
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

      {/* Tabs Navigation (Admin Modules) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab('solicitudes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'solicitudes'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Bandeja de Solicitudes</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ambientes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'ambientes'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
        >
          <Building className="w-4 h-4" />
          <span>Ambientes Físicos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recursos')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'recursos'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
        >
          <Package className="w-4 h-4" />
          <span>Inventario y Stock</span>
        </button>

        <button
          onClick={() => setActiveSubTab('areas_destino')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'areas_destino'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Áreas Operativas</span>
        </button>

        <button
          onClick={() => setActiveSubTab('areas_solicitantes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'areas_solicitantes'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Áreas Solicitantes</span>
        </button>

        <button
          onClick={() => setActiveSubTab('usuarios')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'usuarios'
            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
        >
          <Users className="w-4 h-4" />
          <span>Cuentas Administrador</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 1. Bandeja de Solicitudes (RF-05.1)                             */}
      {/* ============================================================== */}
      {activeSubTab === 'solicitudes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2">
                Filtrar por:
              </span>
              {['PENDIENTE', 'APROBADO', 'RECHAZADO', 'TODAS'].map((est) => (
                <button
                  key={est}
                  onClick={() => setFilterEstado(est)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterEstado === est
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {est}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Total solicitudes: <strong>{solicitudes.length}</strong>
            </span>
          </div>

          {loadingSolicitudes ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
              <span>Cargando solicitudes...</span>
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-500">
              No hay solicitudes registradas con este filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {solicitudes.map((sol) => (
                <div
                  key={sol.id}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-base text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100">
                        {sol.codigo_ticket}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{sol.area_solicitante}</div>
                        <div className="text-xs text-slate-400">
                          {sol.correo_solicitante} • Tel: {sol.telefono}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border ${sol.estado === 'APROBADO'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : sol.estado === 'PENDIENTE'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                      >
                        {sol.estado}
                      </span>
                    </div>
                  </div>

                  {/* Espacio y Horario */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                        Ambiente
                      </span>
                      <strong className="text-slate-900 text-sm">{sol.ambiente_nombre}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                        Fecha
                      </span>
                      <strong className="text-slate-800">{formatDateFull(sol.fecha_inicio)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase font-semibold text-[10px]">
                        Horario
                      </span>
                      <strong className="text-slate-800 font-mono">
                        {formatTimeRange(sol.fecha_inicio, sol.fecha_fin)}
                      </strong>
                    </div>
                  </div>

                  {/* Recursos solicitados */}
                  {sol.recursos && sol.recursos.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Recursos Asignados:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {sol.recursos.map((r, i) => (
                          <span
                            key={i}
                            className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-medium"
                          >
                            <strong>{r.cantidad}</strong> × {r.nombre}{' '}
                            <span className="text-[10px] text-brand-600 font-semibold">
                              ({r.area_destino_nombre})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detalles adicionales del solicitante */}
                  {sol.detalles && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                      <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block">
                        Detalles / Observaciones del Solicitante:
                      </span>
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                        {sol.detalles}
                      </p>
                    </div>
                  )}

                  {/* Motivo de rechazo si aplica */}
                  {sol.motivo_rechazo && (
                    <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl text-xs text-rose-800">
                      <strong>Motivo de rechazo:</strong> {sol.motivo_rechazo}
                    </div>
                  )}

                  {/* Acciones de Aprobación / Rechazo */}
                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                    {sol.estado === 'PENDIENTE' && (
                      <>
                        <button
                          onClick={() => handleOpenRejectModal(sol)}
                          disabled={actionInProgress === sol.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold border border-slate-200 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Rechazar Solicitud</span>
                        </button>

                        <button
                          onClick={() => handleApprove(sol.id)}
                          disabled={actionInProgress === sol.id}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Aprobar Solicitud</span>
                        </button>
                      </>
                    )}

                    {sol.estado === 'APROBADO' && (
                      <button
                        onClick={() => handleOpenRejectModal(sol)}
                        disabled={actionInProgress === sol.id}
                        className="text-xs text-slate-500 hover:text-rose-600 font-medium underline"
                      >
                        Cambiar a Rechazado
                      </button>
                    )}

                    {sol.estado === 'RECHAZADO' && (
                      <button
                        onClick={() => handleApprove(sol.id)}
                        disabled={actionInProgress === sol.id}
                        className="text-xs text-slate-500 hover:text-emerald-600 font-medium underline"
                      >
                        Reconsiderar y Aprobar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. Gestión de Ambientes Físicos (RF-05.2)                       */}
      {/* ============================================================== */}
      {activeSubTab === 'ambientes' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Catálogo de Ambientes y Espacios</h3>
              <p className="text-xs text-slate-500">
                Configure los espacios físicos disponibles para reservas universitarias.
              </p>
            </div>
            <button
              onClick={() => setIsNewAmbienteOpen(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Ambiente</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Nombre del Espacio</th>
                  <th className="p-3">Capacidad / Aforo</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ambientes.map((amb) => (
                  <tr key={amb.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-mono font-bold text-slate-400">#{amb.id}</td>
                    <td className="p-3 font-semibold text-slate-800 text-sm">{amb.nombre}</td>
                    <td className="p-3 text-slate-600">{amb.capacidad} personas</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${amb.activo
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                      >
                        {amb.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleAmbienteActivo(amb)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${amb.activo
                            ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
                            : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                            }`}
                        >
                          {amb.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => setEditingAmbiente(amb)}
                          className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar ambiente y aforo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAmbiente(amb)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar ambiente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. Gestión de Recursos e Inventario (RF-05.3)                   */}
      {/* ============================================================== */}
      {activeSubTab === 'recursos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">Control de Inventario y Stock Total</h3>
              <p className="text-xs text-slate-500">
                Ajuste el stock total disponible y marque recursos críticos para el filtrado en calendario.
              </p>
            </div>
            <button
              onClick={() => setIsNewRecursoOpen(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Recurso</span>
            </button>
          </div>

          <div className="space-y-4">
            {catalogoRecursos.map((area) => (
              <div key={area.area_id} className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600"></span>
                  {area.area_nombre}
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                      <tr>
                        <th className="p-2.5">Recurso / Bien</th>
                        <th className="p-2.5">Clasificación</th>
                        <th className="p-2.5">Stock Total</th>
                        <th className="p-2.5">Ajuste Rápido</th>
                        <th className="p-2.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {area.recursos.map((rec) => {
                        const currentEditVal = editingStock[rec.id] ?? rec.stock_total;
                        const hasChanges = editingStock[rec.id] !== undefined && editingStock[rec.id] !== rec.stock_total;

                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-bold text-slate-800 text-sm">{rec.nombre}</td>
                            <td className="p-2.5">
                              <button
                                onClick={() => handleToggleCritico(rec)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${rec.es_critico
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                              >
                                {rec.es_critico ? '★ Equipo Crítico' : 'Estándar'}
                              </button>
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentEditVal}
                                  onChange={(e) =>
                                    setEditingStock((prev) => ({
                                      ...prev,
                                      [rec.id]: Number(e.target.value),
                                    }))
                                  }
                                  className="w-20 px-2 py-1 text-center font-bold text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                <span className="text-slate-400">unidades</span>
                              </div>
                            </td>
                            <td className="p-2.5">
                              {hasChanges ? (
                                <button
                                  onClick={() => handleSaveStock(rec.id)}
                                  className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
                                >
                                  Guardar
                                </button>
                              ) : (
                                <span className="text-slate-300 text-[11px]">Sin cambios</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() =>
                                    setEditingRecurso({
                                      id: rec.id,
                                      nombre: rec.nombre,
                                      area_destino_id: area.area_id,
                                      stock_total: rec.stock_total,
                                      es_critico: rec.es_critico,
                                    })
                                  }
                                  className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Editar nombre y datos del recurso"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecurso(rec)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Eliminar recurso del inventario"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. CRUD de Áreas Administrativas Responsables (Áreas Destino)   */}
      {/* ============================================================== */}
      {activeSubTab === 'areas_destino' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Áreas Administrativas Responsables (Operativas)
              </h3>
              <p className="text-xs text-slate-500">
                Gestión de áreas coordinadoras de activos: Servicios Generales y Mantenimiento, TI, Seguridad y SSOMA.
              </p>
            </div>
            <button
              onClick={() => setIsNewAreaDestinoOpen(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Área Operativa</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Área Administrativa</th>
                  <th className="p-3">Recursos en Inventario</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {areasDestino.map((area) => (
                  <tr key={area.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-mono font-bold text-slate-400">#{area.id}</td>
                    <td className="p-3 font-bold text-slate-800 text-sm">{area.nombre}</td>
                    <td className="p-3 text-slate-600">
                      <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {area.recursos_count} recursos
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${area.activa
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                      >
                        {area.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingAreaDestino(area)}
                          className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar nombre"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAreaDestino(area)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar área operativa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. Gestión de Áreas / Facultades Solicitantes (RF-05.4)         */}
      {/* ============================================================== */}
      {activeSubTab === 'areas_solicitantes' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Catálogo de Áreas y Facultades Solicitantes (RF-01.5 / RF-05.4)
              </h3>
              <p className="text-xs text-slate-500">
                Estas facultades alimentan dinámicamente la lista desplegable en el formulario de reserva pública.
              </p>
            </div>
            <button
              onClick={() => setIsNewAreaOpen(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Facultad / Área</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Área o Facultad</th>
                  <th className="p-3">Estado en Formulario Público</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {areasSolicitantes.map((area) => (
                  <tr key={area.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-mono font-bold text-slate-400">#{area.id}</td>
                    <td className="p-3 font-semibold text-slate-800 text-sm">{area.nombre}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${area.activa
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                      >
                        {area.activa ? 'Habilitada' : 'Oculta'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleAreaSolicitanteActiva(area)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${area.activa
                            ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
                            : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                            }`}
                        >
                          {area.activa ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                        <button
                          onClick={() => setEditingAreaSolicitante(area)}
                          className="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar nombre de facultad/área"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAreaSolicitante(area)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar del catálogo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. Gestión de Cuentas de Administrador (Multi-Admin)             */}
      {/* ============================================================== */}
      {activeSubTab === 'usuarios' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cuentas con Rol Administrador (Jefatura de Operaciones)
              </h3>
              <p className="text-xs text-slate-500">
                Administre los miembros del equipo que pueden aprobar reservas y gestionar el inventario.
              </p>
            </div>
            <button
              onClick={() => setIsNewAdminOpen(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Administrador</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Correo Institucional</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Fecha de Alta</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuariosAdmin.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-mono font-bold text-slate-400">#{user.id}</td>
                    <td className="p-3 font-bold text-slate-800 text-sm">{user.nombre}</td>
                    <td className="p-3 font-mono text-slate-600">{user.correo}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${user.activo
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                      >
                        {user.activo ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{formatDateShort(user.created_at)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleAdminActivo(user)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${user.activo
                            ? 'text-amber-600 border-amber-200 hover:bg-amber-50'
                            : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                            }`}
                        >
                          {user.activo ? 'Suspender' : 'Reactivar'}
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(user)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar cuenta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Rechazar Solicitud */}
      {rejectingSolicitud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              Rechazar Solicitud ({rejectingSolicitud.codigo_ticket})
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Indique el motivo por el cual se deniega la reserva. Esta justificación quedará visible para el solicitante al rastrear su trámite.
            </p>

            <textarea
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              placeholder="Escriba la razón de rechazo..."
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingSolicitud(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Ambiente */}
      {isNewAmbienteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleCreateAmbiente} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Ambiente</h3>
              <button type="button" onClick={() => setIsNewAmbienteOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Espacio</label>
              <input
                type="text"
                required
                value={newAmbienteData.nombre}
                onChange={(e) => setNewAmbienteData((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Sala de Grados Pabellón B"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidad / Aforo</label>
              <input
                type="number"
                min="1"
                required
                value={newAmbienteData.capacidad}
                onChange={(e) => setNewAmbienteData((prev) => ({ ...prev, capacidad: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsNewAmbienteOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Ambiente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Crear Recurso */}
      {isNewRecursoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleCreateRecurso} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Recurso</h3>
              <button type="button" onClick={() => setIsNewRecursoOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Recurso</label>
              <input
                type="text"
                required
                value={newRecursoData.nombre}
                onChange={(e) => setNewRecursoData((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Pizarra Acrílica Móvil"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Área Operativa Responsable</label>
              <select
                value={newRecursoData.area_destino_id}
                onChange={(e) => setNewRecursoData((prev) => ({ ...prev, area_destino_id: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              >
                {areasDestino.map((ad) => (
                  <option key={ad.id} value={ad.id}>
                    {ad.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Total Inicial</label>
              <input
                type="number"
                min="0"
                required
                value={newRecursoData.stock_total}
                onChange={(e) => setNewRecursoData((prev) => ({ ...prev, stock_total: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="check-crit"
                checked={newRecursoData.es_critico}
                onChange={(e) => setNewRecursoData((prev) => ({ ...prev, es_critico: e.target.checked }))}
                className="rounded text-brand-600"
              />
              <label htmlFor="check-crit" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Marcar como Equipo Crítico (para filtros de calendario)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsNewRecursoOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Recurso
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Crear Área Operativa (Área Destino) */}
      {isNewAreaDestinoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleCreateAreaDestino} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Registrar Área Operativa</h3>
              <button type="button" onClick={() => setIsNewAreaDestinoOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Área Administrativa</label>
              <input
                type="text"
                required
                value={newAreaDestinoData.nombre}
                onChange={(e) => setNewAreaDestinoData((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Seguridad e Inventarios"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsNewAreaDestinoOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Área
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Área Operativa (Área Destino) */}
      {editingAreaDestino && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleUpdateAreaDestino} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Editar Área Operativa</h3>
              <button type="button" onClick={() => setEditingAreaDestino(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Área</label>
              <input
                type="text"
                required
                value={editingAreaDestino.nombre}
                onChange={(e) => setEditingAreaDestino((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="check-activa"
                checked={editingAreaDestino.activa}
                onChange={(e) => setEditingAreaDestino((prev) => ({ ...prev, activa: e.target.checked }))}
                className="rounded text-brand-600"
              />
              <label htmlFor="check-activa" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Área operativa activa
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingAreaDestino(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Crear Área Solicitante */}
      {isNewAreaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleCreateAreaSolicitante} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Registrar Nueva Facultad / Área</h3>
              <button type="button" onClick={() => setIsNewAreaOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Oficial del Área</label>
              <input
                type="text"
                required
                value={newAreaNombre}
                onChange={(e) => setNewAreaNombre(e.target.value)}
                placeholder="Ej. Vicerrectorado de Investigación"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsNewAreaOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Área
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Crear Nuevo Administrador (Multi-Admin) */}
      {isNewAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleCreateAdmin} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Administrador</h3>
              <button type="button" onClick={() => setIsNewAdminOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                value={newAdminData.nombre}
                onChange={(e) => setNewAdminData((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Ing. Carlos Mendoza"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Institucional</label>
              <input
                type="email"
                required
                value={newAdminData.correo}
                onChange={(e) => setNewAdminData((prev) => ({ ...prev, correo: e.target.value }))}
                placeholder="ejemplo@continental.edu.pe"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Debe pertenecer al dominio @continental.edu.pe
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña Inicial</label>
              <input
                type="password"
                required
                minLength={6}
                value={newAdminData.password}
                onChange={(e) => setNewAdminData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsNewAdminOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Crear Cuenta
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Ambiente */}
      {editingAmbiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleUpdateAmbiente} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Editar Ambiente / Espacio</h3>
              <button type="button" onClick={() => setEditingAmbiente(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Espacio</label>
              <input
                type="text"
                required
                value={editingAmbiente.nombre}
                onChange={(e) => setEditingAmbiente((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Capacidad / Aforo Máximo</label>
              <input
                type="number"
                min="1"
                required
                value={editingAmbiente.capacidad}
                onChange={(e) => setEditingAmbiente((prev) => ({ ...prev, capacidad: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-amb-activo"
                checked={editingAmbiente.activo}
                onChange={(e) => setEditingAmbiente((prev) => ({ ...prev, activo: e.target.checked }))}
                className="rounded text-brand-600"
              />
              <label htmlFor="edit-amb-activo" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Ambiente disponible para reservas en el portal público
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingAmbiente(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Recurso */}
      {editingRecurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleUpdateRecurso} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Editar Recurso de Inventario</h3>
              <button type="button" onClick={() => setEditingRecurso(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Recurso</label>
              <input
                type="text"
                required
                value={editingRecurso.nombre}
                onChange={(e) => setEditingRecurso((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Área Operativa Responsable</label>
              <select
                value={editingRecurso.area_destino_id}
                onChange={(e) => setEditingRecurso((prev) => ({ ...prev, area_destino_id: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              >
                {areasDestino.map((ad) => (
                  <option key={ad.id} value={ad.id}>
                    {ad.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Total Disponible</label>
              <input
                type="number"
                min="0"
                required
                value={editingRecurso.stock_total}
                onChange={(e) => setEditingRecurso((prev) => ({ ...prev, stock_total: Number(e.target.value) }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-rec-crit"
                checked={editingRecurso.es_critico}
                onChange={(e) => setEditingRecurso((prev) => ({ ...prev, es_critico: e.target.checked }))}
                className="rounded text-brand-600"
              />
              <label htmlFor="edit-rec-crit" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Marcar como Equipo Crítico (para filtros de calendario)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingRecurso(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Área Solicitante */}
      {editingAreaSolicitante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <form onSubmit={handleUpdateAreaSolicitante} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Editar Facultad / Área Solicitante</h3>
              <button type="button" onClick={() => setEditingAreaSolicitante(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Oficial</label>
              <input
                type="text"
                required
                value={editingAreaSolicitante.nombre}
                onChange={(e) => setEditingAreaSolicitante((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-area-sol-activa"
                checked={editingAreaSolicitante.activa}
                onChange={(e) => setEditingAreaSolicitante((prev) => ({ ...prev, activa: e.target.checked }))}
                className="rounded text-brand-600"
              />
              <label htmlFor="edit-area-sol-activa" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Habilitada en la lista desplegable del formulario público
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingAreaSolicitante(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md">
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

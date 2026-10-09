import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  QrCode,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  CalendarDays,
  HardHat,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  Building,
  AlertCircle,
  FileText,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  Printer,
  Copy,
  Check,
  MapPin,
  Mail,
  UserCheck,
  AlertTriangle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import { formatDateShort, formatTimeRange } from '../utils/formatters';
import AccessCalendarPicker from '../components/Accesos/AccessCalendarPicker';

export default function AccesosModule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Tab activo: 'solicitar' | 'consultar'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'consultar' ? 'consultar' : 'solicitar');

  // -------------------------------------------------------------
  // ESTADO DEL FORMULARIO DE SOLICITUD DE ACCESO
  // -------------------------------------------------------------
  const [formData, setFormData] = useState({
    anfitrion_nombre: '',
    anfitrion_correo: '',
    anfitrion_area: '',
    sede: 'Campus Huancayo',
    ubicacion_especifica: '',
    motivo: '',
    fecha_inicio: '',
    fecha_fin: '',
    detalles: '',
    requiere_ssoma_riesgo: false,
    url_sctr_pdf: '',
    url_lista_personal_pdf: '',
  });

  const [visitantes, setVisitantes] = useState([
    { id: 1, nombre: '', dni: '', empresa: '' }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null); // { codigo_acceso, pase }
  const [formError, setFormError] = useState('');

  // -------------------------------------------------------------
  // ESTADO DE LA CONSULTA DE PASE DIGITAL
  // -------------------------------------------------------------
  const [codigoBusqueda, setCodigoBusqueda] = useState(searchParams.get('codigo') || '');
  const [searching, setSearching] = useState(false);
  const [paseEncontrado, setPaseEncontrado] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Manejo de cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Manejo de la lista dinámica de visitantes
  const handleAddVisitor = () => {
    setVisitantes((prev) => [
      ...prev,
      { id: Date.now(), nombre: '', dni: '', empresa: '' }
    ]);
  };

  const handleRemoveVisitor = (index) => {
    if (visitantes.length <= 1) return;
    setVisitantes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleVisitorChange = (index, field, value) => {
    setVisitantes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Enviar formulario de solicitud
  const handleSubmitSolicitud = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      // Validaciones básicas
      if (!formData.anfitrion_correo.includes('@')) {
        throw new Error('Ingrese un correo electrónico válido para el anfitrión.');
      }
      if (!formData.fecha_inicio || !formData.fecha_fin) {
        throw new Error('Debe especificar la fecha y hora de inicio y de fin.');
      }
      if (new Date(formData.fecha_inicio) >= new Date(formData.fecha_fin)) {
        throw new Error('La fecha y hora de inicio debe ser anterior a la de finalización.');
      }

      // Validar al menos un visitante completo
      const visitantesValidos = visitantes.filter((v) => v.nombre.trim() && v.dni.trim());
      if (visitantesValidos.length === 0) {
        throw new Error('Debe registrar al menos un visitante con nombre completo y DNI.');
      }

      if (formData.requiere_ssoma_riesgo && !formData.url_sctr_pdf.trim()) {
        throw new Error('Para trabajos de riesgo o proveedores con SCTR, debe adjuntar el enlace a la póliza SCTR en PDF.');
      }

      const payload = {
        anfitrion_nombre: formData.anfitrion_nombre.trim(),
        anfitrion_correo: formData.anfitrion_correo.trim().toLowerCase(),
        anfitrion_area: formData.anfitrion_area.trim(),
        sede: formData.sede,
        ubicacion_especifica: formData.ubicacion_especifica.trim(),
        motivo: formData.motivo.trim(),
        fecha_inicio: new Date(formData.fecha_inicio).toISOString(),
        fecha_fin: new Date(formData.fecha_fin).toISOString(),
        detalles: formData.detalles.trim() || null,
        requiere_ssoma_riesgo: formData.requiere_ssoma_riesgo,
        url_sctr_pdf: formData.url_sctr_pdf.trim() || null,
        url_lista_personal_pdf: formData.url_lista_personal_pdf.trim() || null,
        visitantes: visitantesValidos.map((v, idx) => ({
          id: idx + 1,
          nombre: v.nombre.trim(),
          dni: v.dni.trim(),
          empresa: v.empresa.trim() || 'Particular',
          ingresado: false,
          hora_ingreso: null,
        })),
      };

      const res = await api.createAcceso(payload);
      setSubmitSuccess({
        codigo_acceso: res.codigo_acceso,
        pase: res,
      });
    } catch (err) {
      setFormError(err.message || 'Error al procesar la solicitud de acceso.');
    } finally {
      setSubmitting(false);
    }
  };

  // Consultar pase con código
  const handleConsultarPase = async (codigoTarget) => {
    let raw = (codigoTarget || codigoBusqueda).trim();
    if (raw.includes('codigo=')) {
      const match = raw.match(/codigo=([A-Za-z0-9-]+)/);
      if (match) raw = match[1];
    }
    const code = raw.toUpperCase();
    if (!code) {
      setSearchError('Por favor ingrese un código de pase (ej. ACC-2026-R810).');
      return;
    }

    setSearching(true);
    setSearchError('');
    try {
      const data = await api.getAccesoByCodigo(code);
      setPaseEncontrado(data);
    } catch (err) {
      setPaseEncontrado(null);
      setSearchError(err.message || 'No se encontró ningún pase de acceso con ese código.');
    } finally {
      setSearching(false);
    }
  };

  // Copiar código al portapapeles
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Si viene con parámetro en URL para consultar, buscar automáticamente
  useEffect(() => {
    const codeUrl = searchParams.get('codigo');
    if (codeUrl) {
      setCodigoBusqueda(codeUrl);
      setActiveTab('consultar');
      handleConsultarPase(codeUrl);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white relative overflow-x-hidden">
      {/* Glows decorativos */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header con botón de retorno y branding institucional */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all group"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Portal Central</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold text-white">Universidad Continental</span>
              <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                Control de Accesos al Campus
              </span>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => {
                setActiveTab('solicitar');
                setSubmitSuccess(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'solicitar'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Solicitar Pase
            </button>
            <button
              onClick={() => setActiveTab('consultar')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'consultar'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Consultar Pase (QR)
            </button>
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal */}
      <main className="relative z-10 flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
        {/* ========================================================= */}
        {/* TAB 1: FORMULARIO DE REGISTRO DE SOLICITUD DE ACCESO      */}
        {/* ========================================================= */}
        {activeTab === 'solicitar' && !submitSuccess && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Encabezado del Formulario */}
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Gestión Digital de Ingreso a Campus</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Solicitud de Autorización y Pase de Acceso
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                Complete el formulario para solicitar la autorización de ingreso de visitantes, contratistas
                o proveedores externos a las instalaciones de la Universidad Continental.
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitSolicitud} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* SECCIÓN 1: DATOS DEL ANFITRIÓN INSTITUCIONAL */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-700/60">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Datos del Anfitrión / Responsable Institucional
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nombre Completo del Responsable: <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="anfitrion_nombre"
                      required
                      value={formData.anfitrion_nombre}
                      onChange={handleInputChange}
                      placeholder="Ej. Ing. Carlos Pérez Ramos"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Correo Electrónico Institucional: <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="anfitrion_correo"
                      required
                      value={formData.anfitrion_correo}
                      onChange={handleInputChange}
                      placeholder="usuario@continental.edu.pe"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Área, Facultad o Dirección Solicitante: <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="anfitrion_area"
                      required
                      value={formData.anfitrion_area}
                      onChange={handleInputChange}
                      placeholder="Ej. Dirección de Tecnologías / Fac. Ingeniería"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Sede Universitaria: <span className="text-amber-400">*</span>
                    </label>
                    <select
                      name="sede"
                      value={formData.sede}
                      onChange={handleInputChange}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                    >
                      <option value="Campus Huancayo">Campus Huancayo (San Carlos)</option>
                      <option value="Campus Huancayo - Pilcomayo">Campus Huancayo - Pilcomayo</option>
                      <option value="Campus Arequipa">Campus Arequipa</option>
                      <option value="Campus Cusco">Campus Cusco</option>
                      <option value="Sede Lima - Miraflores">Sede Lima - Miraflores</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: DATOS DE LA VISITA Y UBICACIÓN */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-700/60">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Datos de la Visita o Actividad en Campus
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Motivo del Acceso: <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="motivo"
                      required
                      value={formData.motivo}
                      onChange={handleInputChange}
                      placeholder="Ej. Mantenimiento de Antenas de Telecomunicaciones / Conferencia de Robótica"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Ubicación Específica / Destino: <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="ubicacion_especifica"
                      required
                      value={formData.ubicacion_especifica}
                      onChange={handleInputChange}
                      placeholder="Ej. Pabellón G - Laboratorio 302 / Techo Pabellón C"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Detalles Adicionales o Equipamiento a Ingresar:
                    </label>
                    <input
                      type="text"
                      name="detalles"
                      value={formData.detalles}
                      onChange={handleInputChange}
                      placeholder="Ej. Ingresan con maletín de herramientas y escaleras dieléctricas"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Programación de Fecha y Horario: <span className="text-amber-400">*</span>
                    </label>
                    <AccessCalendarPicker
                      fechaInicio={formData.fecha_inicio}
                      fechaFin={formData.fecha_fin}
                      onChange={({ fecha_inicio, fecha_fin }) => {
                        setFormData((prev) => ({
                          ...prev,
                          fecha_inicio,
                          fecha_fin,
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: APARTADO 3 - PROTOCOLO DE RIESGO Y SSOMA */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        Apartado 3: Protocolo SSOMA y Trabajos de Alto Riesgo
                      </h2>
                      <span className="text-[11px] text-slate-400">
                        Determinación de Póliza SCTR y verificación de seguridad
                      </span>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="requiere_ssoma_riesgo"
                      checked={formData.requiere_ssoma_riesgo}
                      onChange={handleInputChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    <span className="ml-3 text-xs font-bold text-slate-200">
                      {formData.requiere_ssoma_riesgo ? 'Activo (Con Riesgo / SCTR)' : 'Inactivo (Visita Estándar)'}
                    </span>
                  </label>
                </div>

                {/* Explicación de la regla de negocio */}
                {formData.requiere_ssoma_riesgo ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex items-start gap-3 text-xs text-amber-200 leading-relaxed">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold text-amber-300 block mb-0.5">
                          Flujo Caso A: Evaluación Obligatoria de SSOMA Activada
                        </strong>
                        Esta solicitud requerirá revisión obligatoria de las pólizas de seguridad por parte del
                        equipo de <strong>SSOMA</strong>. El pase digital en garita permanecerá bloqueado hasta que
                        el supervisor de SSOMA emita la autorización y dicte los lineamientos de resguardo.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Enlace a Póliza SCTR en PDF (Google Drive / OneDrive): <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="url"
                          name="url_sctr_pdf"
                          required={formData.requiere_ssoma_riesgo}
                          value={formData.url_sctr_pdf}
                          onChange={handleInputChange}
                          placeholder="https://drive.google.com/file/d/..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Enlace a Nómina Oficial de Personal en PDF (Opcional):
                        </label>
                        <input
                          type="url"
                          name="url_lista_personal_pdf"
                          value={formData.url_lista_personal_pdf}
                          onChange={handleInputChange}
                          placeholder="https://drive.google.com/file/d/..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-950/40 border border-blue-800/60 rounded-2xl flex items-start gap-3 text-xs text-blue-200 leading-relaxed">
                    <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold text-blue-300 block mb-0.5">
                        Flujo Caso B: Visita Estándar / Académica (Sin Riesgo Operativo)
                      </strong>
                      No requiere póliza SCTR. El pase digital se autorizará de forma directa hacia Garita de
                      Seguridad y se contabilizará en el aforo proyectado del campus.
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN 4: NÓMINA DE VISITANTES */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                      4
                    </div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Nómina de Visitantes / Personal Externo ({visitantes.length})
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddVisitor}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Persona</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {visitantes.map((vis, idx) => (
                    <div
                      key={vis.id}
                      className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-700/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                    >
                      <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                        {idx + 1}
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          value={vis.nombre}
                          onChange={(e) => handleVisitorChange(idx, 'nombre', e.target.value)}
                          placeholder="Nombre y Apellidos completos *"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="w-full sm:w-36">
                        <input
                          type="text"
                          required
                          value={vis.dni}
                          onChange={(e) => handleVisitorChange(idx, 'dni', e.target.value)}
                          placeholder="DNI / CE *"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>

                      <div className="w-full sm:w-44">
                        <input
                          type="text"
                          value={vis.empresa}
                          onChange={(e) => handleVisitorChange(idx, 'empresa', e.target.value)}
                          placeholder="Empresa / Rol"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {visitantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVisitor(idx)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                          title="Eliminar de nómina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón de Enviar */}
              <div className="pt-4 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-bold text-sm shadow-xl shadow-amber-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando Solicitud y Pase...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>Generar Solicitud de Acceso al Campus</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PANTALLA DE ÉXITO TRAS GENERAR SOLICITUD */}
        {activeTab === 'solicitar' && submitSuccess && (
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-8 sm:p-12 text-center space-y-6 max-w-xl mx-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                ¡Solicitud Registrada Exitosamente!
              </span>
              <h2 className="text-2xl font-black text-white">
                Pase de Acceso Generado
              </h2>
              <p className="text-xs text-slate-300">
                Guarde su código de pase para presentar en garita o realizar el seguimiento de su autorización.
              </p>
            </div>

            {/* Código QR Inmediato */}
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 shadow-lg flex items-center justify-center max-w-[210px] mx-auto">
              <QRCodeSVG
                value={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/?view=accesos&codigo=${submitSuccess.codigo_acceso}`
                    : `ACCESO:${submitSuccess.codigo_acceso}`
                }
                size={180}
                level="H"
                includeMargin={true}
                imageSettings={{
                  src: "https://marketingperu.beglobal.biz/wp-content/uploads/2026/05/Universiadad-Continental-Isotipo.png",
                  x: undefined,
                  y: undefined,
                  height: 32,
                  width: 32,
                  excavate: true,
                }}
              />
            </div>

            {/* Código en grande */}
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl flex items-center justify-between gap-3 max-w-xs mx-auto">
              <span className="font-mono font-black text-lg text-amber-300 tracking-wider">
                {submitSuccess.codigo_acceso}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(submitSuccess.codigo_acceso)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Copiar código"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCodigoBusqueda(submitSuccess.codigo_acceso);
                  setActiveTab('consultar');
                  handleConsultarPase(submitSuccess.codigo_acceso);
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Ver Mi Pase Digital con QR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubmitSuccess(null);
                  setFormData({
                    anfitrion_nombre: '',
                    anfitrion_correo: '',
                    anfitrion_area: '',
                    sede: 'Campus Huancayo',
                    ubicacion_especifica: '',
                    motivo: '',
                    fecha_inicio: '',
                    fecha_fin: '',
                    detalles: '',
                    requiere_ssoma_riesgo: false,
                    url_sctr_pdf: '',
                    url_lista_personal_pdf: '',
                  });
                  setVisitantes([{ id: 1, nombre: '', dni: '', empresa: '' }]);
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-colors"
              >
                Registrar Otra Solicitud
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CONSULTA DE PASE DIGITAL CON QR                    */}
        {/* ========================================================= */}
        {activeTab === 'consultar' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Buscador de Pase */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto shadow-xl text-center space-y-4">
              <h2 className="text-xl font-bold text-white">
                Consultar Estado y Pase Digital de Acceso
              </h2>
              <p className="text-xs text-slate-300">
                Ingrese el código de pase recibido al registrar la solicitud (ej. ACC-2026-R810).
              </p>

              <div className="flex items-center gap-2 max-w-md mx-auto">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={codigoBusqueda}
                    onChange={(e) => setCodigoBusqueda(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConsultarPase()}
                    placeholder="ACC-2026-XXXX"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono uppercase tracking-wider"
                  />
                </div>
                <button
                  type="button"
                  disabled={searching}
                  onClick={() => handleConsultarPase()}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Consultar</span>
                </button>
              </div>

              {searchError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  {searchError}
                </div>
              )}
            </div>

            {/* Credencial Digital / Pase con QR Encontrado */}
            {paseEncontrado && (
              <div className="max-w-2xl mx-auto bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                {/* Cabecera de la Credencial */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-6 sm:p-7 relative overflow-hidden">
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white p-1 flex items-center justify-center">
                        <img
                          src="https://marketingperu.beglobal.biz/wp-content/uploads/2026/05/Universiadad-Continental-Isotipo.png"
                          alt="Logo Continental"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight">
                          Universidad Continental
                        </h3>
                        <p className="text-[11px] text-amber-300 font-medium">Pase Oficial de Acceso al Campus</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-xs bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-amber-300 block">
                        {paseEncontrado.codigo_acceso}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Banner de Estado */}
                <div
                  className={`px-6 py-3 text-xs font-bold flex items-center justify-between border-y ${
                    paseEncontrado.estado === 'AUTORIZADO'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : paseEncontrado.estado === 'OBSERVADO'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {paseEncontrado.estado === 'AUTORIZADO' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : paseEncontrado.estado === 'OBSERVADO' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600" />
                    )}
                    <span>
                      {paseEncontrado.estado === 'AUTORIZADO'
                        ? 'PASE AUTORIZADO - HABILITADO EN GARITA'
                        : paseEncontrado.estado === 'OBSERVADO'
                        ? 'PASE OBSERVADO POR SSOMA (ACCESO DENEGADO)'
                        : 'EN REVISIÓN POR SSOMA (PASE EN ESPERA)'}
                    </span>
                  </div>

                  <span className="text-[11px] font-semibold">
                    {paseEncontrado.requiere_ssoma_riesgo ? 'Con SCTR' : 'Estándar'}
                  </span>
                </div>

                {/* Cuerpo del Pase con QR */}
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Código QR Oficial Escaneable de Alta Resolución */}
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-200/80 text-center">
                    <div className="bg-white p-4 rounded-2xl border-2 border-slate-900 shadow-lg flex items-center justify-center">
                      <QRCodeSVG
                        value={
                          typeof window !== 'undefined'
                            ? `${window.location.origin}/?view=accesos&codigo=${paseEncontrado.codigo_acceso}`
                            : `ACCESO:${paseEncontrado.codigo_acceso}`
                        }
                        size={210}
                        level="H"
                        includeMargin={true}
                        imageSettings={{
                          src: "https://marketingperu.beglobal.biz/wp-content/uploads/2026/05/Universiadad-Continental-Isotipo.png",
                          x: undefined,
                          y: undefined,
                          height: 38,
                          width: 38,
                          excavate: true,
                        }}
                      />
                    </div>

                    <div className="mt-3.5 space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 bg-slate-200/80 px-2.5 py-0.5 rounded-lg border border-slate-300 tracking-wider">
                          {paseEncontrado.codigo_acceso}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(paseEncontrado.codigo_acceso)}
                          className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
                          title="Copiar código de acceso"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Escanee con la cámara de su celular o lector de Garita para verificar vigencia
                      </p>
                    </div>
                  </div>

                  {/* Detalle de la Visita */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block font-semibold">Motivo:</span>
                      <strong className="text-slate-900 text-sm">{paseEncontrado.motivo}</strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-semibold">Destino en Campus:</span>
                      <strong className="text-slate-900">{paseEncontrado.sede}</strong>
                      <span className="text-slate-600 block text-[11px]">{paseEncontrado.ubicacion_especifica}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-semibold">Anfitrión Continental:</span>
                      <span className="text-slate-800 font-medium">{paseEncontrado.anfitrion_nombre}</span>
                      <span className="text-slate-500 block text-[11px]">{paseEncontrado.anfitrion_area}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-semibold">Horario de Ingreso:</span>
                      <span className="text-slate-800 font-medium">
                        {formatDateShort(paseEncontrado.fecha_inicio)} ({formatTimeRange(paseEncontrado.fecha_inicio, paseEncontrado.fecha_fin)})
                      </span>
                    </div>
                  </div>

                  {/* LINEAMIENTOS OBLIGATORIOS DE SSOMA */}
                  {paseEncontrado.lineamientos_ssoma && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-900 font-bold uppercase tracking-wide">
                        <ShieldAlert className="w-4 h-4 text-amber-700" />
                        <span>Lineamientos de Seguridad Dictados por SSOMA:</span>
                      </div>
                      <p className="text-amber-950 font-medium leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200">
                        {paseEncontrado.lineamientos_ssoma}
                      </p>
                    </div>
                  )}

                  {/* OBSERVACIÓN DE SSOMA SI ESTÁ OBSERVADO */}
                  {paseEncontrado.observacion_ssoma && (
                    <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-1.5">
                      <div className="flex items-center gap-2 text-rose-900 font-bold uppercase tracking-wide">
                        <AlertTriangle className="w-4 h-4 text-rose-700" />
                        <span>Observación Registrada por SSOMA:</span>
                      </div>
                      <p className="text-rose-950 font-semibold bg-white/80 p-3 rounded-xl border border-rose-200">
                        {paseEncontrado.observacion_ssoma}
                      </p>
                    </div>
                  )}

                  {/* Nómina de Personas en el Pase */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-600" />
                      <span>Personas Autorizadas ({paseEncontrado.visitantes?.length || 0})</span>
                    </h4>

                    <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden text-xs">
                      {(paseEncontrado.visitantes || []).map((v, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{v.nombre}</span>
                            <div className="text-[11px] text-slate-500 font-mono">
                              DNI: <strong>{v.dni}</strong> • {v.empresa || 'Particular'}
                            </div>
                          </div>
                          {v.ingresado ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Ingresó ({v.hora_ingreso || 'Registrado'})
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Pendiente ingreso
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botón de Impresión */}
                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm"
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>Imprimir / Guardar Pase Digital</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

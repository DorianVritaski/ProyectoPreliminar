import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HeartPulse,
  User,
  Users,
  ShieldCheck,
  Calendar,
  Clock,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Printer,
  Copy,
  Check,
  Loader2,
  Lock,
  Stethoscope,
  Sparkles,
  Phone,
  Mail,
  CreditCard,
  BookOpen,
  Search,
  AlertTriangle,
  Link2
} from 'lucide-react';
import { api } from '../api/client';
import { formatDateShort } from '../utils/formatters';

const ESCUELAS = [
  { id: 'Odontología', label: 'Odontología', icon: '🦷', desc: 'Atención en Clínicas Odontológicas' },
  { id: 'Psicología (Cámara Gesell)', label: 'Psicología (Cámara Gesell)', icon: '🧠', desc: 'Evaluaciones y Entrevistas Clínicas / Gesell' },
  { id: 'Enfermería / Terapia Física', label: 'Enfermería / Terapia Física', icon: '🩺', desc: 'Procedimientos y Prácticas de Rehabilitación' },
];

export default function PacientesModule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Tab activo: 'solicitar' | 'consultar'
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'consultar' ? 'consultar' : 'solicitar');
  const [step, setStep] = useState(1);

  // -------------------------------------------------------------
  // ESTADO DEL FORMULARIO DE REGISTRO
  // -------------------------------------------------------------
  const [formData, setFormData] = useState({
    escuela_profesional: 'Odontología',
    estudiante_correo: '',
    estudiante_nombre: '',
    estudiante_dni: '',
    estudiante_telefono: '',
    paciente_nombre: '',
    paciente_dni: '',
    paciente_telefono: '',
    es_menor_edad: false,
    apoderado_nombre: '',
    apoderado_dni: '',
    asignatura: '',
    nrc: '',
    docente_nombre: '',
    fecha_atencion: new Date().toISOString().split('T')[0],
    horario_inicio: '08:40',
    horario_fin: '10:10',
    url_consentimiento_pdf: '',
    declaracion_aceptada: false,
  });

  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null); // ticket creado
  const [formError, setFormError] = useState('');

  // -------------------------------------------------------------
  // ESTADO DE LA CONSULTA DE CITA
  // -------------------------------------------------------------
  const [codigoBusqueda, setCodigoBusqueda] = useState(searchParams.get('codigo') || '');
  const [searching, setSearching] = useState(false);
  const [citaEncontrada, setCitaEncontrada] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Manejo de cambios simples
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError('');
  };

  // Manejo de subida de archivo (PDF o Imagen)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
      setFormError('El archivo debe estar en formato PDF (.pdf) o imagen (.jpg, .jpeg, .png).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFormError('El archivo excede el tamaño máximo permitido de 15MB.');
      return;
    }

    setFormError('');
    setUploadingFile(true);
    try {
      const res = await api.uploadArchivo(file);
      setFormData((prev) => ({ ...prev, url_consentimiento_pdf: res.url }));
      setUploadedFileName(file.name);
    } catch (err) {
      setFormError(err.message || 'Error al subir el consentimiento escaneado.');
    } finally {
      setUploadingFile(false);
    }
  };

  // Validaciones por paso
  const validateStep1 = () => {
    if (!formData.escuela_profesional) {
      setFormError('Seleccione la Escuela Profesional.');
      return false;
    }
    const correo = formData.estudiante_correo.trim().toLowerCase();
    if (!correo || !correo.endsWith('@continental.edu.pe')) {
      setFormError('Debe ingresar un correo institucional válido (@continental.edu.pe).');
      return false;
    }
    if (!formData.estudiante_nombre.trim()) {
      setFormError('Ingrese los apellidos y nombres del estudiante a cargo.');
      return false;
    }
    const dni = formData.estudiante_dni.trim();
    if (!dni || !/^\d{8}$/.test(dni)) {
      setFormError('El DNI del estudiante debe tener exactamente 8 dígitos numéricos.');
      return false;
    }
    if (!formData.estudiante_telefono.trim()) {
      setFormError('Ingrese el teléfono o celular del estudiante (para coordinación en garita).');
      return false;
    }
    if (!formData.asignatura.trim()) {
      setFormError('Ingrese el nombre de la Asignatura o Curso práctico.');
      return false;
    }
    if (formData.escuela_profesional.includes('Psicología') && !formData.docente_nombre.trim()) {
      setFormError('Para la Escuela de Psicología (Cámara Gesell), el nombre del docente a cargo es obligatorio.');
      return false;
    }
    setFormError('');
    return true;
  };

  const validateStep2 = () => {
    if (!formData.paciente_nombre.trim()) {
      setFormError('Ingrese los apellidos y nombres del paciente.');
      return false;
    }
    const pacDni = formData.paciente_dni.trim();
    if (!pacDni || pacDni.length < 8) {
      setFormError('Ingrese un documento de identidad válido para el paciente (mínimo 8 caracteres).');
      return false;
    }
    if (formData.es_menor_edad) {
      if (!formData.apoderado_nombre.trim()) {
        setFormError('Si el paciente es menor de edad, debe ingresar los nombres del apoderado.');
        return false;
      }
      if (!formData.apoderado_dni.trim() || formData.apoderado_dni.trim().length < 8) {
        setFormError('Ingrese el DNI del apoderado.');
        return false;
      }
    }
    if (!formData.fecha_atencion) {
      setFormError('Seleccione la fecha de atención.');
      return false;
    }
    if (!formData.horario_inicio || !formData.horario_fin) {
      setFormError('Indique el horario de inicio y fin de la atención.');
      return false;
    }
    setFormError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step !== 3) {
      handleNext();
      return;
    }

    const driveLink = (formData.url_consentimiento_pdf || '').trim();
    if (!driveLink) {
      setFormError('Debe ingresar el enlace de Google Drive con el Consentimiento Informado escaneado y DNI.');
      return;
    }
    if (!driveLink.startsWith('http://') && !driveLink.startsWith('https://')) {
      setFormError('El enlace de Google Drive debe ser una URL válida que empiece con https:// (ej. https://drive.google.com/...)');
      return;
    }
    if (!formData.declaracion_aceptada) {
      setFormError('Debe marcar la casilla de aceptación de responsabilidad para tramitar la cita.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        escuela_profesional: formData.escuela_profesional,
        estudiante_correo: formData.estudiante_correo.trim().toLowerCase(),
        estudiante_nombre: formData.estudiante_nombre.trim(),
        estudiante_dni: formData.estudiante_dni.trim(),
        estudiante_telefono: formData.estudiante_telefono.trim(),
        paciente_nombre: formData.paciente_nombre.trim(),
        paciente_dni: formData.paciente_dni.trim(),
        paciente_telefono: formData.paciente_telefono.trim() || null,
        es_menor_edad: Boolean(formData.es_menor_edad),
        apoderado_nombre: formData.es_menor_edad ? formData.apoderado_nombre.trim() : null,
        apoderado_dni: formData.es_menor_edad ? formData.apoderado_dni.trim() : null,
        asignatura: formData.asignatura.trim(),
        nrc: formData.nrc.trim() || null,
        docente_nombre: formData.docente_nombre.trim() || null,
        fecha_atencion: formData.fecha_atencion,
        horario_inicio: formData.horario_inicio,
        horario_fin: formData.horario_fin,
        url_consentimiento_pdf: formData.url_consentimiento_pdf,
        declaracion_aceptada: true,
      };

      const result = await api.crearPaciente(payload);
      setSubmitSuccess(result);
    } catch (err) {
      setFormError(err.message || 'Error al registrar el paciente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Consultar cita existente
  const handleConsultarCita = async (targetCode) => {
    const raw = (targetCode || codigoBusqueda).trim().toUpperCase();
    if (!raw) {
      setSearchError('Por favor ingrese el código de cita (ej. PAC-2026-8912).');
      return;
    }

    setSearching(true);
    setSearchError('');
    try {
      const data = await api.getPacienteByCodigo(raw);
      setCitaEncontrada(data);
    } catch (err) {
      setCitaEncontrada(null);
      setSearchError(err.message || 'No se encontró ninguna cita registrada con ese código.');
    } finally {
      setSearching(false);
    }
  };

  const handleCopyTicket = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Reset del formulario para nuevo paciente
  const handleResetForm = () => {
    setFormData({
      escuela_profesional: 'Odontología',
      estudiante_correo: '',
      estudiante_nombre: '',
      estudiante_dni: '',
      estudiante_telefono: '',
      paciente_nombre: '',
      paciente_dni: '',
      paciente_telefono: '',
      es_menor_edad: false,
      apoderado_nombre: '',
      apoderado_dni: '',
      asignatura: '',
      nrc: '',
      docente_nombre: '',
      fecha_atencion: new Date().toISOString().split('T')[0],
      horario_inicio: '08:40',
      horario_fin: '10:10',
      url_consentimiento_pdf: '',
      declaracion_aceptada: false,
    });
    setUploadedFileName('');
    setSubmitSuccess(null);
    setStep(1);
    setFormError('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white relative overflow-x-hidden print:bg-white print:text-slate-900 print:min-h-0">
      {/* Glows decorativos */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.18),rgba(255,255,255,0))] pointer-events-none print:hidden" />
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none print:hidden" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none print:hidden" />

      {/* 1. Header con botón de retorno y navegación */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/accesos')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all group"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Volver a Accesos</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-700 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold text-white">Universidad Continental</span>
              <span className="text-[10px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full font-semibold">
                Prácticas Clínicas
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
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Registrar Paciente
            </button>
            <button
              onClick={() => setActiveTab('consultar')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'consultar'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Consultar Cita
            </button>
          </div>
        </div>
      </header>

      {/* 2. Contenido Principal */}
      <main className="relative z-10 flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full print:p-0 print:m-0 print:max-w-none">
        {/* ========================================================= */}
        {/* TAB 1: FORMULARIO DE REGISTRO EN 3 PASOS                 */}
        {/* ========================================================= */}
        {activeTab === 'solicitar' && !submitSuccess && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Encabezado */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-300 text-xs font-semibold">
                <HeartPulse className="w-4 h-4 text-teal-400 animate-pulse" />
                <span>Formulario Unificado de Prácticas Clínicas y Académicas</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Ingreso de Pacientes al Campus
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Registro oficial para pacientes de <strong>Odontología</strong>, <strong>Psicología (Cámara Gesell)</strong> y <strong>Enfermería / Terapia Física</strong>. Sincroniza en tiempo real la lista de ingreso con la garita de vigilancia.
              </p>
            </div>

            {/* Stepper Superior */}
            <div className="max-w-xl mx-auto">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-slate-800 -z-0"></div>
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300 -z-0"
                  style={{ width: `${((step - 1) / 2) * 100}%` }}
                ></div>

                {[
                  { num: 1, label: 'Estudiante y Curso' },
                  { num: 2, label: 'Datos del Paciente' },
                  { num: 3, label: 'Consentimiento y DJ' },
                ].map((s) => (
                  <div key={s.num} className="relative z-10 flex flex-col items-center">
                    <button
                      type="button"
                      disabled={s.num > step}
                      onClick={() => setStep(s.num)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        step === s.num
                          ? 'bg-teal-500 text-white ring-4 ring-teal-500/20 shadow-lg shadow-teal-500/30'
                          : step > s.num
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                    </button>
                    <span className="text-[11px] font-semibold mt-1.5 text-slate-300 hidden sm:block">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Banner de Error */}
              {formError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-semibold animate-in shake duration-200">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* PASO 1: DATOS DEL ESTUDIANTE Y ASIGNATURA */}
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-800/80 pb-3">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-teal-400" />
                      Paso 1: Carrera Profesional y Estudiante a Cargo
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Identificación del alumno responsable que recibirá y guiará al paciente en el campus.
                    </p>
                  </div>

                  {/* Selector de Escuela Profesional */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Escuela Profesional / Especialidad <span className="text-rose-400">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {ESCUELAS.map((esc) => {
                        const selected = formData.escuela_profesional === esc.id;
                        return (
                          <button
                            key={esc.id}
                            type="button"
                            onClick={() => handleInputChange('escuela_profesional', esc.id)}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                              selected
                                ? 'bg-teal-500/15 border-teal-500 text-white shadow-md shadow-teal-500/10 ring-1 ring-teal-500'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-2xl">{esc.icon}</span>
                              {selected && <CheckCircle2 className="w-4 h-4 text-teal-400" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">{esc.label}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{esc.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Datos del Estudiante */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Correo Institucional <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={formData.estudiante_correo}
                          onChange={(e) => handleInputChange('estudiante_correo', e.target.value)}
                          placeholder="ej. 72819340@continental.edu.pe"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Apellidos y Nombres del Estudiante <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={formData.estudiante_nombre}
                          onChange={(e) => handleInputChange('estudiante_nombre', e.target.value)}
                          placeholder="Apellidos y nombres completos"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        DNI del Estudiante (8 dígitos) <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <CreditCard className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          maxLength={8}
                          value={formData.estudiante_dni}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val.length <= 8) handleInputChange('estudiante_dni', val);
                          }}
                          placeholder="8 dígitos"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Teléfono / Celular del Estudiante <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          maxLength={9}
                          value={formData.estudiante_telefono}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val.length <= 9) handleInputChange('estudiante_telefono', val);
                          }}
                          placeholder="ej. 964123456"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Vigilancia lo llamará cuando el paciente se presente en garita.
                      </span>
                    </div>
                  </div>

                  {/* Asignatura y Docente */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Asignatura / Curso Práctico <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.asignatura}
                        onChange={(e) => handleInputChange('asignatura', e.target.value)}
                        placeholder="ej. Clínica Integral del Adulto I / Evaluación Psicológica"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        NRC del Curso
                      </label>
                      <input
                        type="text"
                        value={formData.nrc}
                        onChange={(e) => handleInputChange('nrc', e.target.value)}
                        placeholder="ej. 14205"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Docente a Cargo {formData.escuela_profesional.includes('Psicología') ? <span className="text-rose-400">* (Obligatorio en Gesell)</span> : <span className="text-slate-500">(Opcional)</span>}
                      </label>
                      <input
                        type="text"
                        required={formData.escuela_profesional.includes('Psicología')}
                        value={formData.docente_nombre}
                        onChange={(e) => handleInputChange('docente_nombre', e.target.value)}
                        placeholder="Nombres y apellidos del docente responsable de la práctica"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 2: DATOS DEL PACIENTE */}
              {step === 2 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-800/80 pb-3">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <User className="w-5 h-5 text-teal-400" />
                      Paso 2: Datos del Paciente y Horario de Atención
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Información física para el control y verificación de identidad en puerta de ingreso.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Apellidos y Nombres del Paciente <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.paciente_nombre}
                        onChange={(e) => handleInputChange('paciente_nombre', e.target.value)}
                        placeholder="Nombre completo tal como figura en su DNI"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        DNI / Documento del Paciente <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.paciente_dni}
                        onChange={(e) => handleInputChange('paciente_dni', e.target.value.trim())}
                        placeholder="DNI (8 dígitos) o Carnet Extranjería"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                        Teléfono del Paciente / Contacto <span className="text-slate-500">(Opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.paciente_telefono}
                        onChange={(e) => handleInputChange('paciente_telefono', e.target.value)}
                        placeholder="ej. 954789012"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                      />
                    </div>
                  </div>

                  {/* Checkbox Menor de Edad */}
                  <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.es_menor_edad}
                        onChange={(e) => handleInputChange('es_menor_edad', e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-700 bg-slate-950 mt-0.5 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-white block">
                          El paciente es menor de edad (requiere apoderado)
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Marque esta casilla si el paciente tiene menos de 18 años para ingresar los datos del tutor legal que lo acompañará.
                        </span>
                      </div>
                    </label>

                    {formData.es_menor_edad && (
                      <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-teal-300 mb-1">
                            Apellidos y Nombres del Apoderado <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required={formData.es_menor_edad}
                            value={formData.apoderado_nombre}
                            onChange={(e) => handleInputChange('apoderado_nombre', e.target.value)}
                            placeholder="Nombre completo del padre/madre o apoderado"
                            className="w-full bg-slate-950 border border-teal-500/40 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-teal-300 mb-1">
                            DNI del Apoderado <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required={formData.es_menor_edad}
                            value={formData.apoderado_dni}
                            onChange={(e) => handleInputChange('apoderado_dni', e.target.value.trim())}
                            placeholder="DNI del apoderado (8 dígitos)"
                            className="w-full bg-slate-950 border border-teal-500/40 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fecha y Horario de Atención */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-teal-400" />
                      Programación de la Cita de Práctica
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Fecha de Atención <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.fecha_atencion}
                          onChange={(e) => handleInputChange('fecha_atencion', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Hora de Inicio <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.horario_inicio}
                          onChange={(e) => handleInputChange('horario_inicio', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Hora de Fin <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.horario_fin}
                          onChange={(e) => handleInputChange('horario_fin', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 3: DOCUMENTACIÓN Y DECLARACIÓN JURADA */}
              {step === 3 && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="border-b border-slate-800/80 pb-3">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <FileText className="w-5 h-5 text-teal-400" />
                      Paso 3: Consentimiento Informado y Declaración Jurada
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Adjunte la documentación mediante enlace de Google Drive con permisos de lectura.
                    </p>
                  </div>

                  {/* Resumen previo */}
                  <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-semibold uppercase">Escuela</span>
                      <span className="font-bold text-teal-300">{formData.escuela_profesional}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-semibold uppercase">Paciente</span>
                      <span className="font-bold text-white">{formData.paciente_nombre}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-semibold uppercase">Estudiante</span>
                      <span className="font-bold text-white">{formData.estudiante_nombre}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-semibold uppercase">Fecha y Hora</span>
                      <span className="font-bold text-white font-mono">{formData.fecha_atencion} ({formData.horario_inicio} - {formData.horario_fin})</span>
                    </div>
                  </div>

                  {/* Entrada de Enlace de Google Drive */}
                  <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-teal-400" />
                        <span>Consentimiento Informado y DNI escaneado <span className="text-rose-400">*</span></span>
                      </label>
                      <span className="text-[10px] bg-teal-500/10 text-teal-300 font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30 flex items-center gap-1">
                        <span>Google Drive</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pegue el enlace del archivo o carpeta de <strong>Google Drive</strong> que contiene el Consentimiento Informado escaneado/firmado por el paciente (o apoderado) junto con la copia legible de su DNI.
                    </p>

                    {/* Alerta de Permisos en Google Drive */}
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-amber-300 block">
                          Permisos requeridos en Google Drive:
                        </span>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          Asegúrese de configurar el archivo o carpeta compartida con permisos de acceso para <strong>"Cualquier persona con el enlace"</strong> (o con su cuenta institucional <strong>@continental.edu.pe</strong> como lector) para que SSOMA y la Garita de Vigilancia puedan verificar los documentos sin solicitar permisos.
                        </p>
                      </div>
                    </div>

                    {/* Campo de Enlace con botón para probarlo */}
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="url"
                          required
                          value={formData.url_consentimiento_pdf}
                          onChange={(e) => handleInputChange('url_consentimiento_pdf', e.target.value.trim())}
                          placeholder="https://drive.google.com/file/d/... o https://drive.google.com/drive/folders/..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl pl-4 pr-32 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono"
                        />
                        {formData.url_consentimiento_pdf.trim() && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <a
                              href={formData.url_consentimiento_pdf.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[11px] font-bold border border-teal-500/30 transition-all shadow-xs"
                              title="Probar enlace en una pestaña nueva"
                            >
                              <span>Probar Enlace</span>
                              <ExternalLink className="w-3 h-3 text-teal-300" />
                            </a>
                          </div>
                        )}
                      </div>

                      {formData.url_consentimiento_pdf.trim() && (
                        <div className="flex items-center gap-1.5 text-[11px] text-teal-400">
                          <Check className="w-3.5 h-3.5 text-teal-400" />
                          <span>Enlace listo. Puede pulsar <strong>Probar Enlace</strong> para verificar que abre correctamente.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Declaración Jurada */}
                  <div className="p-4 bg-teal-500/10 border border-teal-500/25 rounded-2xl space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={formData.declaracion_aceptada}
                        onChange={(e) => handleInputChange('declaracion_aceptada', e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-700 bg-slate-950 mt-1 cursor-pointer"
                      />
                      <div className="text-xs text-slate-200 leading-relaxed">
                        <span className="font-bold text-teal-300 block mb-1">
                          Declaración de Responsabilidad Institucional
                        </span>
                        "Acepto mi responsabilidad sobre el ingreso de mi paciente. Me comprometo a recibirlo en puerta principal a la hora programada y garantizo que portará su DNI físico original para el control de Vigilancia y SSOMA."
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Botones de Navegación del Formulario */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Anterior</span>
                  </button>
                ) : (
                  <div></div>
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-600/30 transition-all ml-auto"
                  >
                    <span>Siguiente Paso</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-600/30 transition-all ml-auto disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generando Ticket de Ingreso...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirmar y Enviar Registro</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* PANTALLA DE ÉXITO TRAS REGISTRO                           */}
        {/* ========================================================= */}
        {submitSuccess && (
          <div className="space-y-6 animate-in zoom-in-95 duration-200 max-w-2xl mx-auto">
            <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 print:border-none print:shadow-none print:p-0">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 print:hidden">
                <Check className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-teal-400 font-bold block mb-1">
                  Cita de Práctica Clínica Registrada
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  ¡Pase de Paciente Generado con Éxito!
                </h2>
                <p className="text-xs text-slate-400 mt-2">
                  Presente este código en puerta. El personal de vigilancia verificará el DNI del paciente y llamará al estudiante a cargo.
                </p>
              </div>

              {/* Tarjeta del Ticket */}
              <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-teal-500/50 rounded-2xl text-left space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Código de Ticket</span>
                    <span className="text-2xl font-black text-teal-300 font-mono tracking-wider">
                      {submitSuccess.codigo_ticket}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyTicket(submitSuccess.codigo_ticket)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-bold border border-teal-500/30 transition-all print:hidden"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? '¡Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Paciente</span>
                    <span className="font-bold text-white">{submitSuccess.paciente_nombre}</span>
                    <span className="text-slate-400 block font-mono text-[11px]">DNI: {submitSuccess.paciente_dni}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Escuela</span>
                    <span className="font-bold text-teal-300">{submitSuccess.escuela_profesional}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Estudiante a Cargo</span>
                    <span className="font-bold text-white">{submitSuccess.estudiante_nombre}</span>
                    <span className="text-slate-400 block font-mono text-[11px]">Cel: {submitSuccess.estudiante_telefono}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Fecha y Horario</span>
                    <span className="font-bold text-white font-mono">{submitSuccess.fecha_atencion}</span>
                    <span className="text-teal-400 block font-mono text-[11px]">{submitSuccess.horario_inicio} - {submitSuccess.horario_fin}</span>
                  </div>

                  {submitSuccess.es_menor_edad && (
                    <div className="col-span-2 pt-2 border-t border-slate-800 text-[11px]">
                      <span className="text-amber-400 font-bold">Acompañado por Apoderado: </span>
                      <span className="text-slate-300">{submitSuccess.apoderado_nombre} (DNI: {submitSuccess.apoderado_dni})</span>
                    </div>
                  )}

                  {submitSuccess.url_consentimiento_pdf && (
                    <div className="col-span-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Consentimiento y DNI:</span>
                      <a
                        href={api.getFileUrl(submitSuccess.url_consentimiento_pdf)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-bold"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Abrir en Google Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de acción post-registro */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all"
                >
                  <Printer className="w-4 h-4 text-teal-400" />
                  <span>Imprimir Constancia</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetForm}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/30 transition-all"
                >
                  <Users className="w-4 h-4" />
                  <span>Registrar Otro Paciente</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CONSULTA RÁPIDA DE CITA                             */}
        {/* ========================================================= */}
        {activeTab === 'consultar' && (
          <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-200">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">Consulta de Cita de Práctica Clínica</h2>
              <p className="text-xs text-slate-400">
                Ingrese el código de ticket para verificar el estado de autorización o ingreso en garita.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={codigoBusqueda}
                    onChange={(e) => setCodigoBusqueda(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleConsultarCita()}
                    placeholder="ej. PAC-2026-8912"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                  />
                </div>
                <button
                  type="button"
                  disabled={searching}
                  onClick={() => handleConsultarCita()}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all flex items-center gap-2"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Buscar</span>
                </button>
              </div>

              {searchError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {citaEncontrada && (
                <div className="mt-4 p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Ticket</span>
                      <span className="text-lg font-black text-teal-300 font-mono">{citaEncontrada.codigo_ticket}</span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      citaEncontrada.ingresado_garita
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {citaEncontrada.ingresado_garita ? '✓ Ingresó a Campus' : '⏳ Pendiente en Puerta'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Paciente</span>
                      <span className="font-bold text-white">{citaEncontrada.paciente_nombre} (DNI: {citaEncontrada.paciente_dni})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Escuela</span>
                      <span className="font-bold text-teal-300">{citaEncontrada.escuela_profesional}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Estudiante Responsable</span>
                      <span className="font-bold text-white">{citaEncontrada.estudiante_nombre} (Cel: {citaEncontrada.estudiante_telefono})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold block">Horario</span>
                      <span className="font-bold text-white font-mono">{citaEncontrada.fecha_atencion} ({citaEncontrada.horario_inicio} - {citaEncontrada.horario_fin})</span>
                    </div>
                  </div>

                  {citaEncontrada.url_consentimiento_pdf && (
                    <div className="pt-2 border-t border-slate-800">
                      <a
                        href={api.getFileUrl(citaEncontrada.url_consentimiento_pdf)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-bold"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ver Consentimiento en Google Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/70 py-6 text-center text-xs text-slate-500 print:hidden">
        <p>© {new Date().getFullYear()} Universidad Continental — Módulo de Prácticas Clínicas y Control de Accesos</p>
      </footer>
    </div>
  );
}

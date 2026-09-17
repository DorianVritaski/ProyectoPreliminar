import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  Layers,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building,
  Info,
  Link2,
  ExternalLink,
  FileText,
  UploadCloud,
  Trash2,
  Eye,
} from 'lucide-react';
import { api } from '../../api/client';

export default function ReservationModal({
  isOpen,
  prefilledDate,
  ambientes,
  onClose,
  onSuccessCreated,
  onGoToTracking,
}) {
  const [step, setStep] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    correo_solicitante: '',
    telefono: '',
    area_solicitante_id: '',
    ambiente_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    detalles: '',
    croquis_url: '',
    protocolo_ssoma: false,
    requiere_ssoma: false,
    url_sctr_pdf: '',
    url_personal_externo_pdf: '',
    recursos: {}, // { [recurso_id]: cantidad }
  });

  // Resources state & availability
  const [areasSolicitantes, setAreasSolicitantes] = useState([]);
  const [catalogoAreas, setCatalogoAreas] = useState([]);
  const [stockDisponibilidad, setStockDisponibilidad] = useState({}); // { [recurso_id]: { disponible, reservado, total, ... } }
  const [loadingStock, setLoadingStock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdTicket, setCreatedTicket] = useState(null);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [step3Armed, setStep3Armed] = useState(false);

  // Estados para subida de PDFs de SSOMA
  const [uploadingSctr, setUploadingSctr] = useState(false);
  const [uploadingPersonal, setUploadingPersonal] = useState(false);
  const [fileSctrName, setFileSctrName] = useState('');
  const [filePersonalName, setFilePersonalName] = useState('');

  // Prevenir envío involuntario o por rebote de clic al entrar al paso 3
  useEffect(() => {
    if (step === 3) {
      setStep3Armed(false);
      const timer = setTimeout(() => {
        setStep3Armed(true);
      }, 450);
      return () => clearTimeout(timer);
    } else {
      setStep3Armed(false);
    }
  }, [step]);

  // Cargar catálogo al abrir modal
  useEffect(() => {
    if (!isOpen) return;

    api.getRecursosCatalogo()
      .then((data) => setCatalogoAreas(data))
      .catch((err) => console.error('Error cargando catálogo:', err));

    api.getAreasSolicitantes()
      .then((data) => setAreasSolicitantes(data))
      .catch((err) => console.error('Error cargando áreas solicitantes:', err));

    // Reset o inicializar con fecha pre-cargada si existe
    if (prefilledDate) {
      const year = prefilledDate.getFullYear();
      const month = String(prefilledDate.getMonth() + 1).padStart(2, '0');
      const day = String(prefilledDate.getDate()).padStart(2, '0');
      
      setFormData((prev) => ({
        ...prev,
        fecha_inicio: `${year}-${month}-${day}T09:00`,
        fecha_fin: `${year}-${month}-${day}T12:00`,
      }));
    } else {
      // Default to tomorrow 09:00 - 12:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      setFormData((prev) => ({
        ...prev,
        fecha_inicio: prev.fecha_inicio || `${year}-${month}-${day}T09:00`,
        fecha_fin: prev.fecha_fin || `${year}-${month}-${day}T12:00`,
        detalles: '',
        croquis_url: '',
        protocolo_ssoma: false,
        requiere_ssoma: false,
        url_sctr_pdf: '',
        url_personal_externo_pdf: '',
      }));
      setFileSctrName('');
      setFilePersonalName('');
    }

    setStep(1);
    setErrorMessage('');
    setCreatedTicket(null);
  }, [isOpen, prefilledDate]);

  // Manejo de carga de archivos PDF para protocolo SSOMA
  const handleUploadPdf = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('El documento adjunto debe estar en formato PDF (.pdf).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('El archivo excede el tamaño máximo permitido de 15MB.');
      return;
    }

    setErrorMessage('');
    if (type === 'sctr') {
      setUploadingSctr(true);
      try {
        const res = await api.uploadArchivo(file);
        handleInputChange('url_sctr_pdf', res.url);
        setFileSctrName(file.name);
      } catch (err) {
        setErrorMessage(err.message || 'Error al subir el archivo SCTR.');
      } finally {
        setUploadingSctr(false);
      }
    } else if (type === 'personal') {
      setUploadingPersonal(true);
      try {
        const res = await api.uploadArchivo(file);
        handleInputChange('url_personal_externo_pdf', res.url);
        setFilePersonalName(file.name);
      } catch (err) {
        setErrorMessage(err.message || 'Error al subir la lista de personal externo.');
      } finally {
        setUploadingPersonal(false);
      }
    }
  };

  const handleRemovePdf = (type) => {
    if (type === 'sctr') {
      handleInputChange('url_sctr_pdf', '');
      setFileSctrName('');
    } else if (type === 'personal') {
      handleInputChange('url_personal_externo_pdf', '');
      setFilePersonalName('');
    }
  };

  // RN-02 y RN-03: Cuando cambian las fechas, consultar stock dinámico
  useEffect(() => {
    if (!formData.fecha_inicio || !formData.fecha_fin) return;
    if (new Date(formData.fecha_fin) <= new Date(formData.fecha_inicio)) return;

    setLoadingStock(true);
    api.checkDisponibilidad(formData.fecha_inicio, formData.fecha_fin)
      .then((res) => {
        const stockMap = {};
        (res.recursos || []).forEach((item) => {
          stockMap[item.id] = item;
        });
        setStockDisponibilidad(stockMap);

        // Si la cantidad actualmente seleccionada supera el nuevo stock disponible, ajustarla
        setFormData((prev) => {
          const updatedRecursos = { ...prev.recursos };
          Object.keys(updatedRecursos).forEach((recId) => {
            const disp = stockMap[recId]?.stock_disponible ?? 0;
            if (updatedRecursos[recId] > disp) {
              updatedRecursos[recId] = disp;
            }
            if (disp === 0) {
              delete updatedRecursos[recId];
            }
          });
          return { ...prev, recursos: updatedRecursos };
        });
      })
      .catch((err) => {
        console.error('Error calculando disponibilidad de stock:', err);
      })
      .finally(() => {
        setLoadingStock(false);
      });
  }, [formData.fecha_inicio, formData.fecha_fin]);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage('');
  };

  const handleResourceQuantity = (recursoId, qty, maxAllowed) => {
    const num = Math.min(Math.max(0, parseInt(qty, 10) || 0), maxAllowed);
    setFormData((prev) => {
      const newRecursos = { ...prev.recursos };
      if (num === 0) {
        delete newRecursos[recursoId];
      } else {
        newRecursos[recursoId] = num;
      }
      return { ...prev, recursos: newRecursos };
    });
  };

  // Validaciones por paso
  const validateStep1 = () => {
    const email = formData.correo_solicitante.trim().toLowerCase();
    if (!email) {
      setErrorMessage('Por favor ingrese su correo institucional.');
      return false;
    }
    if (!email.endsWith('@continental.edu.pe')) {
      setErrorMessage('El correo debe pertenecer al dominio institucional (@continental.edu.pe).');
      return false;
    }
    if (!formData.telefono.trim()) {
      setErrorMessage('Por favor ingrese su teléfono o anexo de contacto.');
      return false;
    }
    if (!formData.area_solicitante_id) {
      setErrorMessage('Por favor seleccione el área o facultad solicitante.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep2 = () => {
    if (!formData.ambiente_id) {
      setErrorMessage('Por favor seleccione un ambiente o espacio físico.');
      return false;
    }
    if (!formData.fecha_inicio || !formData.fecha_fin) {
      setErrorMessage('Por favor defina la fecha y hora de inicio y fin del evento.');
      return false;
    }
    if (new Date(formData.fecha_fin) <= new Date(formData.fecha_inicio)) {
      setErrorMessage('La fecha y hora de fin debe ser posterior a la fecha de inicio.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (step < 3) {
        handleNext();
      }
    }
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
    // Si no está en el paso 3, nunca enviar la solicitud; avanzar al siguiente paso
    if (step !== 3) {
      handleNext();
      return;
    }
    // Ignorar clics prematuros (primeros 450ms del paso 3) o si ya está enviando
    if (!step3Armed || submitting) {
      return;
    }

    // Validación de protocolo SSOMA si la casilla está activa
    if (formData.requiere_ssoma) {
      if (!formData.url_sctr_pdf) {
        setErrorMessage('Es obligatorio adjuntar el documento SCTR en formato PDF para requerimientos con personal o proveedores externos.');
        return;
      }
      if (!formData.url_personal_externo_pdf) {
        setErrorMessage('Es obligatorio adjuntar la Lista de Personal Externo en formato PDF.');
        return;
      }
    }

    setErrorMessage('');
    setSubmitting(true);

    try {
      const recursosArray = Object.entries(formData.recursos).map(([recId, qty]) => ({
        recurso_id: Number(recId),
        cantidad: qty,
      }));

      const payload = {
        correo_solicitante: formData.correo_solicitante.trim(),
        telefono: formData.telefono.trim(),
        area_solicitante_id: Number(formData.area_solicitante_id),
        ambiente_id: Number(formData.ambiente_id),
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
        detalles: formData.detalles?.trim() || null,
        croquis_url: formData.croquis_url?.trim() || null,
        protocolo_ssoma: Boolean(formData.protocolo_ssoma || formData.requiere_ssoma),
        requiere_ssoma: Boolean(formData.requiere_ssoma),
        url_sctr_pdf: formData.requiere_ssoma ? (formData.url_sctr_pdf?.trim() || null) : null,
        url_personal_externo_pdf: formData.requiere_ssoma ? (formData.url_personal_externo_pdf?.trim() || null) : null,
        recursos: recursosArray,
      };

      const result = await api.crearSolicitud(payload);
      setCreatedTicket(result.codigo_ticket);
      onSuccessCreated?.();
    } catch (err) {
      setErrorMessage(err.message || 'Error al procesar la reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTicket = () => {
    if (createdTicket) {
      navigator.clipboard.writeText(createdTicket);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-brand-700 via-brand-600 to-cyan-700 text-white flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-brand-200">
              Formulario Unificado (RF-04)
            </span>
            <h2 className="text-xl font-bold">Solicitud de Reserva de Espacio y Activos</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-brand-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress (Si no se ha creado aún el ticket) */}
        {!createdTicket && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-medium shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                1
              </span>
              <span className={step === 1 ? 'font-bold text-brand-700' : 'text-slate-600'}>
                Datos del Solicitante
              </span>
            </div>
            <div className="w-8 h-[2px] bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                2
              </span>
              <span className={step === 2 ? 'font-bold text-brand-700' : 'text-slate-600'}>
                Espacio y Horario
              </span>
            </div>
            <div className="w-8 h-[2px] bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= 3 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                3
              </span>
              <span className={step === 3 ? 'font-bold text-brand-700' : 'text-slate-600'}>
                Recursos y Servicios
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-2.5 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {createdTicket ? (
            /* Pantalla de Éxito */
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-slate-900">
                  ¡Solicitud Registrada con Éxito!
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Tu solicitud ha sido ingresada al sistema en estado{' '}
                  <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    EN REVISIÓN
                  </span>{' '}
                  y enviada a la Jefatura de Operaciones para su coordinación.
                </p>
              </div>

              {/* Ticket Card */}
              <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-brand-300 max-w-sm mx-auto space-y-3">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Código de Trámite / Ticket
                </span>
                <div className="text-2xl font-mono font-extrabold text-brand-700 tracking-wider">
                  {createdTicket}
                </div>
                <button
                  onClick={handleCopyTicket}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
                >
                  {copiedTicket ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>¡Copiado al portapapeles!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copiar Código de Ticket</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Volver al Calendario
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onGoToTracking?.(createdTicket);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Consultar Estado del Trámite</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
              {/* Paso 1: Datos del Solicitante (RF-04.1) */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <User className="w-5 h-5 text-brand-600" />
                      Datos del Solicitante (Sin necesidad de login)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Ingrese su información de contacto oficial para seguimiento y notificaciones.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Correo Institucional <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="ejemplo@continental.edu.pe"
                        value={formData.correo_solicitante}
                        onChange={(e) => handleInputChange('correo_solicitante', e.target.value)}
                        className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                        required
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Debe terminar obligatoriamente con el dominio @continental.edu.pe
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Teléfono / Anexo de Contacto <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="987654321 / Anexo 124"
                          value={formData.telefono}
                          onChange={(e) => handleInputChange('telefono', e.target.value)}
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Área o Facultad Solicitante <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formData.area_solicitante_id}
                          onChange={(e) => handleInputChange('area_solicitante_id', e.target.value)}
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
                          required
                        >
                          <option value="">-- Seleccionar área / facultad --</option>
                          {areasSolicitantes.map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 2: Datos del Evento (RF-04.2) */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-brand-600" />
                      Espacio y Horario Requerido
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      El sistema validará en tiempo real que no existan colisiones en el ambiente seleccionado (RN-01).
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Ambiente / Espacio Físico <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.ambiente_id}
                        onChange={(e) => handleInputChange('ambiente_id', e.target.value)}
                        className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
                        required
                      >
                        <option value="">-- Seleccionar ambiente --</option>
                        {ambientes.map((amb) => (
                          <option key={amb.id} value={amb.id}>
                            {amb.nombre} {amb.capacidad ? `• Capacidad: ${amb.capacidad} personas` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Fecha y Hora de Inicio <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.fecha_inicio}
                          onChange={(e) => handleInputChange('fecha_inicio', e.target.value)}
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Fecha y Hora de Fin <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.fecha_fin}
                          onChange={(e) => handleInputChange('fecha_fin', e.target.value)}
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 3: Recursos y Servicios (RF-04.3, RN-02, RN-03, RN-04) */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-600" />
                        Desglose de Recursos y Servicios
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Stock calculado dinámicamente según reservas simultáneas para su horario (RN-02).
                      </p>
                    </div>
                    {loadingStock && (
                      <div className="flex items-center gap-1.5 text-xs text-brand-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Consultando inventario...</span>
                      </div>
                    )}
                  </div>

                  {/* Agrupación por Área Destino */}
                  <div className="space-y-6">
                    {catalogoAreas.map((area) => (
                      <div key={area.area_id} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                            {area.area_nombre}
                          </h4>
                          <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded font-medium">
                            Ruteo Interno (RN-04)
                          </span>
                        </div>

                        {/* Lista de recursos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {area.recursos.map((rec) => {
                            const dispInfo = stockDisponibilidad[rec.id];
                            const stockDisp = dispInfo !== undefined ? dispInfo.stock_disponible : rec.stock_total;
                            const isAgotado = stockDisp === 0; // RN-03: Deshabilitación automática
                            const cantidadActual = formData.recursos[rec.id] || '';

                            return (
                              <div
                                key={rec.id}
                                className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                                  isAgotado
                                    ? 'bg-slate-100/70 border-slate-200 opacity-60'
                                    : cantidadActual > 0
                                    ? 'bg-brand-50/50 border-brand-300 shadow-2xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-slate-800 truncate">
                                      {rec.nombre}
                                    </span>
                                    {rec.es_critico && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-red-100 text-red-700 rounded">
                                        Crítico
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    {isAgotado ? (
                                      <span className="text-rose-600 font-semibold">
                                        Agotado en este horario
                                      </span>
                                    ) : (
                                      <span>
                                        Disponible:{' '}
                                        <strong className="text-slate-700">{stockDisp}</strong> / {rec.stock_total}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Input numérico (RN-03: Deshabilitado si stock es 0) */}
                                <div className="w-20 shrink-0">
                                  <input
                                    type="number"
                                    min="0"
                                    max={stockDisp}
                                    disabled={isAgotado}
                                    placeholder="0"
                                    value={cantidadActual}
                                    onChange={(e) =>
                                      handleResourceQuantity(rec.id, e.target.value, stockDisp)
                                    }
                                    className={`w-full text-center font-bold text-sm rounded-lg border py-1.5 focus:outline-none transition-all ${
                                      isAgotado
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300'
                                        : 'bg-white border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-slate-900'
                                    }`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Campo Detalles Adicionales */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <label htmlFor="input-detalles" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Detalles
                      </label>
                      <p className="text-xs text-slate-500">
                        Añada requerimientos específicos, especificaciones de mobiliario o consideraciones adicionales para la Jefatura de Operaciones.
                      </p>
                      <textarea
                        id="input-detalles"
                        rows={3}
                        value={formData.detalles}
                        onChange={(e) => handleInputChange('detalles', e.target.value)}
                        placeholder="Ej: Distribución en forma de U, mesa principal para 4 ponentes, instalación y prueba de equipos 30 minutos antes..."
                        className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                      />
                    </div>

                    {/* Campo Croquis de Distribución de Mobiliario (Enlace Google Drive) */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="input-croquis" className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-brand-600" />
                          <span>Croquis de Distribución del Mobiliario (Opcional)</span>
                        </label>
                        <span className="text-[10px] bg-slate-200/80 text-slate-600 font-semibold px-2 py-0.5 rounded-md">
                          Google Drive
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Si dispone de una imagen o diagrama con la distribución de los mobiliarios en el espacio, ingrese el enlace compartido de Google Drive (asegúrese de que tenga permisos de lectura "Cualquier persona con el enlace").
                      </p>
                      <div className="relative">
                        <input
                          type="url"
                          id="input-croquis"
                          value={formData.croquis_url}
                          onChange={(e) => handleInputChange('croquis_url', e.target.value)}
                          placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                          className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all pr-10"
                        />
                        {formData.croquis_url && (
                          <a
                            href={formData.croquis_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Probar enlace en nueva pestaña"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Validación y Protocolo SSOMA para Proveedores Externos */}
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="check-ssoma"
                          checked={formData.requiere_ssoma}
                          onChange={(e) => {
                            const val = e.target.checked;
                            handleInputChange('requiere_ssoma', val);
                            handleInputChange('protocolo_ssoma', val);
                            if (!val) {
                              setErrorMessage('');
                            }
                          }}
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 mt-1 cursor-pointer"
                        />
                        <label htmlFor="check-ssoma" className="text-xs text-emerald-950 font-medium cursor-pointer flex-1">
                          <span className="font-bold block text-emerald-900 text-sm">
                            ¿Requiere proveedores o personal externo para su evento? (Protocolo SSOMA)
                          </span>
                          Active esta opción si participarán proveedores de servicios, empresas contratistas o personal externo. El área de SSOMA evaluará la documentación para dar su conformidad antes de la aprobación final.
                        </label>
                      </div>

                      {/* Sección dinámica de carga de PDFs al activar la casilla */}
                      {formData.requiere_ssoma && (
                        <div className="pt-3 border-t border-emerald-200/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center gap-2 text-xs text-emerald-900 font-bold">
                            <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>Documentación obligatoria para el área de SSOMA (formato PDF, máx. 15MB):</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Input 1: SCTR en PDF */}
                            <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-emerald-600" />
                                  1. Documento SCTR (PDF) *
                                </span>
                                {formData.url_sctr_pdf && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                                    Cargado ✓
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight">
                                Seguro Complementario de Trabajo de Riesgo vigente para el personal externo.
                              </p>

                              {formData.url_sctr_pdf ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                                  <span className="truncate font-medium text-emerald-950 flex-1" title={fileSctrName || 'SCTR_cargado.pdf'}>
                                    📄 {fileSctrName || 'SCTR_cargado.pdf'}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => window.open(api.getFileUrl(formData.url_sctr_pdf), '_blank')}
                                      className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded transition-colors"
                                      title="Ver documento en nueva pestaña"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePdf('sctr')}
                                      className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                                      title="Quitar archivo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-xl cursor-pointer transition-all">
                                  {uploadingSctr ? (
                                    <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold py-1">
                                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                      <span>Subiendo SCTR...</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold py-1">
                                      <UploadCloud className="w-4 h-4 text-emerald-600" />
                                      <span>Adjuntar SCTR en PDF</span>
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    disabled={uploadingSctr}
                                    onChange={(e) => handleUploadPdf(e, 'sctr')}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>

                            {/* Input 2: Lista de Personal Externo en PDF */}
                            <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-emerald-600" />
                                  2. Lista Personal Externo (PDF) *
                                </span>
                                {formData.url_personal_externo_pdf && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                                    Cargado ✓
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight">
                                Lista en PDF con nombres completos y DNI del personal externo que ingresará al campus.
                              </p>

                              {formData.url_personal_externo_pdf ? (
                                <div className="flex items-center justify-between gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                                  <span className="truncate font-medium text-emerald-950 flex-1" title={filePersonalName || 'Personal_Externo.pdf'}>
                                    📄 {filePersonalName || 'Personal_Externo.pdf'}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => window.open(api.getFileUrl(formData.url_personal_externo_pdf), '_blank')}
                                      className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded transition-colors"
                                      title="Ver documento en nueva pestaña"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePdf('personal')}
                                      className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                                      title="Quitar archivo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-xl cursor-pointer transition-all">
                                  {uploadingPersonal ? (
                                    <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold py-1">
                                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                      <span>Subiendo Lista...</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold py-1">
                                      <UploadCloud className="w-4 h-4 text-emerald-600" />
                                      <span>Adjuntar Lista en PDF</span>
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept=".pdf"
                                    disabled={uploadingPersonal}
                                    onChange={(e) => handleUploadPdf(e, 'personal')}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de Navegación del Wizard */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('');
                      setStep((s) => s - 1);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Atrás</span>
                  </button>
                ) : (
                  <div></div>
                )}

                {step < 3 ? (
                  <button
                    key="btn-next"
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-md shadow-brand-500/20 transition-all"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    key="btn-submit"
                    type="submit"
                    disabled={submitting || !step3Armed}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all ${
                      !step3Armed ? 'opacity-80 cursor-not-allowed' : ''
                    } disabled:opacity-50`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando Solicitud...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Confirmar y Enviar Solicitud</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

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
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building,
  Info,
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
    protocolo_ssoma: false,
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
      }));
    }

    setStep(1);
    setErrorMessage('');
    setCreatedTicket(null);
  }, [isOpen, prefilledDate]);

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

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        protocolo_ssoma: formData.protocolo_ssoma,
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
            <form onSubmit={handleSubmit} className="space-y-6">
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

                    {/* Validación de Protocolo SSOMA (RF-04.3) */}
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="check-ssoma"
                        checked={formData.protocolo_ssoma}
                        onChange={(e) => handleInputChange('protocolo_ssoma', e.target.checked)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 mt-1 cursor-pointer"
                      />
                      <label htmlFor="check-ssoma" className="text-xs text-emerald-950 font-medium cursor-pointer">
                        <span className="font-bold block text-emerald-900 text-sm">
                          Validación de Protocolo SSOMA y Seguridad
                        </span>
                        Declaro que la actividad cumplirá con las normas de seguridad ocupacional, aforo permitido y directivas ambientales del campus.
                      </label>
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
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-md shadow-brand-500/20 transition-all"
                  >
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
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

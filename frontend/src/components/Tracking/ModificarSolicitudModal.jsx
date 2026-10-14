import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Building,
  Layers,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  UploadCloud,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  KeyRound,
  Mail,
  Edit3,
  Image as ImageIcon,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatTimeRange, formatDateFull, formatDateShort } from '../../utils/formatters';

export default function ModificarSolicitudModal({
  isOpen,
  solicitud,
  onClose,
  onSuccessUpdated,
}) {
  if (!isOpen || !solicitud) return null;

  // 1. Datos iniciales
  const [motivoModificacion, setMotivoModificacion] = useState('');
  const [pinSeguridad, setPinSeguridad] = useState('');
  const [correoSolicitante, setCorreoSolicitante] = useState(solicitud.correo_solicitante || '');
  const [telefono, setTelefono] = useState(solicitud.telefono || '');
  const [ambienteId, setAmbienteId] = useState(solicitud.ambiente_id || '');
  const [ambientes, setAmbientes] = useState([]);

  // Horarios
  const [horarios, setHorarios] = useState(() => {
    if (solicitud.horarios && solicitud.horarios.length > 0) {
      return solicitud.horarios.map((h) => ({
        fecha_inicio: h.fecha_inicio ? h.fecha_inicio.substring(0, 16) : '',
        fecha_fin: h.fecha_fin ? h.fecha_fin.substring(0, 16) : '',
      }));
    }
    return [
      {
        fecha_inicio: solicitud.fecha_inicio ? solicitud.fecha_inicio.substring(0, 16) : '',
        fecha_fin: solicitud.fecha_fin ? solicitud.fecha_fin.substring(0, 16) : '',
      },
    ];
  });

  // Catálogo de Recursos y selección
  const [catalogoAreas, setCatalogoAreas] = useState([]);
  const [stockDisponibilidad, setStockDisponibilidad] = useState({});
  const [loadingStock, setLoadingStock] = useState(false);
  const [recursosSeleccionados, setRecursosSeleccionados] = useState(() => {
    const map = {};
    if (solicitud.recursos && Array.isArray(solicitud.recursos)) {
      solicitud.recursos.forEach((r) => {
        map[r.recurso_id] = r.cantidad;
      });
    }
    return map;
  });

  // SSOMA
  const [requiereSsoma, setRequiereSsoma] = useState(
    Boolean(solicitud.requiere_ssoma || solicitud.protocolo_ssoma)
  );
  const [proveedoresSsoma, setProveedoresSsoma] = useState(() => {
    if (solicitud.documentos_ssoma && solicitud.documentos_ssoma.length > 0) {
      return solicitud.documentos_ssoma.map((d, idx) => {
        let docs = [];
        if (Array.isArray(d.documentos) && d.documentos.length > 0) {
          docs = d.documentos.map((item, dIdx) => ({
            id: dIdx + 1,
            url: typeof item === 'string' ? item : (item?.url || ''),
          }));
        } else {
          if (d.url_sctr_pdf) docs.push({ id: 1, url: d.url_sctr_pdf });
          if (d.url_personal_externo_pdf) docs.push({ id: docs.length + 1, url: d.url_personal_externo_pdf });
        }
        if (docs.length === 0) docs = [{ id: 1, url: '' }];

        return {
          id: idx + 1,
          nombre_proveedor: d.nombre || `Proveedor Externo #${idx + 1}`,
          documentos: docs,
          url_sctr_pdf: d.url_sctr_pdf || '',
          url_personal_externo_pdf: d.url_personal_externo_pdf || '',
        };
      });
    }
    const fallbackDocs = [];
    if (solicitud.url_sctr_pdf) fallbackDocs.push({ id: 1, url: solicitud.url_sctr_pdf });
    if (solicitud.url_personal_externo_pdf) fallbackDocs.push({ id: fallbackDocs.length + 1, url: solicitud.url_personal_externo_pdf });
    if (fallbackDocs.length === 0) fallbackDocs.push({ id: 1, url: '' });

    return [
      {
        id: 1,
        nombre_proveedor: 'Proveedor Externo #1',
        documentos: fallbackDocs,
        url_sctr_pdf: solicitud.url_sctr_pdf || '',
        url_personal_externo_pdf: solicitud.url_personal_externo_pdf || '',
      },
    ];
  });

  // Otros campos
  const [croquisUrl, setCroquisUrl] = useState(solicitud.croquis_url || '');
  const [detalles, setDetalles] = useState(solicitud.detalles || '');

  // UI States
  const [expandedArea, setExpandedArea] = useState({});
  const [verificandoHorario, setVerificandoHorario] = useState(false);
  const [resultadoHorario, setResultadoHorario] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 2. Cargar ambientes y catálogo de recursos
  useEffect(() => {
    async function loadInitial() {
      try {
        const [ambs, cats] = await Promise.all([
          api.getAmbientes(),
          api.getRecursosCatalogo(),
        ]);
        setAmbientes(ambs || []);
        setCatalogoAreas(cats || []);
      } catch (err) {
        console.error('Error cargando datos para edición:', err);
      }
    }
    loadInitial();
  }, []);

  // 3. Consultar stock disponible excluyendo la solicitud actual
  const fetchStock = async (horariosList) => {
    const validHorarios = horariosList.filter((h) => h.fecha_inicio && h.fecha_fin);
    if (validHorarios.length === 0) return;

    setLoadingStock(true);
    try {
      const data = await api.checkDisponibilidad({
        horarios: validHorarios.map((h) => ({
          fecha_inicio: h.fecha_inicio,
          fecha_fin: h.fecha_fin,
        })),
        solicitud_id_excluir: solicitud.id,
      });

      if (data && data.recursos) {
        const stockMap = {};
        data.recursos.forEach((r) => {
          stockMap[r.id] = {
            disponible: r.stock_disponible,
            reservado: r.stock_reservado,
            total: r.stock_total,
          };
        });
        setStockDisponibilidad(stockMap);
      }
    } catch (err) {
      console.error('Error al consultar stock para modificación:', err);
    } finally {
      setLoadingStock(false);
    }
  };

  // 4. Validar disponibilidad de ambiente (excluyendo la solicitud actual)
  useEffect(() => {
    const validHorarios = horarios.filter((h) => h.fecha_inicio && h.fecha_fin);
    if (!ambienteId || validHorarios.length === 0) {
      setResultadoHorario(null);
      return;
    }

    let isMounted = true;
    setVerificandoHorario(true);

    const timer = setTimeout(async () => {
      try {
        let res;
        if (validHorarios.length === 1) {
          res = await api.verificarHorarioAmbiente(
            ambienteId,
            validHorarios[0].fecha_inicio,
            validHorarios[0].fecha_fin,
            solicitud.id,
            60
          );
        } else {
          res = await api.verificarHorariosAmbiente(
            ambienteId,
            validHorarios.map((h) => ({
              fecha_inicio: h.fecha_inicio,
              fecha_fin: h.fecha_fin,
            })),
            solicitud.id,
            60
          );
        }

        if (isMounted) {
          setResultadoHorario(res);
          // Si el ambiente y horario están listos, consultar stock
          fetchStock(validHorarios);
        }
      } catch (err) {
        if (isMounted) {
          setResultadoHorario({
            disponible: false,
            mensaje: err.message || 'Error al validar disponibilidad del ambiente.',
          });
        }
      } finally {
        if (isMounted) setVerificandoHorario(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [ambienteId, horarios]);

  // Manejadores de Horarios
  const handleHorarioChange = (index, field, value) => {
    setHorarios((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddHorario = () => {
    const last = horarios[horarios.length - 1];
    let nextStart = '';
    let nextEnd = '';
    if (last && last.fecha_inicio) {
      const d = new Date(last.fecha_inicio);
      d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const timePartStart = last.fecha_inicio.substring(11, 16) || '09:00';
      const timePartEnd = last.fecha_fin ? last.fecha_fin.substring(11, 16) : '12:00';
      nextStart = `${yyyy}-${mm}-${dd}T${timePartStart}`;
      nextEnd = `${yyyy}-${mm}-${dd}T${timePartEnd}`;
    }
    setHorarios((prev) => [...prev, { fecha_inicio: nextStart, fecha_fin: nextEnd }]);
  };

  const handleRemoveHorario = (index) => {
    if (horarios.length <= 1) return;
    setHorarios((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Manejadores de Recursos
  const handleRecursoChange = (recId, delta) => {
    setRecursosSeleccionados((prev) => {
      const current = prev[recId] || 0;
      const stockItem = stockDisponibilidad[recId];
      const maxDispo = stockItem ? stockItem.disponible : 999;
      const nextVal = Math.max(0, Math.min(current + delta, maxDispo));
      const copy = { ...prev };
      if (nextVal <= 0) {
        delete copy[recId];
      } else {
        copy[recId] = nextVal;
      }
      return copy;
    });
  };

  // Manejo de SSOMA Proveedores
  const handleAddProveedor = () => {
    setProveedoresSsoma((prev) => [
      ...prev,
      {
        id: Date.now(),
        nombre_proveedor: `Proveedor Externo #${prev.length + 1}`,
        documentos: [{ id: 1, url: '' }],
        url_sctr_pdf: '',
        url_personal_externo_pdf: '',
      },
    ]);
  };

  const handleRemoveProveedor = (id) => {
    if (proveedoresSsoma.length <= 1) return;
    setProveedoresSsoma((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateProveedorName = (id, nombre) => {
    setProveedoresSsoma((prev) =>
      prev.map((p) => (p.id === id ? { ...p, nombre_proveedor: nombre } : p))
    );
  };

  const handleAddDocumentoProveedor = (provId) => {
    setProveedoresSsoma((prev) =>
      prev.map((p) => {
        if (p.id !== provId) return p;
        const docs = p.documentos || [];
        return {
          ...p,
          documentos: [...docs, { id: Date.now(), url: '' }],
        };
      })
    );
  };

  const handleRemoveDocumentoProveedor = (provId, docIdx) => {
    setProveedoresSsoma((prev) =>
      prev.map((p) => {
        if (p.id !== provId) return p;
        const docs = p.documentos || [];
        if (docs.length <= 1) return p;
        return {
          ...p,
          documentos: docs.filter((_, idx) => idx !== docIdx),
        };
      })
    );
  };

  const handleDocumentoChangeProveedor = (provId, docIdx, url) => {
    setProveedoresSsoma((prev) =>
      prev.map((p) => {
        if (p.id !== provId) return p;
        const docs = [...(p.documentos || [])];
        docs[docIdx] = { ...docs[docIdx], url };
        return { ...p, documentos: docs };
      })
    );
  };

  // Enviar Modificación
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validar motivo
    if (!motivoModificacion.trim() || motivoModificacion.trim().length < 5) {
      setErrorMessage('Debe especificar un motivo detallado para la modificación (mínimo 5 caracteres).');
      return;
    }

    // Validar autenticación
    if (!pinSeguridad.trim() && !correoSolicitante.trim()) {
      setErrorMessage('Debe ingresar el PIN de seguridad o su correo electrónico registrado para validar la autoría.');
      return;
    }

    // Validar horarios
    const validHorarios = horarios.filter((h) => h.fecha_inicio && h.fecha_fin);
    if (validHorarios.length === 0) {
      setErrorMessage('Debe definir al menos una fecha y horario para el evento.');
      return;
    }

    for (let i = 0; i < validHorarios.length; i++) {
      const h = validHorarios[i];
      if (new Date(h.fecha_inicio) >= new Date(h.fecha_fin)) {
        setErrorMessage(`En la fecha #${i + 1}, la hora de fin debe ser posterior a la de inicio.`);
        return;
      }
    }

    if (resultadoHorario && !resultadoHorario.disponible) {
      setErrorMessage(`Conflicto de horario: ${resultadoHorario.mensaje}`);
      return;
    }

    // Construir lista de recursos
    const recursosArray = Object.entries(recursosSeleccionados)
      .filter(([_, cant]) => cant > 0)
      .map(([id, cant]) => ({
        recurso_id: Number(id),
        cantidad: Number(cant),
      }));

    // Construir lista de documentos SSOMA
    let documentosSsomaPayload = null;
    if (requiereSsoma) {
      documentosSsomaPayload = proveedoresSsoma.map((p, idx) => {
        const docsValidos = (p.documentos || [])
          .map((d) => (typeof d === 'string' ? d.trim() : (d?.url || '').trim()))
          .filter(Boolean);

        return {
          nombre: p.nombre_proveedor?.trim() || `Proveedor #${idx + 1}`,
          url_sctr_pdf: docsValidos[0] || p.url_sctr_pdf || null,
          url_personal_externo_pdf: docsValidos[1] || p.url_personal_externo_pdf || null,
          documentos: docsValidos.map((url, dIdx) => ({
            id: dIdx + 1,
            url: url,
            nombre: `Documento ${dIdx + 1}`,
          })),
        };
      });
    }

    const payload = {
      motivo_modificacion: motivoModificacion.trim(),
      pin_seguridad: pinSeguridad.trim() || null,
      correo_solicitante: correoSolicitante.trim() || null,
      ambiente_id: Number(ambienteId),
      area_solicitante_id: solicitud.area_solicitante_id || null,
      telefono: telefono.trim() || null,
      fecha_inicio: validHorarios[0].fecha_inicio,
      fecha_fin: validHorarios[validHorarios.length - 1].fecha_fin,
      horarios: validHorarios,
      recursos: recursosArray,
      protocolo_ssoma: requiereSsoma,
      requiere_ssoma: requiereSsoma,
      url_sctr_pdf: documentosSsomaPayload?.[0]?.url_sctr_pdf || null,
      url_personal_externo_pdf: documentosSsomaPayload?.[0]?.url_personal_externo_pdf || null,
      documentos_ssoma: documentosSsomaPayload,
      croquis_url: croquisUrl.trim() || null,
      detalles: detalles.trim() || null,
    };

    setSubmitting(true);
    try {
      const updated = await api.solicitarModificacion(solicitud.codigo_ticket, payload);
      setSuccessMessage('¡Solicitud de modificación enviada exitosamente! Se notificará a las áreas operativas.');
      setTimeout(() => {
        onSuccessUpdated?.(updated);
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Error al procesar la solicitud de modificación.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-600 via-orange-600 to-brand-700 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-extrabold bg-white/20 px-2 py-0.5 rounded-md">
                Reprogramación Asíncrona
              </span>
              <span className="font-mono text-xs font-bold text-amber-100">
                Ticket: {solicitud.codigo_ticket}
              </span>
            </div>
            <h2 className="text-xl font-bold mt-1">Solicitar Modificación / Reprogramación</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-amber-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2.5 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-start gap-2.5 shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* SECCIÓN 1: Motivo de la Modificación & Autenticación Liviana */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
              <Edit3 className="w-4 h-4 text-amber-600" />
              <span>1. Justificación y Validación de Identidad (Obligatorio)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo de la Modificación o Reprogramación <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={motivoModificacion}
                onChange={(e) => setMotivoModificacion(e.target.value)}
                placeholder="Explique el motivo del cambio (ej. Ajuste de fecha por disponibilidad de ponente externo, aumento de sillas solicitadas, cambio de ambiente, etc.)"
                className="w-full text-xs p-3 rounded-xl border border-amber-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-500 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PIN de Seguridad (4 Dígitos)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    maxLength={10}
                    value={pinSeguridad}
                    onChange={(e) => setPinSeguridad(e.target.value)}
                    placeholder="PIN recibido al registrar (ej. 4589)"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 bg-white font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Si no recuerdas el PIN, confirma con tu correo registrado a la derecha.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico Registrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={correoSolicitante}
                    onChange={(e) => setCorreoSolicitante(e.target.value)}
                    placeholder="ejemplo@continental.edu.pe"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Espacio y Horarios (Reprogramación) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Calendar className="w-4 h-4 text-brand-600" />
                <span>2. Espacio Físico y Fechas del Evento</span>
              </div>
              {verificandoHorario && (
                <div className="flex items-center gap-1.5 text-xs text-brand-600 font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validando disponibilidad...</span>
                </div>
              )}
            </div>

            {/* Selector de Ambiente */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ambiente / Espacio
              </label>
              <select
                value={ambienteId}
                onChange={(e) => setAmbienteId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-brand-600 bg-white font-medium"
              >
                {ambientes.map((amb) => (
                  <option key={amb.id} value={amb.id}>
                    {amb.nombre} (Capacidad: {amb.capacidad} personas)
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Horarios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Fechas y Franjas Horarias:
                </label>
                <button
                  type="button"
                  onClick={handleAddHorario}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar otra fecha</span>
                </button>
              </div>

              {horarios.map((slot, index) => (
                <div
                  key={index}
                  className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Inicio
                      </span>
                      <input
                        type="datetime-local"
                        value={slot.fecha_inicio}
                        onChange={(e) => handleHorarioChange(index, 'fecha_inicio', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Fin
                      </span>
                      <input
                        type="datetime-local"
                        value={slot.fecha_fin}
                        onChange={(e) => handleHorarioChange(index, 'fecha_fin', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  {horarios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveHorario(index)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors shrink-0 self-end sm:self-center"
                      title="Eliminar este horario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Diagnóstico de Disponibilidad */}
            {resultadoHorario && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  resultadoHorario.disponible
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {resultadoHorario.disponible ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className="font-bold">
                    {resultadoHorario.disponible
                      ? 'Ambiente y Horarios Disponibles ✓'
                      : 'Horario o Espacio no disponible:'}
                  </span>
                  <p className="mt-0.5">{resultadoHorario.mensaje}</p>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 3: Ajuste de Mobiliario y Recursos */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Layers className="w-4 h-4 text-brand-600" />
                <span>3. Solicitud y Ajuste de Mobiliario / TI</span>
              </div>
              {loadingStock && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                  <span>Calculando stock...</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {catalogoAreas.map((area) => (
                <div
                  key={area.area_id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedArea((prev) => ({
                        ...prev,
                        [area.area_id]: !prev[area.area_id],
                      }))
                    }
                    className="w-full p-3 bg-slate-100 hover:bg-slate-200/70 text-left font-bold text-xs text-slate-800 flex items-center justify-between transition-colors"
                  >
                    <span>{area.area_nombre}</span>
                    {expandedArea[area.area_id] ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  <div className={`p-3 space-y-2 ${expandedArea[area.area_id] ? 'block' : 'hidden'}`}>
                    {area.recursos && area.recursos.length > 0 ? (
                      area.recursos.map((rec) => {
                        const cant = recursosSeleccionados[rec.id] || 0;
                        const stockInfo = stockDisponibilidad[rec.id];
                        const disponible = stockInfo ? stockInfo.disponible : rec.stock_total;

                        return (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/50 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">{rec.nombre}</div>
                              <span className="text-[10px] text-slate-500">
                                Stock disponible para estas fechas:{' '}
                                <strong className="text-slate-700">{disponible}</strong> (Total: {rec.stock_total})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={cant <= 0}
                                onClick={() => handleRecursoChange(rec.id, -1)}
                                className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-30 transition-colors"
                              >
                                -
                              </button>
                              <span className="font-bold text-sm text-slate-900 w-8 text-center">
                                {cant}
                              </span>
                              <button
                                type="button"
                                disabled={cant >= disponible}
                                onClick={() => handleRecursoChange(rec.id, 1)}
                                className="w-7 h-7 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-30 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-slate-400 py-2 text-center">
                        No hay recursos registrados en esta área.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN 4: Protocolo SSOMA y Proveedores Externos */}
          <div className="bg-emerald-50/50 border border-emerald-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-emerald-700" />
                <span>4. Protocolo SSOMA (Personal y Proveedores Externos)</span>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiereSsoma}
                  onChange={(e) => setRequiereSsoma(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>¿Ingresará personal o proveedores externos?</span>
              </label>
            </div>

            {requiereSsoma && (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Para el ingreso de contratistas o personal externo al campus, adjunte los enlaces correspondientes a los documentos pertinentes requeridos por SSOMA (SCTR, ATS, nómina, etc.).
                </p>

                <div className="space-y-4">
                  {proveedoresSsoma.map((prov, idx) => {
                    const docs = prov.documentos && prov.documentos.length > 0
                      ? prov.documentos
                      : [{ id: 1, url: '' }];

                    return (
                      <div
                        key={prov.id}
                        className="p-4 bg-white rounded-2xl border-2 border-emerald-200/90 space-y-3.5 shadow-sm"
                      >
                        {/* Cabecera del Proveedor */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-emerald-100">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={prov.nombre_proveedor}
                              onChange={(e) => handleUpdateProveedorName(prov.id, e.target.value)}
                              placeholder={`Nombre del Proveedor #${idx + 1} (ej. Catering, Sonido, etc.)`}
                              className="text-xs font-bold text-slate-800 bg-emerald-50/50 hover:bg-emerald-50 focus:bg-white border border-emerald-200 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 focus:outline-none flex-1 max-w-md transition-colors"
                            />
                          </div>
                          {proveedoresSsoma.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveProveedor(prov.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors font-semibold shrink-0"
                              title="Quitar este proveedor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Quitar Proveedor</span>
                            </button>
                          )}
                        </div>

                        {/* Subir documentos pertinentes */}
                        <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200/80 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider">
                                Subir documentos pertinentes <span className="text-emerald-700">*</span>
                              </label>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                Ingrese el enlace (Google Drive, OneDrive, etc.) a los documentos requeridos.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddDocumentoProveedor(prov.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200/80 text-emerald-900 border border-emerald-300 text-xs font-bold transition-all shadow-xs"
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Añadir más campos</span>
                            </button>
                          </div>

                          {/* Lista dinámica de campos de enlace */}
                          <div className="space-y-2">
                            {docs.map((doc, docIdx) => (
                              <div
                                key={doc.id || docIdx}
                                className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all"
                              >
                                <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                  {docIdx + 1}
                                </div>

                                <div className="flex-1 relative">
                                  <input
                                    type="url"
                                    required={docIdx === 0}
                                    value={doc.url}
                                    onChange={(e) => handleDocumentoChangeProveedor(prov.id, docIdx, e.target.value)}
                                    placeholder={`Enlace al documento ${docIdx + 1} (ej. https://drive.google.com/...)`}
                                    className="w-full bg-transparent px-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                                  />
                                </div>

                                {doc.url && (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Probar enlace"
                                    className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors shrink-0"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                {docs.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDocumentoProveedor(prov.id, docIdx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0"
                                    title="Eliminar este campo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleAddProveedor}
                    className="w-full py-3 px-4 bg-emerald-100/70 hover:bg-emerald-200 text-emerald-900 border-2 border-dashed border-emerald-400 hover:border-emerald-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs group"
                  >
                    <Plus className="w-4 h-4 text-emerald-700 group-hover:scale-125 transition-transform" />
                    <span>+ Añadir otro proveedor externo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 5: Croquis y Detalles */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ImageIcon className="w-4 h-4 text-brand-600" />
              <span>5. Croquis de Distribución y Notas Adicionales</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Enlace a Croquis de Distribución (Google Drive / URL Pública)
              </label>
              <input
                type="url"
                value={croquisUrl}
                onChange={(e) => setCroquisUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-brand-600 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Detalles o Instrucciones Logísticas Adicionales
              </label>
              <textarea
                rows={2}
                value={detalles}
                onChange={(e) => setDetalles(e.target.value)}
                placeholder="Instrucciones para el armado de mobiliario, puntos de conexión o especificaciones técnicas."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-brand-600 bg-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-brand-700 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando Modificación...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Enviar Solicitud de Modificación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

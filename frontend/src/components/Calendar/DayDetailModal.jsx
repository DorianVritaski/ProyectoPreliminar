import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar as CalendarIcon, Package, PlusCircle, CheckCircle, AlertCircle, Building } from 'lucide-react';
import { formatTimeRange, formatDateFull, getStatusInfo } from '../../utils/formatters';
import { api } from '../../api/client';

export default function DayDetailModal({
  isOpen,
  date,
  dayEvents,
  onClose,
  onReserveDate,
}) {
  const [stockSummary, setStockSummary] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    if (!isOpen || !date) return;

    // Consultar stock de recursos para todo el día (08:00 a 22:00)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const startStr = `${year}-${month}-${day}T08:00:00`;
    const endStr = `${year}-${month}-${day}T22:00:00`;

    setLoadingStock(true);
    api.checkDisponibilidad(startStr, endStr)
      .then((res) => {
        // Filtrar recursos clave para el modal
        const clave = ['Sillas', 'Mesas', 'Vallas', 'Proyectores', 'Micrófonos', 'Parlantes', 'Laptops'];
        const filtered = (res.recursos || []).filter((r) =>
          clave.includes(r.nombre) || r.es_critico
        );
        setStockSummary(filtered);
      })
      .catch((err) => {
        console.error('Error al consultar stock del día:', err);
      })
      .finally(() => {
        setLoadingStock(false);
      });
  }, [isOpen, date]);

  if (!isOpen || !date) return null;

  // Ordenar cronograma por hora de inicio
  const sortedEvents = [...dayEvents].sort(
    (a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
              <CalendarIcon className="w-6 h-6 text-brand-300" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-300">
                Detalle del Día
              </span>
              <h2 className="text-xl font-bold capitalize">
                {formatDateFull(date)}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Seccion 1: Cronograma del día */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                Cronograma de Eventos ({sortedEvents.length})
              </h3>
              <span className="text-xs text-slate-400">
                (Datos personales anonimizados)
              </span>
            </div>

            {sortedEvents.length === 0 ? (
              <div className="p-6 text-center bg-emerald-50/60 border border-emerald-100 rounded-2xl text-emerald-800">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <p className="font-semibold text-sm">Todo el día disponible</p>
                <p className="text-xs text-emerald-600 mt-1">
                  No hay reservas confirmadas ni en revisión en esta fecha.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEvents.map((evt) => {
                  const statusInfo = getStatusInfo(evt.estado);
                  return (
                    <div
                      key={evt.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-md transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-brand-700">
                              {formatTimeRange(evt.fecha_inicio, evt.fecha_fin)}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              {evt.ambiente}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700">Área Solicitante:</span> {evt.area_solicitante}
                            <span className="ml-2 font-mono text-[11px] bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-700">
                              {evt.codigo_ticket}
                            </span>
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* Recursos asignados al evento */}
                      {evt.recursos && evt.recursos.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                            Recursos y Equipos Asignados:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {evt.recursos.map((r, i) => (
                              <span
                                key={i}
                                className="text-xs bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium shadow-2xs"
                              >
                                {r.cantidad} × {r.recurso}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seccion 2: Saldo de Stock Disponible en esta fecha */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-brand-600" />
              Saldo de Stock de Recursos Clave
            </h3>

            {loadingStock ? (
              <div className="py-4 text-center text-xs text-slate-400">
                Calculando saldos de inventario...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {stockSummary.map((item) => {
                  const percent = Math.round((item.stock_disponible / item.stock_total) * 100);
                  const isLow = percent < 30;
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>{item.nombre}</span>
                        {item.es_critico && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold">
                            Crítico
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className={`text-base font-extrabold ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                          {item.stock_disponible}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          de {item.stock_total} disp.
                        </span>
                      </div>
                      {/* Mini bar */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isLow ? 'bg-amber-500' : 'bg-brand-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cerrar
          </button>

          {/* Boton Directo: [ + Reservar en esta Fecha ] */}
          <button
            onClick={() => {
              onClose();
              onReserveDate(date);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-brand-500/20 active:scale-[0.98] transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Reservar en esta Fecha</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { MapPin, SlidersHorizontal, Check, Monitor, Volume2, Mic, Laptop, Shield } from 'lucide-react';

const CRITICAL_EQUIPMENT = [
  { id: 'vallas', label: 'Vallas', resourceName: 'Vallas', icon: Shield },
  { id: 'proyectores', label: 'Proyectores', resourceName: 'Proyectores', icon: Monitor },
  { id: 'microfonos', label: 'Micrófonos', resourceName: 'Micrófonos', icon: Mic },
  { id: 'parlantes', label: 'Parlantes', resourceName: 'Parlantes', icon: Volume2 },
  { id: 'laptops', label: 'Laptops', resourceName: 'Laptops', icon: Laptop },
];

export default function FilterBar({
  ambientes,
  selectedAmbienteId,
  onSelectAmbiente,
  selectedCriticalItem,
  onToggleCriticalItem,
  onResetFilters,
}) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* RF-03.1: Dropdown por Ambiente (8 espacios registrados) */}
        <div className="flex-1 flex items-center gap-3">
          <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <label htmlFor="filtro-ambiente" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Filtrar por Espacio / Ambiente
            </label>
            <select
              id="filtro-ambiente"
              value={selectedAmbienteId || ''}
              onChange={(e) => onSelectAmbiente(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
            >
              <option value="">Todos los ambientes (8 espacios disponibles)</option>
              {ambientes.map((amb) => (
                <option key={amb.id} value={amb.id}>
                  {amb.nombre} {amb.capacidad ? `(Cap. ${amb.capacidad} pers.)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Color Legend for Calendar (RF-01.2) */}
        <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
            Leyenda:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-700">Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-slate-700">Ocupado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-700">En revisión</span>
          </div>
        </div>
      </div>

      {/* RF-03.2: Filtros por Equipos Críticos (Checkboxes de inventario) */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Equipos Críticos:</span>
        </div>

        {CRITICAL_EQUIPMENT.map((item) => {
          const Icon = item.icon;
          const isSelected = selectedCriticalItem === item.resourceName;
          return (
            <button
              key={item.id}
              onClick={() => onToggleCriticalItem(item.resourceName)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                isSelected
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-500/20 ring-2 ring-brand-500/20'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
            </button>
          );
        })}

        {(selectedAmbienteId || selectedCriticalItem) && (
          <button
            onClick={onResetFilters}
            className="ml-auto text-xs text-brand-600 hover:text-brand-800 font-semibold underline underline-offset-2 py-1 px-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}

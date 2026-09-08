import React from 'react';
import { CalendarDays, Search, Building2, ShieldCheck, Lock, LayoutDashboard } from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  adminUser,
  onOpenAdminLogin,
  onGoToAdminDashboard,
}) {
  // RF-01.3: La barra lateral de navegación contendrá únicamente dos módulos:
  // 1. Calendario de Eventos
  // 2. Consultar Estado de Solicitud
  const navItems = [
    {
      id: 'calendario',
      label: 'Calendario de Eventos',
      icon: CalendarDays,
      description: 'Disponibilidad y reservas',
    },
    {
      id: 'seguimiento',
      label: 'Consultar Estado de Solicitud',
      icon: Search,
      description: 'Rastreo por ticket o correo',
    },
  ];

  return (
    <aside className="w-72 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800 shadow-xl select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-white flex items-center gap-1.5">
              GestEvents
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                v1.1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Universidad Continental</p>
          </div>
        </div>

        {/* Portal Público Info */}
        <div className="mt-4 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span>Portal Público</span>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">Sin Login</span>
        </div>
      </div>

      {/* Navigation (Only 2 modules as per RF-01.3) */}
      <nav className="flex-1 p-4 space-y-2">
        <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Módulos de Consulta
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl text-left transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/30 font-medium'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div
                className={`p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-800 text-slate-400 group-hover:text-brand-300 group-hover:bg-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-snug">{item.label}</div>
                <div
                  className={`text-xs truncate ${
                    isActive ? 'text-brand-100' : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  {item.description}
                </div>
              </div>

              {isActive && (
                <div className="w-1.5 h-6 rounded-full bg-cyan-300 absolute right-2 top-1/2 -translate-y-1/2 shadow-sm"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Módulo Privado: Jefatura de Operaciones (RF-05) */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-3">
        {adminUser ? (
          <button
            onClick={onGoToAdminDashboard}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
              activeTab === 'admin'
                ? 'bg-brand-600 text-white font-bold shadow-md shadow-brand-600/30'
                : 'bg-slate-800/90 text-brand-300 hover:bg-slate-800 border border-brand-500/30'
            }`}
          >
            <div className="p-1.5 bg-brand-500/20 rounded-lg text-brand-300">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-xs font-bold leading-tight truncate">Panel de Operaciones</div>
              <div className="text-[10px] text-slate-400">Sesión activa</div>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenAdminLogin}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-700/80 hover:border-brand-500/50 bg-slate-900 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all group"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-400 transition-colors" />
            <span>Acceso Operaciones / Admin</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
          <span>Jefatura de Operaciones</span>
        </div>
      </div>
    </aside>
  );
}

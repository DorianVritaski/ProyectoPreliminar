import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  Building2,
  Clock,
  Sparkles,
  Ticket,
  Users,
  CheckCircle2,
  Layers,
  Monitor,
  Armchair,
  ExternalLink,
  ChevronRight,
  Lock,
  Compass
} from 'lucide-react';

export default function LandingHome() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeFormatted = currentTime.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dateFormatted = currentTime.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white relative overflow-x-hidden">
      {/* Background Decorativo Dinámico */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(12,141,228,0.25),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header Institucional Superior */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Info */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-brand-500/15 overflow-hidden shrink-0 border border-slate-200/20">
              <img
                src="https://marketingperu.beglobal.biz/wp-content/uploads/2026/05/Universiadad-Continental-Isotipo.png"
                alt="Logo Universidad Continental"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight">
                  Universidad Continental
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  Campus Huancayo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Portal de Servicios y Logística Institucional
              </p>
            </div>
          </div>

          {/* Time & State Indicator */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 bg-slate-800/70 border border-slate-700/60 px-3.5 py-1.5 rounded-xl text-xs text-slate-300">
              <span className="capitalize font-medium">{dateFormatted}</span>
              <span className="w-1 h-3 border-r border-slate-600"></span>
              <span className="font-mono font-bold text-brand-300">{timeFormatted}</span>
            </div>

            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline">Servicios Operativos</span>
              <span className="sm:hidden">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 w-full">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/25 text-brand-300 text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Ventanilla Única Digital de Gestión Universitaria</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            Portal Central de Servicios {' '}
            <span className="bg-gradient-to-r from-brand-400 via-cyan-300 to-brand-200 bg-clip-text text-transparent">
              Institucional
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Selecciona el módulo universitario al que deseas acceder para tramitar solicitudes,
            consultar disponibilidad de espacios o autorizar el ingreso al campus.
          </p>
        </div>

        {/* 3. Grid de Módulos Principales (Cards de Alto Impacto) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto w-full">
          {/* Card 1: Gestión de Eventos y Reservas */}
          <div
            onClick={() => navigate('/eventos')}
            className="group relative bg-gradient-to-b from-slate-800/90 to-slate-900/90 hover:from-slate-800 hover:to-slate-850 p-7 sm:p-8 rounded-3xl border border-slate-700/80 hover:border-brand-500/60 shadow-xl hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
          >
            {/* Glow decorativo de fondo */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/15 rounded-full blur-2xl group-hover:bg-brand-500/25 transition-all pointer-events-none" />

            <div className="space-y-5 relative z-10">
              {/* Badge & Icono */}
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform duration-300">
                  <CalendarDays className="w-7 h-7 text-white" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Disponible para Solicitudes
                </span>
              </div>

              {/* Título & Descripción */}
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-brand-300 transition-colors flex items-center gap-2">
                  Gestión de Eventos y Reservas
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                  Consulta la disponibilidad en tiempo real de ambientes.
                  Solicita equipamiento, mobiliario y realiza el seguimiento continuo de tu trámite con código de ticket.
                </p>
              </div>

              {/* Características Clave (Pills) */}
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-brand-400" />
                  Ambientes Universitarios
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                  <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  Recursos y Mobiliario
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Validación
                </span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
                Ingreso libre sin contraseña para solicitantes
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-600/30 group-hover:shadow-brand-500/40 transition-all"
              >
                <span>Ir a Gestión de Eventos</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card 2: Control de Accesos */}
          <div
            onClick={() => navigate('/accesos')}
            className="group relative bg-gradient-to-b from-slate-800/90 to-slate-900/90 hover:from-slate-800 hover:to-slate-850 p-7 sm:p-8 rounded-3xl border border-slate-700/80 hover:border-amber-500/50 shadow-xl hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-300 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
          >
            {/* Glow decorativo de fondo */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />

            <div className="space-y-5 relative z-10">
              {/* Badge & Icono */}
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform duration-300">
                  <Ticket className="w-7 h-7 text-white" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Disponible para Solicitudes
                </span>
              </div>

              {/* Título & Descripción */}
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-2">
                  Control de Accesos
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                  Módulo de autorización, registro e ingreso de personal externo, contratistas y proveedores a las
                  instalaciones del campus universitario.
                </p>
              </div>

              {/* Características Clave (Pills) */}
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Control en Garitas
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                  <Users className="w-3.5 h-3.5 text-orange-400" />
                  Pólizas y Nómina Externa
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                  <Ticket className="w-3.5 h-3.5 text-yellow-400" />
                  Pase Digital y Ticket
                </span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
                Ingreso libre sin contraseña para solicitantes
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-amber-600/30 group-hover:shadow-amber-500/40 transition-all"
              >
                <span>Ir a Control de Accesos</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* 4. Mini Barra Informativa de Soporte e Integración */}
        <div className="mt-12 max-w-5xl mx-auto w-full bg-slate-950/40 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">
                Soporte y Coordinación Operativa Centralizada
              </p>
              <p className="text-[11px]">
                Administrado por la Jefatura de Operaciones, Soporte TI y Protocolo SSOMA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => navigate('/eventos')}
              className="hover:text-brand-300 underline underline-offset-4 transition-colors font-medium"
            >
              Consultar Calendario de Eventos
            </button>
            <span>•</span>
            <button
              onClick={() => navigate('/eventos/admin')}
              className="hover:text-brand-300 underline underline-offset-4 transition-colors font-medium flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              Acceso Administrativo
            </button>
          </div>
        </div>
      </main>

      {/* 5. Footer Institucional */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/70 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Universidad Continental — Dirección de Operaciones y Servicios Generales.</p>
          <p className="text-[11px] text-slate-500">
            Plataforma GestEvents v1.2 • Campus Huancayo
          </p>
        </div>
      </footer>
    </div>
  );
}

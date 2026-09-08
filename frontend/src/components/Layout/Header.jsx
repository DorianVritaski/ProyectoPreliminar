import React, { useState, useEffect } from 'react';
import { PlusCircle, Clock, Calendar, CheckCircle2 } from 'lucide-react';

export default function Header({ onOpenReservation }) {
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
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm shrink-0 z-10">
      {/* Campus Info */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-brand-700 uppercase tracking-wider">
            Campus Universitario Central
          </span>
          <span className="text-sm font-bold text-slate-800">
            Sistema de Gestión y Reserva de Espacios y Mobiliario
          </span>
        </div>
      </div>

      {/* Center/Right Info and CTA */}
      <div className="flex items-center gap-6">
        {/* Clock & Date */}
        <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg">
          <div className="flex items-center gap-1.5 capitalize font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{dateFormatted}</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-300"></div>
          <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-700">
            <Clock className="w-3.5 h-3.5 text-brand-500" />
            <span>{timeFormatted}</span>
          </div>
        </div>

        {/* Action Button: Nueva Reserva */}
        <button
          onClick={() => onOpenReservation()}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white font-medium text-sm px-4 py-2 rounded-xl shadow-md shadow-brand-500/20 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nueva Solicitud</span>
        </button>
      </div>
    </header>
  );
}

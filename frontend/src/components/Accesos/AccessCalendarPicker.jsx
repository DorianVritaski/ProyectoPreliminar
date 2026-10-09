import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Briefcase
} from 'lucide-react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function AccessCalendarPicker({
  fechaInicio,
  fechaFin,
  onChange,
}) {
  // Parse initial dates or default to today + tomorrow
  const parseInitialDate = (isoStr) => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const initialStart = parseInitialDate(fechaInicio) || new Date();
  const initialEnd = parseInitialDate(fechaFin) || new Date(Date.now() + 2 * 3600 * 1000);

  const formatLocalDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatLocalTime = (d) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [selectedStartDate, setSelectedStartDate] = useState(formatLocalDate(initialStart));
  const [selectedEndDate, setSelectedEndDate] = useState(formatLocalDate(initialEnd));
  const [startTime, setStartTime] = useState(formatLocalTime(initialStart) || '08:00');
  const [endTime, setEndTime] = useState(formatLocalTime(initialEnd) || '17:00');

  // Mes en visualización
  const [viewMonth, setViewMonth] = useState(initialStart.getMonth());
  const [viewYear, setViewYear] = useState(initialStart.getFullYear());

  // Modo: fecha única vs rango
  const [isRangeMode, setIsRangeMode] = useState(false);

  // Sincronizar hacia afuera (onChange) cuando cambien los estados locales
  useEffect(() => {
    if (!selectedStartDate) return;
    const endD = isRangeMode && selectedEndDate ? selectedEndDate : selectedStartDate;
    const startIso = `${selectedStartDate}T${startTime || '08:00'}:00`;
    const endIso = `${endD}T${endTime || '17:00'}:00`;

    onChange?.({
      fecha_inicio: startIso,
      fecha_fin: endIso,
    });
  }, [selectedStartDate, selectedEndDate, startTime, endTime, isRangeMode]);

  // Navegar meses
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewMonth(now.getMonth());
    setViewYear(now.getFullYear());
    const todayStr = formatLocalDate(now);
    setSelectedStartDate(todayStr);
    setSelectedEndDate(todayStr);
  };

  // Matriz de días del mes
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // 0 = Domingo, 1 = Lunes, etc. Ajustar para que la semana empiece en Lunes (0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];
    // Celdas vacías antes del primer día
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ dayNumber: null, dateStr: null });
    }
    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      days.push({
        dayNumber: d,
        dateStr: formatLocalDate(dateObj),
        dateObj,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Manejar clic en un día
  const handleDayClick = (dateStr) => {
    if (!dateStr) return;

    if (!isRangeMode) {
      setSelectedStartDate(dateStr);
      setSelectedEndDate(dateStr);
    } else {
      // Modo rango
      if (!selectedStartDate || (selectedStartDate && selectedEndDate && selectedStartDate !== selectedEndDate)) {
        setSelectedStartDate(dateStr);
        setSelectedEndDate(dateStr);
      } else if (selectedStartDate && (!selectedEndDate || selectedStartDate === selectedEndDate)) {
        if (dateStr < selectedStartDate) {
          setSelectedEndDate(selectedStartDate);
          setSelectedStartDate(dateStr);
        } else {
          setSelectedEndDate(dateStr);
        }
      }
    }
  };

  // Presets de horarios comunes
  const handleApplyTimePreset = (start, end) => {
    setStartTime(start);
    setEndTime(end);
  };

  // Formato amigable de la fecha seleccionada
  const formattedSummary = useMemo(() => {
    if (!selectedStartDate) return 'Seleccione una fecha en el calendario';

    const parseFriendly = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('es-PE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    const startText = parseFriendly(selectedStartDate);
    const endText = selectedEndDate && selectedEndDate !== selectedStartDate ? parseFriendly(selectedEndDate) : null;

    if (endText) {
      return `Desde el ${startText} (${startTime}) hasta el ${endText} (${endTime})`;
    }
    return `${startText} de ${startTime} a ${endTime}`;
  }, [selectedStartDate, selectedEndDate, startTime, endTime]);

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  return (
    <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 space-y-5 shadow-lg">
      {/* 1. Selector de Modo: Fecha Única vs Rango de Fechas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Calendario de Programación del Acceso
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsRangeMode(false);
              setSelectedEndDate(selectedStartDate);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              !isRangeMode
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Fecha Única (1 día)
          </button>
          <button
            type="button"
            onClick={() => setIsRangeMode(true)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              isRangeMode
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Rango de Fechas (Varios días)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2. Calendario Mensual Interactivo (8 columnas en desktop) */}
        <div className="lg:col-span-7 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
          {/* Cabecera del Calendario */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white capitalize">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={handleJumpToToday}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 transition-colors"
              >
                Hoy
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAY_NAMES.map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-slate-400 uppercase py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Cuadrícula de Días */}
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((item, index) => {
              if (!item.dayNumber) {
                return <div key={`empty-${index}`} className="h-9 sm:h-10" />;
              }

              const isStart = item.dateStr === selectedStartDate;
              const isEnd = item.dateStr === selectedEndDate;
              const isSelected = isStart || isEnd;
              const isBetween =
                isRangeMode &&
                selectedStartDate &&
                selectedEndDate &&
                item.dateStr > selectedStartDate &&
                item.dateStr < selectedEndDate;
              const isToday = item.dateStr === todayStr;

              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => handleDayClick(item.dateStr)}
                  className={`h-9 sm:h-10 rounded-xl text-xs font-bold transition-all relative flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400 z-10'
                      : isBetween
                      ? 'bg-amber-500/20 text-amber-200 border-y border-amber-500/30'
                      : isToday
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40 hover:bg-slate-700'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span>{item.dayNumber}</span>
                  {isToday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-amber-400 absolute bottom-1"></span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60">
            <span>
              {isRangeMode
                ? 'Haga clic en la fecha de inicio y luego en la fecha de fin.'
                : 'Haga clic en cualquier día para seleccionar la fecha.'}
            </span>
          </div>
        </div>

        {/* 3. Configuración de Horarios & Presets (5 columnas en desktop) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Horario Autorizado</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Hora de Inicio:
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Hora de Fin:
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Presets Rápidos de Turnos Universitarios */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Turnos Frecuentes en Campus:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyTimePreset('08:00', '13:00')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white text-left transition-colors flex items-center gap-1.5"
                >
                  <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Mañana (08:00 - 13:00)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyTimePreset('14:00', '18:00')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white text-left transition-colors flex items-center gap-1.5"
                >
                  <Sunset className="w-3 h-3 text-orange-400 shrink-0" />
                  <span>Tarde (14:00 - 18:00)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyTimePreset('08:00', '18:00')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white text-left transition-colors flex items-center gap-1.5"
                >
                  <Briefcase className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Jornada (08:00 - 18:00)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyTimePreset('18:00', '22:00')}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white text-left transition-colors flex items-center gap-1.5"
                >
                  <Moon className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>Noche (18:00 - 22:00)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta de Resumen Visual de la Vigencia */}
          <div className="bg-amber-950/30 border border-amber-500/30 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Vigencia del Pase Programada:</span>
            </div>
            <p className="text-xs text-slate-200 font-medium capitalize leading-relaxed">
              {formattedSummary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

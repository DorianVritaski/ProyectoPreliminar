import React, { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import FilterBar from './FilterBar';
import DayDetailModal from './DayDetailModal';
import { formatTimeRange, getStatusInfo } from '../../utils/formatters';

export default function CalendarView({
  eventos,
  ambientes,
  selectedAmbienteId,
  onSelectAmbiente,
  selectedCriticalItem,
  onToggleCriticalItem,
  onResetFilters,
  onOpenReservationWithDate,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const calendarRef = useRef(null);

  // Mapear eventos al formato de FullCalendar con colores y estilo según estado
  const calendarEvents = eventos.map((evt) => {
    const statusStyle = getStatusInfo(evt.estado);
    return {
      id: String(evt.id),
      title: `${formatTimeRange(evt.fecha_inicio, evt.fecha_fin)} | ${evt.ambiente}`,
      start: evt.fecha_inicio,
      end: evt.fecha_fin,
      backgroundColor: statusStyle.color,
      borderColor: statusStyle.color,
      textColor: '#ffffff',
      extendedProps: evt,
    };
  });

  // Manejar clic en una celda de fecha (RF-02.2)
  const handleDateClick = (arg) => {
    // Convertir arg.dateStr a Date
    const clickedDate = new Date(arg.dateStr + 'T00:00:00');
    setSelectedDay(clickedDate);
    setIsDayModalOpen(true);
  };

  // Manejar clic en un evento
  const handleEventClick = (info) => {
    const eventDate = new Date(info.event.start);
    setSelectedDay(eventDate);
    setIsDayModalOpen(true);
  };

  // Obtener eventos correspondientes al día seleccionado
  const dayEvents = selectedDay
    ? eventos.filter((evt) => {
        const evtDate = new Date(evt.fecha_inicio);
        return (
          evtDate.getFullYear() === selectedDay.getFullYear() &&
          evtDate.getMonth() === selectedDay.getMonth() &&
          evtDate.getDate() === selectedDay.getDate()
        );
      })
    : [];

  // Custom Event Content Renderer (RF-02.1)
  const renderEventContent = (eventInfo) => {
    const raw = eventInfo.event.extendedProps;
    return (
      <div className="flex items-center gap-1.5 px-1 py-0.5 overflow-hidden text-ellipsis whitespace-nowrap w-full">
        <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
        <span className="font-bold text-[11px] leading-tight">
          {formatTimeRange(raw.fecha_inicio, raw.fecha_fin)}
        </span>
        <span className="opacity-75 text-[10px]">|</span>
        <span className="font-medium text-[11px] truncate">{raw.ambiente}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtros de Ambiente y Equipos Críticos */}
      <FilterBar
        ambientes={ambientes}
        selectedAmbienteId={selectedAmbienteId}
        onSelectAmbiente={onSelectAmbiente}
        selectedCriticalItem={selectedCriticalItem}
        onToggleCriticalItem={onToggleCriticalItem}
        onResetFilters={onResetFilters}
      />

      {/* Contenedor del Calendario */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate="2026-09-01" // Alínea con datos de prueba o mes actual
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          locale="es"
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
          }}
          events={calendarEvents}
          eventContent={renderEventContent}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          // RF-02.1: Si existen más de 2 eventos en un mismo día, indicador interactivo (+N más)
          dayMaxEvents={2}
          moreLinkText={(num) => `+${num} eventos más`}
          moreLinkClick={(arg) => {
            setSelectedDay(arg.date);
            setIsDayModalOpen(true);
            return 'none'; // Previene popover por defecto y abre nuestro modal de Detalle del Día
          }}
          height="auto"
          fixedWeekCount={false}
          dayCellClassNames={() => 'cursor-pointer hover:bg-slate-50/70 transition-colors'}
        />
      </div>

      {/* Modal Detalle del Día (RF-02.2) */}
      <DayDetailModal
        isOpen={isDayModalOpen}
        date={selectedDay}
        dayEvents={dayEvents}
        onClose={() => setIsDayModalOpen(false)}
        onReserveDate={(date) => {
          onOpenReservationWithDate(date);
        }}
      />
    </div>
  );
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateFull(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTimeRange(startStr, endStr) {
  return `${formatTime(startStr)} - ${formatTime(endStr)}`;
}

export function getStatusInfo(status) {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'APROBADO':
      return {
        label: 'Ocupado / Aprobado',
        shortLabel: 'Ocupado',
        color: '#e11d48', // Rose 600
        textColor: 'text-rose-700',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      };
    case 'PENDIENTE':
      return {
        label: 'En revisión',
        shortLabel: 'En revisión',
        color: '#d97706', // Amber 600
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'RECHAZADO':
      return {
        label: 'Rechazado',
        shortLabel: 'Rechazado',
        color: '#64748b', // Slate 500
        textColor: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    default:
      return {
        label: 'Libre',
        shortLabel: 'Libre',
        color: '#10b981', // Emerald 500
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
  }
}

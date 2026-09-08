import React from 'react';
import { getStatusInfo } from '../../utils/formatters';

export default function StatusBadge({ status }) {
  const info = getStatusInfo(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${info.badgeClass}`}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: info.color }}
      ></span>
      <span>{info.label}</span>
    </span>
  );
}

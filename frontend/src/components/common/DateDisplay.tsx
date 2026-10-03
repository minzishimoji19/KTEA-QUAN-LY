import React from 'react';
import { cn } from '../../lib/utils';
import { formatDate, formatDateTime } from '../../utils/formatters';

export interface DateDisplayProps {
  date: string | Date | null | undefined;
  showTime?: boolean;
  relativeContext?: boolean;
  className?: string;
}

export const DateDisplay: React.FC<DateDisplayProps> = ({
  date,
  showTime = false,
  relativeContext = false,
  className,
}) => {
  if (!date) return <span className="text-slate-500 font-mono text-[11px]">--</span>;

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return <span className="text-slate-500 font-mono text-[11px]">--</span>;

  const formatted = showTime ? formatDateTime(d.toISOString()) : formatDate(d.toISOString());

  let relative = '';
  if (relativeContext) {
    const diffMs = d.getTime() - Date.now();
    const isPast = diffMs < 0;
    const absHours = Math.abs(diffMs) / (1000 * 60 * 60);
    const absDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);

    if (absHours < 1) {
      const minutes = Math.max(1, Math.round(Math.abs(diffMs) / (1000 * 60)));
      relative = isPast ? `${minutes} phút trước` : `sau ${minutes} phút`;
    } else if (absHours < 24) {
      const hours = Math.round(absHours);
      relative = isPast ? `${hours} giờ trước` : `sau ${hours} giờ`;
    } else if (absDays < 30) {
      const days = Math.round(absDays);
      relative = isPast ? `${days} ngày trước` : `sau ${days} ngày`;
    } else {
      const months = Math.round(absDays / 30);
      relative = isPast ? `${months} tháng trước` : `sau ${months} tháng`;
    }
  }

  return (
    <span
      title={d.toISOString()}
      className={cn('font-mono text-xs text-slate-300 inline-flex items-center gap-1 whitespace-nowrap', className)}
    >
      <span>{formatted}</span>
      {relative && (
        <span className="text-[10px] text-slate-500 font-sans">({relative})</span>
      )}
    </span>
  );
};

export default DateDisplay;

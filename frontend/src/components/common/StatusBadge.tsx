import React from 'react';
import { cn } from '../../lib/utils';
import { translateStatus } from '../../locales';

export interface StatusBadgeProps {
  status: string;
  type?: 'customer' | 'case' | 'followup' | 'push' | 'priority' | 'need' | 'recommendation' | 'default';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
}) => {
  const normalized = (status || '').toUpperCase();

  let styles = 'bg-slate-800 text-slate-300 border-slate-700/60';

  if (['ACTIVE', 'APPROVED', 'SUCCESS', 'COMPLETED', 'RESOLVED', 'ACCEPTED', 'CONVERTED_TO_PUSH', 'CARD_ACTIVATED'].includes(normalized)) {
    styles = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
  } else if (['NEW', 'CARD_ISSUED'].includes(normalized)) {
    styles = 'bg-purple-950/60 text-purple-300 border-purple-800/50';
  } else if (['PROSPECT', 'IN_PROGRESS', 'SUBMITTED', 'OPEN', 'MEDIUM', 'REVIEWED', 'REGISTRATION_CREATED', 'REGISTRATION_COMPLETED'].includes(normalized)) {
    styles = 'bg-blue-950/60 text-blue-400 border-blue-800/50';
  } else if (['LEAD', 'UNDER_REVIEW', 'PENDING', 'HIGH'].includes(normalized)) {
    styles = 'bg-amber-950/60 text-amber-400 border-amber-800/50';
  } else if (['LOST', 'REJECTED', 'FAILED', 'OVERDUE', 'URGENT', 'DROPPED'].includes(normalized)) {
    styles = 'bg-rose-950/60 text-rose-400 border-rose-800/50';
  } else if (['DORMANT', 'DRAFT', 'CANCELLED', 'LOW', 'DISMISSED', 'EXPIRED', 'NOT_SELECTED'].includes(normalized)) {
    styles = 'bg-slate-900 text-slate-400 border-slate-800';
  }

  const translatedLabel = translateStatus(normalized);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border select-none whitespace-nowrap',
        styles,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      <span>{translatedLabel}</span>
    </span>
  );
};

export default StatusBadge;

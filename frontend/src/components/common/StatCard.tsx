import React from 'react';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  isLoading,
  className,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 transition-all select-none',
        onClick ? 'cursor-pointer hover:border-slate-700/90 hover:bg-slate-900/90' : '',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase font-mono tracking-wider text-slate-400 truncate">
            {label}
          </p>
          {isLoading ? (
            <div className="h-7 w-20 bg-slate-800 animate-pulse rounded mt-1.5" />
          ) : (
            <h3 className="text-xl font-bold font-mono text-slate-100 mt-1 truncate">
              {value}
            </h3>
          )}

          <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
            {trend && (
              <span
                className={cn(
                  'font-medium font-mono text-[10px] px-1 py-0.2 rounded',
                  trend.isPositive
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                    : 'bg-red-950/60 text-red-400 border border-red-800/40'
                )}
              >
                {trend.value}
              </span>
            )}
            {subtext && (
              <span className="text-slate-400 text-[11px] truncate">
                {subtext}
              </span>
            )}
          </div>
        </div>

        {icon && (
          <div className="w-8 h-8 rounded-md bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

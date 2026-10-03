import React, { useState } from 'react';
import { Info, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AnalyticsMetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  definition?: string;
  formula?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  isLoading?: boolean;
  onClick?: () => void;
  drillDownLabel?: string;
  className?: string;
}

export const AnalyticsMetricCard: React.FC<AnalyticsMetricCardProps> = ({
  label,
  value,
  subtext,
  definition,
  formula,
  icon,
  trend,
  isLoading,
  onClick,
  drillDownLabel,
  className,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 transition-all select-none',
        onClick
          ? 'cursor-pointer hover:border-blue-500/50 hover:bg-slate-900/90 hover:shadow-md'
          : '',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-medium uppercase font-mono tracking-wider text-slate-400 truncate">
              {label}
            </p>
            {definition && (
              <div
                className="relative inline-block"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400 cursor-help" />
                {showTooltip && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-60 p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-slate-300 shadow-xl z-50 pointer-events-none leading-relaxed">
                    <p className="font-semibold text-slate-100 font-sans mb-1">{label}</p>
                    <p className="text-slate-300">{definition}</p>
                    {formula && (
                      <p className="mt-1 pt-1 border-t border-slate-800 text-[10px] font-mono text-blue-300">
                        Công thức: {formula}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="h-7 w-20 bg-slate-800 animate-pulse rounded mt-1.5" />
          ) : (
            <h3 className="text-xl font-bold font-mono text-slate-100 mt-1 truncate tracking-tight">
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

        <div className="flex flex-col items-end gap-1">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0 group-hover:text-blue-400 group-hover:border-blue-500/40 transition-colors">
              {icon}
            </div>
          )}
          {onClick && (
            <span className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-mono">
              <span>{drillDownLabel || 'Xem chi tiết'}</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsMetricCard;

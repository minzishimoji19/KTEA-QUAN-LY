import React from 'react';
import { ExternalLink } from 'lucide-react';

export interface DistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
  subtext?: string;
  color?: string;
}

export interface DistributionBarProps {
  title: string;
  question?: string;
  items: DistributionItem[];
  totalLabel?: string;
  onItemClick?: (item: DistributionItem) => void;
  drillDownTooltip?: string;
  emptyMessage?: string;
}

export const DistributionBar: React.FC<DistributionBarProps> = ({
  title,
  question,
  items,
  totalLabel,
  onItemClick,
  drillDownTooltip,
  emptyMessage = 'Chưa có dữ liệu phân bố',
}) => {
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
        <div>
          <h4 className="text-xs font-semibold text-slate-200 font-sans uppercase tracking-wider">
            {title}
          </h4>
          {question && (
            <p className="text-[11px] text-blue-400/90 font-sans mt-0.5">{question}</p>
          )}
        </div>
        {totalLabel && (
          <span className="text-[11px] font-mono text-slate-400">
            {totalLabel}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 font-mono py-4 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const barWidth = Math.max(3, Math.round((item.count / maxCount) * 100));
            const barColor = item.color || 'bg-blue-500';

            return (
              <div
                key={item.key}
                onClick={() => onItemClick?.(item)}
                className={`group relative text-xs ${
                  onItemClick ? 'cursor-pointer' : ''
                }`}
                title={
                  onItemClick
                    ? drillDownTooltip || `Nhấn để xem danh sách "${item.label}"`
                    : undefined
                }
              >
                <div className="flex items-center justify-between mb-1 text-[11px]">
                  <span className="font-medium text-slate-300 group-hover:text-blue-400 transition-colors flex items-center gap-1 truncate max-w-[200px]">
                    <span className="truncate">{item.label}</span>
                    {onItemClick && (
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity flex-shrink-0" />
                    )}
                  </span>
                  <div className="flex items-center gap-2 font-mono flex-shrink-0">
                    <span className="font-semibold text-slate-100">
                      {item.count}
                    </span>
                    <span className="text-slate-500 w-10 text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {item.subtext && (
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                    {item.subtext}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DistributionBar;

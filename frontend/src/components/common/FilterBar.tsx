import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export interface FilterBarProps {
  children: React.ReactNode;
  activeCount?: number;
  onReset?: () => void;
  className?: string;
  extraActions?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  activeCount = 0,
  onReset,
  className,
  extraActions,
}) => {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1 select-none">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono text-[11px] uppercase tracking-wider hidden sm:inline">Bộ lọc</span>
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 text-[10px] font-mono flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </div>

        {children}

        {activeCount > 0 && onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-slate-200 h-8 gap-1 px-2"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Xóa lọc</span>
          </Button>
        )}
      </div>

      {extraActions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {extraActions}
        </div>
      )}
    </div>
  );
};

export default FilterBar;

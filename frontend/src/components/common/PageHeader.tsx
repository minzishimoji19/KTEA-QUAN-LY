import React from 'react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  category?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  category,
  badge,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-5',
        className
      )}
    >
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          {category && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
              {category}
            </span>
          )}
          {badge}
        </div>
        <h1 className="text-lg font-bold text-slate-100 tracking-tight font-sans">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface LoadingStateProps {
  message?: string;
  subtext?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading operational data...',
  subtext,
  className,
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 rounded-lg border border-slate-800 bg-slate-900/50 backdrop-blur-sm text-center',
        className
      )}
    >
      <Loader2 className={cn('animate-spin text-blue-500 mb-3', iconSizes[size])} />
      <p className="text-sm font-medium text-slate-200">{message}</p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
};

export default LoadingState;

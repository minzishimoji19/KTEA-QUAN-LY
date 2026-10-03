import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
  {
    variants: {
      variant: {
        default: 'bg-blue-900/40 text-blue-200 border border-blue-700/50',
        secondary: 'bg-slate-800 text-slate-300 border border-slate-700/60',
        success: 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/50',
        warning: 'bg-amber-950/60 text-amber-300 border border-amber-700/50',
        destructive: 'bg-red-950/60 text-red-300 border border-red-700/50',
        outline: 'border border-slate-700 text-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({ className, variant, ...props }) => {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
};

export default Badge;

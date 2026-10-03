import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm border border-blue-500/30',
        secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700/80 border border-slate-700/60 shadow-sm',
        outline: 'border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300',
        destructive: 'bg-red-600/90 text-white hover:bg-red-500 border border-red-500/30 shadow-sm',
        ghost: 'hover:bg-slate-800/80 hover:text-slate-100 text-slate-400',
        link: 'text-blue-400 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-7 px-2.5 rounded-md text-xs',
        md: 'h-8 px-3.5 text-xs',
        lg: 'h-10 px-4 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
export default Button;

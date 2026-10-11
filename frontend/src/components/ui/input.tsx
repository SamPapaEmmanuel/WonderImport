import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const inputClass =
  'h-9 w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors focus:outline-none focus:ring-2 focus:ring-tide/30 focus:border-tide disabled:bg-mist disabled:text-ink-3';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(inputClass, invalid ? 'border-rose' : 'border-line', className)} {...rest} />;
});

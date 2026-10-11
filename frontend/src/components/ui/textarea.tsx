import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-tide focus:ring-2 focus:ring-tide/30 focus:outline-none disabled:bg-mist',
        invalid ? 'border-rose' : 'border-line',
        className,
      )}
      {...rest}
    />
  );
});

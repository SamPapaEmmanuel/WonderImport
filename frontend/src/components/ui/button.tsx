import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-fjord text-on-accent border-fjord hover:bg-fjord-strong hover:border-fjord-strong',
  secondary: 'bg-surface text-ink border-line hover:bg-mist',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-mist hover:text-ink',
  danger: 'bg-rose text-on-accent border-rose hover:opacity-90',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

/** Button styling for elements that must be links (e.g. <Link>), so a link never wraps a <button>. */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn('inline-flex items-center justify-center rounded-control border font-medium whitespace-nowrap transition-colors', VARIANT[variant], SIZE[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className, children, type = 'button', form, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      form={form}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-control border font-medium whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

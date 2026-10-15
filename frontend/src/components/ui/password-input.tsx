import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { inputClass, type InputProps } from './input';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Accessible name for the toggle. Defaults to Show/Hide password. */
  toggleLabel?: string;
}

/**
 * Password field with a show/hide toggle.
 * Defaults to hidden; toggle never submits the surrounding form.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { invalid, className, toggleLabel, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative block">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, invalid ? 'border-rose' : 'border-line', 'pr-10', className)}
        {...rest}
      />
      <button
        type="button"
        aria-label={toggleLabel ?? (show ? 'Hide password' : 'Show password')}
        aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((v) => !v)}
        // Keep focus in the input so typing isn't interrupted.
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-control text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tide/40"
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </span>
  );
});

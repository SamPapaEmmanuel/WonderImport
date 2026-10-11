import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** A single Input, Select or textarea; it receives id, aria-describedby and invalid. */
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': describedBy, invalid: Boolean(error) || undefined })
    : children;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      {control}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-rose">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

import { cloneElement, isValidElement, useId, Fragment, type ReactElement, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** A single Input, Select or textarea; it receives id, aria-describedby and invalid. */
  children: ReactElement<Record<string, unknown>> | ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const isFragment = isValidElement(children) && children.type === Fragment;
  const isHtmlTag = isValidElement(children) && typeof children.type === 'string';

  const control =
    isValidElement(children) && !isFragment
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id: (children.props as { id?: string }).id ?? id,
          'aria-describedby': (children.props as { 'aria-describedby'?: string })['aria-describedby'] ?? describedBy,
          ...(isHtmlTag ? {} : { invalid: Boolean(error) || undefined }),
        })
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

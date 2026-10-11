'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "center" for confirmations and short forms, "drawer" for record detail/editing. */
  variant?: 'center' | 'drawer';
}

/** Native <dialog>: focus trapping, Escape to close and inert background come from the browser. */
export function Dialog({ open, onClose, title, description, children, footer, variant = 'center' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={titleId}
      className={cn(
        'border border-line bg-surface p-0 text-ink backdrop:bg-harbour/40',
        variant === 'center' && 'm-auto w-[min(520px,calc(100vw-32px))] rounded-panel',
        variant === 'drawer' && 'my-0 mr-0 ml-auto h-dvh max-h-dvh w-[min(560px,100vw)] rounded-none',
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-mist hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line-soft px-5 py-3.5">{footer}</footer>}
      </div>
    </dialog>
  );
}

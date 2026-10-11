'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  hint?: ReactNode;
}

interface MenuProps {
  /** Renders the trigger; spread `props` onto a button. */
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; ref: (el: HTMLButtonElement | null) => void }) => ReactNode;
  items: (MenuItem | 'separator')[];
  align?: 'start' | 'end';
  header?: ReactNode;
}

/**
 * Popover menu rendered in a portal with fixed positioning,
 * so it is never clipped by scrolling table containers.
 */
export function Menu({ trigger, items, align = 'end', header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Inside a modal <dialog>, everything outside it is inert, so render the menu within that dialog.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    setContainer(anchor.current.closest('dialog') ?? document.body);
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const width = panel.current?.offsetWidth ?? 220;
      const height = panel.current?.offsetHeight ?? 0;
      const left = align === 'end' ? r.right - width : r.left;
      const below = r.bottom + 6 + height < window.innerHeight;
      setPos({ top: below ? r.bottom + 6 : r.top - height - 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); // keep a surrounding dialog open
        setOpen(false);
        anchor.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const n = e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
        buttons[n]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus());
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu', ref: (el) => {
        anchor.current = el;
      } })}
      {open &&
        container &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className="fixed z-50 min-w-[210px] rounded-panel border border-line bg-surface py-1.5 text-[13px] shadow-[0_12px_32px_-16px_rgba(18,40,58,0.4)]"
          >
            {header && <div className="border-b border-line-soft px-3.5 pt-1 pb-2 text-xs text-ink-3">{header}</div>}
            {items.map((item, i) =>
              item === 'separator' ? (
                <div key={`sep-${i}`} className="my-1.5 border-t border-line-soft" />
              ) : (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3.5 py-2 text-left hover:bg-mist focus:bg-mist focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    item.tone === 'danger' && 'text-rose',
                  )}
                >
                  {item.icon && <span className="mt-px flex-none text-ink-3">{item.icon}</span>}
                  <span className="min-w-0">
                    <span className="block">{item.label}</span>
                    {item.hint && <span className="block text-xs text-ink-3">{item.hint}</span>}
                  </span>
                </button>
              ),
            )}
          </div>,
          container,
        )}
    </>
  );
}

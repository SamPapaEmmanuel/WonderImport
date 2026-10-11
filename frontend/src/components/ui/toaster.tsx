'use client';

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore, type ToastTone } from '@/stores/toast-store';

const ICON: Record<ToastTone, { icon: typeof Info; cls: string }> = {
  success: { icon: CircleCheck, cls: 'text-mint' },
  error: { icon: CircleAlert, cls: 'text-rose' },
  warning: { icon: TriangleAlert, cls: 'text-amber' },
  info: { icon: Info, cls: 'text-tide' },
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
      {toasts.map((t) => {
        const { icon: Icon, cls } = ICON[t.tone];
        return (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex gap-2.5 rounded-panel border border-line bg-surface px-3.5 py-3 shadow-[0_8px_24px_-12px_rgba(18,40,58,0.35)]">
            <Icon className={cn('mt-px size-4 flex-none', cls)} aria-hidden />
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-ink-2">{t.description}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="-m-1 h-fit rounded p-1 text-ink-3 hover:text-ink" aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

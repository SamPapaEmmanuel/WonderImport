import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'error';

const TONE: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'bg-glacier text-ink', icon: Info },
  success: { box: 'bg-mint-bg text-ink', icon: CircleCheck },
  warning: { box: 'bg-amber-bg text-ink', icon: TriangleAlert },
  error: { box: 'bg-rose-bg text-ink', icon: CircleAlert },
};

const ICON_COLOR: Record<Tone, string> = { info: 'text-fjord', success: 'text-mint', warning: 'text-amber', error: 'text-rose' };

/** Inline message. Errors explain what happened and what to do next. */
export function Notice({ tone = 'info', title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, icon: Icon } = TONE[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-2.5 rounded-control px-3.5 py-3 text-[13px]', box, className)}>
      <Icon className={cn('mt-px size-4 flex-none', ICON_COLOR[tone])} aria-hidden />
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api-error';
import { Button } from './button';

/** Shown when a list or panel has nothing yet. Always points to the next action. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-[18px] py-8">
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-prose text-[13px] text-ink-2">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Shown when a request failed. Includes the request ID for support. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = ApiError.from(error);
  return (
    <div role="alert" className="flex flex-col items-start gap-2 px-[18px] py-6">
      <p className="font-medium text-rose">Could not load this section</p>
      <p className="max-w-prose text-[13px] text-ink-2">{e.message}</p>
      {e.requestId && <p className="text-xs text-ink-3">Request ID {e.requestId}</p>}
      {onRetry && (
        <Button size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}

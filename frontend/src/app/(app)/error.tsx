'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-panel border border-line bg-surface p-6">
      <h1 className="font-semibold">This screen stopped working</h1>
      <p className="mt-1.5 text-ink-2">{error.message || 'An unexpected error occurred while showing this page.'}</p>
      {error.digest && <p className="mt-1 text-xs text-ink-3">Reference {error.digest}</p>}
      <Button className="mt-4" onClick={reset}>
        Reload this screen
      </Button>
    </div>
  );
}

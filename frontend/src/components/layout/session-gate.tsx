'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSessionStore } from '@/stores/session-store';
import { BrandMark } from './brand';

/**
 * Loads the WonderImport profile behind the Supabase session.
 * A valid Supabase login is not enough: the person must also be provisioned in WonderImport.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { status, error, load, clear } = useSessionStore();
  const router = useRouter();

  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    clear();
    router.replace('/login');
  }

  if (status === 'error' && error) {
    const blocked = error.code === 'ACCOUNT_NOT_PROVISIONED' || error.code === 'ACCOUNT_DISABLED';
    return (
      <div className="grid min-h-dvh place-items-center bg-mist p-6">
        <div className="w-full max-w-md rounded-panel border border-line bg-surface p-7">
          <BrandMark />
          <h1 className="mt-5 text-lg font-semibold">{blocked ? 'You don’t have access yet' : 'WonderImport could not load your account'}</h1>
          <p className="mt-2 text-ink-2">{error.message}</p>
          {error.requestId && <p className="mt-2 text-xs text-ink-3">Request ID {error.requestId}</p>}
          <div className="mt-6 flex gap-2.5">
            {!blocked && (
              <Button variant="primary" onClick={() => void load()}>
                Try again
              </Button>
            )}
            <Button onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading your workspace">
        <div className="hidden w-[232px] bg-harbour lg:block" />
        <div className="flex-1">
          <div className="h-[60px] border-b border-line bg-surface" />
          <div className="flex flex-col gap-5 p-7">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

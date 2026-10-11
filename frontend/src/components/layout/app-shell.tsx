'use client';

import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { MobileNav } from './mobile-nav';
import { SessionGate } from './session-gate';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/** Protected application frame: sidebar, top bar, and the page content area. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionGate>
      <div className="flex min-h-dvh">
        <Sidebar />
        <MobileNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main" className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-6 pb-10 sm:px-7">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </SessionGate>
  );
}

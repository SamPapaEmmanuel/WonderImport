'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { BrandMark } from './brand';
import { SidebarNav } from './sidebar';

/** Slide-in navigation for screens narrower than the desktop sidebar breakpoint. */
export function MobileNav() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNav);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button type="button" className="absolute inset-0 bg-harbour/50" aria-label="Close navigation" onClick={() => setOpen(false)} />
      <div className="absolute inset-y-0 left-0 flex w-[260px] flex-col gap-6 bg-harbour px-3.5 pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-5 text-side-text">
        <div className="flex items-center justify-between px-2">
          <span className="flex items-center gap-2.5 text-base font-semibold text-white">
            <BrandMark />
            WonderImport
          </span>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-harbour-2" aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}

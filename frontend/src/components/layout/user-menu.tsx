'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { RoleBadge } from '@/components/ui/badge';
import { initials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/roles';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSessionStore } from '@/stores/session-store';

export function UserMenu() {
  const me = useSessionStore((s) => s.me);
  const clear = useSessionStore((s) => s.clear);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me) return null;

  async function signOut() {
    setSigningOut(true);
    await supabaseBrowser().auth.signOut();
    clear();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-control py-1 pr-1 pl-2 text-[13px] hover:bg-mist"
      >
        <span className="hidden sm:inline">{me.name}</span>
        <span className="grid size-8 place-items-center rounded-full bg-glacier text-xs font-semibold text-fjord-strong">{initials(me.name)}</span>
      </button>

      {open && (
        <div role="menu" className="absolute top-full right-0 z-30 mt-1.5 w-64 rounded-panel border border-line bg-surface py-1.5">
          <div className="border-b border-line-soft px-3.5 pt-1.5 pb-3">
            <p className="font-medium">{me.name}</p>
            <p className="truncate text-[12.5px] text-ink-3">{me.email}</p>
            <div className="mt-2">
              <RoleBadge>{ROLE_LABEL[me.role]}</RoleBadge>
            </div>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              router.push('/settings');
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-mist"
          >
            <Settings className="size-4 text-ink-3" aria-hidden /> Settings
          </button>
          <button role="menuitem" type="button" onClick={signOut} disabled={signingOut} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-mist">
            <LogOut className="size-4 text-ink-3" aria-hidden /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

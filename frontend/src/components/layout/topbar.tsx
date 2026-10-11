'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { usePricingSettings } from '@/features/settings/use-pricing-settings';
import { useUiStore } from '@/stores/ui-store';
import { UserMenu } from './user-menu';

export function Topbar() {
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const { data: pricing } = usePricingSettings();

  // "/" focuses search from anywhere outside a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/goods?q=${encodeURIComponent(term)}` : '/goods');
  }

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-line bg-surface px-4 sm:gap-4 sm:px-7">
      <button type="button" onClick={() => setMobileNav(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-mist lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>

      <form onSubmit={submit} role="search" className="flex min-w-0 max-w-[460px] flex-1">
        <label className="flex w-full items-center gap-2 rounded-control border border-line bg-mist px-3 py-[7px] text-ink-3 focus-within:border-tide focus-within:ring-2 focus-within:ring-tide/30">
          <Search className="size-4 flex-none" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tracking number, item or client"
            aria-label="Search goods"
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="hidden rounded border border-line px-1.5 text-[11px] sm:inline">/</kbd>
        </label>
      </form>

      {pricing && (
        <span className="ml-auto hidden rounded-full border border-line px-3 py-1 text-[13px] whitespace-nowrap text-ink-2 md:inline" title="Default exchange rate for new goods">
          1 CNY = <b className="font-semibold text-ink">GHS {pricing.defaultExchangeRate}</b>
        </span>
      )}
      <div className={pricing ? '' : 'ml-auto'}>
        <UserMenu />
      </div>
    </header>
  );
}

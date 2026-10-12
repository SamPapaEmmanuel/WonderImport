'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui-store';
import { BrandMark } from './brand';
import { NAV_ITEMS } from './nav-items';

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[13.5px] font-medium transition-colors',
              'text-side-text hover:bg-harbour-2 hover:text-white',
              active && 'bg-harbour-2 text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon className="size-[17px] flex-none" aria-hidden />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh flex-col gap-6 bg-harbour px-3.5 py-5 text-side-text lg:flex',
        collapsed ? 'w-[68px]' : 'w-[232px]',
      )}
    >
      <Link href="/dashboard" className={cn('flex items-center gap-2.5 px-2 text-base font-semibold tracking-tight text-white', collapsed && 'justify-center px-0')}>
        <BrandMark />
        <span className={cn(collapsed && 'sr-only')}>WonderImport</span>
      </Link>

      <SidebarNav collapsed={collapsed} />

      <div className="mt-auto flex flex-col gap-3 border-t border-harbour-2 pt-3">
        {!collapsed && (
          <p className="px-2 text-xs leading-relaxed">
            Base currency: Ghana cedi
            <br />
            Price rule: cost × rate × 3
          </p>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-harbour-2 hover:text-white', collapsed && 'justify-center')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}

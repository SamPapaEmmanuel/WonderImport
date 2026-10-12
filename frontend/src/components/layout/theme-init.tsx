'use client';

import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';
import { useUiStore } from '@/stores/ui-store';

/**
 * Applies the stored theme to <html> on mount and whenever it changes.
 * The pre-hydration inline script in layout.tsx already set the initial
 * attribute; this keeps it in sync (including OS changes in system mode).
 */
export function ThemeInit() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return null;
}

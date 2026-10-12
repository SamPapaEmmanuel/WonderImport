'use client';

export type Theme = 'system' | 'light' | 'dark';

export const THEME_ORDER: Theme[] = ['system', 'light', 'dark'];

export const THEME_LABEL: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export const THEME_DESCRIPTION: Record<Theme, string> = {
  system: 'Follow your device setting automatically.',
  light: 'Always use the light theme.',
  dark: 'Always use the dark theme.',
};

const STORAGE_KEY = 'wonderimport-ui';

/** Reads the stored theme without touching the zustand store (safe to run pre-hydration). */
export function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'system';
    const parsed = JSON.parse(raw) as { state?: { theme?: unknown } };
    const t = parsed?.state?.theme;
    return t === 'light' || t === 'dark' || t === 'system' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Applies the theme to <html>: explicit data-theme for light/dark, attribute removed for system. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Resolves the effective scheme for "system" mode. */
export function systemIsDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function nextTheme(current: Theme): Theme {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
}

'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { THEME_LABEL, nextTheme } from '@/lib/theme';
import { useUiStore } from '@/stores/ui-store';

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;

/** Cycles System → Light → Dark. Lives in the top bar so it is reachable everywhere. */
export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const cycleTheme = useUiStore((s) => s.cycleTheme);
  const Icon = THEME_ICON[theme];
  const upcoming = nextTheme(theme);

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`Appearance: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[upcoming]}.`}
      title={`Appearance: ${THEME_LABEL[theme]} — switch to ${THEME_LABEL[upcoming]}`}
      className="rounded-md p-2 text-ink-2 hover:bg-mist"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

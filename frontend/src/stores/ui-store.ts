'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nextTheme, type Theme } from '@/lib/theme';

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

/** Local UI preferences. Sidebar and theme preferences are persisted. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      theme: 'system',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      setTheme: (theme) => set({ theme }),
      cycleTheme: () => set((s) => ({ theme: nextTheme(s.theme) })),
    }),
    {
      name: 'wonderimport-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, theme: s.theme }),
    },
  ),
);


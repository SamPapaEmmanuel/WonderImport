'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GoodsSessionState {
  /** The last Goods query string, restored when Goods is opened without one. */
  lastQuery: string;
  setLastQuery: (q: string) => void;
}

/** Remembers the Goods filters for the browser session (cleared when the tab closes). */
export const useGoodsSession = create<GoodsSessionState>()(
  persist(
    (set) => ({
      lastQuery: '',
      setLastQuery: (lastQuery) => set({ lastQuery }),
    }),
    { name: 'wonderimport-goods', storage: createJSONStorage(() => sessionStorage) },
  ),
);

'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { ApiError } from '@/lib/api-error';
import type { PricingSettings } from '@/lib/types';
import { getPricingSettings } from './api';

interface PricingState {
  data: PricingSettings | null;
  error: ApiError | null;
  loading: boolean;
  load: (force?: boolean) => Promise<void>;
  set: (data: PricingSettings) => void;
}

const usePricingStore = create<PricingState>()((set, get) => ({
  data: null,
  error: null,
  loading: false,
  load: async (force = false) => {
    if (get().loading || (get().data && !force)) return;
    set({ loading: true, error: null });
    try {
      set({ data: await getPricingSettings(), loading: false });
    } catch (e) {
      set({ error: ApiError.from(e), loading: false });
    }
  },
  set: (data) => set({ data }),
}));

/** Company pricing defaults, loaded once and shared by the top bar and Settings. */
export function usePricingSettings() {
  const state = usePricingStore();
  useEffect(() => {
    void state.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

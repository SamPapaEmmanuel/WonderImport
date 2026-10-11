'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/axios-instance';
import { ApiError } from '@/lib/api-error';
import type { Envelope, Lookups } from '@/lib/types';

interface LookupsState {
  data: Lookups | null;
  error: ApiError | null;
  loading: boolean;
  load: (force?: boolean) => Promise<void>;
}

const useLookupsStore = create<LookupsState>()((set, get) => ({
  data: null,
  error: null,
  loading: false,
  load: async (force = false) => {
    if (get().loading || (get().data && !force)) return;
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Envelope<Lookups>>('/lookups');
      set({ data: data.data, loading: false });
    } catch (e) {
      set({ error: ApiError.from(e), loading: false });
    }
  },
}));

/** Active clients, suppliers and categories for dropdowns. Cached for the session. */
export function useLookups() {
  const state = useLookupsStore();
  useEffect(() => {
    void state.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

/** Call after creating, renaming or archiving a client, supplier or category. */
export const refreshLookups = () => useLookupsStore.getState().load(true);

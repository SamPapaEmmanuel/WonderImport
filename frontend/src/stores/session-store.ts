'use client';

import { create } from 'zustand';
import { api } from '@/lib/axios-instance';
import { ApiError } from '@/lib/api-error';
import type { Envelope, Me } from '@/lib/types';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface SessionState {
  me: Me | null;
  status: Status;
  error: ApiError | null;
  load: () => Promise<void>;
  clear: () => void;
}

/** The signed-in WonderImport user (from GET /auth/me), shared by the shell and screens. */
export const useSessionStore = create<SessionState>()((set, get) => ({
  me: null,
  status: 'idle',
  error: null,
  load: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const { data } = await api.get<Envelope<Me>>('/auth/me');
      set({ me: data.data, status: 'ready' });
    } catch (e) {
      set({ me: null, status: 'error', error: ApiError.from(e) });
    }
  },
  clear: () => set({ me: null, status: 'idle', error: null }),
}));

'use client';

import type { ReactNode } from 'react';
import { can } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';

/** Renders its children only for administrators (the API enforces the same rule). */
export function AdminOnly({ children }: { children: ReactNode }) {
  const role = useSessionStore((s) => s.me?.role);
  return can.manageSettings(role) ? <>{children}</> : null;
}

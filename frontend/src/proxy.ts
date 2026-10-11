import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session-proxy';

// Next.js 16 "proxy" (formerly middleware): keeps the Supabase session fresh and guards app routes.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};

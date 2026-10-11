'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '../env';

let client: SupabaseClient | undefined;

/** One Supabase client per browser tab; sessions are kept in cookies so the proxy can read them. */
export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseKey);
  return client;
}

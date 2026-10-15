'use client';

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './api-error';
import { publicEnv } from './env';
import { supabaseBrowser } from './supabase/client';

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * The one HTTP client for the NestJS API.
 * - attaches the current Supabase access token (cached in memory, refreshed on expiry/401)
 * - on 401, refreshes the session once and retries
 * - rejects with ApiError so screens can show code-specific messages
 */
export const api = axios.create({
  baseURL: publicEnv.apiUrl,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
});

// In-memory token: avoids an async storage read on every request.
let cachedToken: string | null = null;
let cachedExpiry = 0; // epoch seconds; refresh 60s early
let sessionPromise: Promise<string | null> | null = null;

function getCachedToken(): string | null {
  if (cachedToken && Date.now() / 1000 < cachedExpiry - 60) return cachedToken;
  return null;
}

function rememberToken(token: string | null, expiresAt?: number) {
  cachedToken = token;
  cachedExpiry = expiresAt ?? (token ? Date.now() / 1000 + 3600 : 0);
}

/** Single-flight session read shared by concurrent requests. */
function readSessionToken(): Promise<string | null> {
  sessionPromise ??= supabaseBrowser()
    .auth.getSession()
    .then(({ data }) => {
      const s = data.session;
      rememberToken(s?.access_token ?? null, s?.expires_at);
      return s?.access_token ?? null;
    })
    .catch(() => {
      rememberToken(null, 0);
      return null;
    })
    .finally(() => {
      sessionPromise = null;
    });
  return sessionPromise;
}

api.interceptors.request.use(async (config) => {
  let token = getCachedToken();
  if (!token) token = await readSessionToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  refreshing ??= supabaseBrowser()
    .auth.refreshSession()
    .then(({ data }) => {
      rememberToken(data.session?.access_token ?? null, data.session?.expires_at);
      return data.session?.access_token ?? null;
    })
    .catch(() => {
      rememberToken(null, 0);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // File downloads use responseType 'blob', so a JSON error body arrives as a Blob. Decode it first.
    const blob = error.response?.data;
    if (typeof Blob !== 'undefined' && blob instanceof Blob && blob.type.includes('json')) {
      try {
        error.response!.data = JSON.parse(await blob.text());
      } catch {
        // leave as is; ApiError.from falls back to a generic message
      }
    }

    const original = error.config as RetryableConfig | undefined;
    const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      const token = await refreshToken();
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return api(original);
      }
    }

    if (error.response?.status === 401 && code === 'UNAUTHENTICATED' && typeof window !== 'undefined') {
      try {
        await supabaseBrowser().auth.signOut();
      } catch {
        // Ignore errors if the session was already purged or revoked
      }
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?expired=1&next=${next}`);
    }

    throw ApiError.from(error);
  },
);

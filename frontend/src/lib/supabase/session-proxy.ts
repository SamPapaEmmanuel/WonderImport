import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '../env';

const PUBLIC_PATHS = ['/login', '/auth/confirm', '/auth/set-password'];

/**
 * Refreshes the Supabase session cookie and protects app routes.
 * Uses getSession() (cookie read, no network) for speed — the API still
 * verifies every token with JWKS, so an expired token fails safely there
 * and SessionGate redirects to /login.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // Public pages never need a session check.
  if (isPublic) {
    // Still allow /login to bounce signed-in users without a network call.
    if (path === '/login') {
      // If arriving with expired=1, don't attempt to get/refresh the session;
      // purge the stale auth cookie so the browser stops sending dead tokens.
      if (request.nextUrl.searchParams.get('expired') === '1') {
        request.cookies.getAll().forEach((c) => {
          if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
            response.cookies.delete(c.name);
          }
        });
        return response;
      }

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (!error && session) {
          const url = request.nextUrl.clone();
          url.pathname = '/dashboard';
          url.search = '';
          return NextResponse.redirect(url);
        }
        if (error) {
          request.cookies.getAll().forEach((c) => {
            if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
              response.cookies.delete(c.name);
            }
          });
        }
      } catch {
        // Stale or revoked token: clear auth cookies so the page renders cleanly.
        request.cookies.getAll().forEach((c) => {
          if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
            response.cookies.delete(c.name);
          }
        });
      }
    }
    return response;
  }

  // Fast path: no auth cookies at all → definitely signed out.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
  if (!hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = path === '/' ? '' : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  // Cookie exists: trust it here (no network). The API + SessionGate verify.
  return response;
}

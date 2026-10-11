import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Landing point for Supabase email links (invite, password recovery).
 * Supports both the token-hash template and the PKCE `code` redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const supabase = await supabaseServer();

  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  if (!ok) return NextResponse.redirect(`${origin}/login?expired=1`);
  const needsPassword = type === 'invite' || type === 'recovery' || !type;
  return NextResponse.redirect(`${origin}${needsPassword ? '/auth/set-password' : '/dashboard'}`);
}

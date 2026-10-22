'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { PasswordInput } from '@/components/ui/password-input';
import { supabaseBrowser } from '@/lib/supabase/client';

/** Only allow redirects to paths inside this app. */
function safeNext(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function LoginForm({ next, expired }: { next?: string; expired?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const supabase = supabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setSubmitting(false);
      setError(
        authError.message === 'Invalid login credentials'
          ? 'That email and password do not match. Check both and try again, or use “Forgot your password?” below to set a new one.'
          : authError.message,
      );
      return;
    }
    // Ensure the session was persisted to cookies before leaving /login.
    // A client-side router.replace can fire before the cookie write lands and
    // the proxy then bounces the first /dashboard request back to /login.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSubmitting(false);
      setError('Sign-in succeeded but the session was not saved. Enable cookies for this site and try again.');
      return;
    }
    window.location.assign(safeNext(next));
  }

  async function sendResetLink() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Enter your email above first, then choose “Forgot your password?”.');
      return;
    }
    setResetting(true);
    const { error: resetError } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    setResetting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setInfo('Password reset email sent. Open the link in that email, set a new password, then sign in again.');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {expired && <Notice tone="warning" title="Your session ended. Sign in again to continue." />}
      {error && <Notice tone="error" title={error} />}
      {info && <Notice tone="success" title={info} />}
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Field label="Password">
        <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" loading={submitting} className="mt-1 w-full">
        Sign in
      </Button>
      <div className="flex items-center justify-between text-[12.5px]">
        <button
          type="button"
          onClick={sendResetLink}
          disabled={resetting}
          className="font-medium text-fjord underline-offset-2 hover:underline disabled:opacity-55"
        >
          {resetting ? 'Sending reset email…' : 'Forgot your password?'}
        </button>
        <Link href="/auth/set-password" className="text-ink-3 underline-offset-2 hover:underline">
          Opened an invite link?
        </Link>
      </div>
      <p className="text-[12.5px] text-ink-3">New to WonderImport? Use the invitation link sent to your email to set a password.</p>
    </form>
  );
}

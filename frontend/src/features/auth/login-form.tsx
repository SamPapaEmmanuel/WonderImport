'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { supabaseBrowser } from '@/lib/supabase/client';

/** Only allow redirects to paths inside this app. */
function safeNext(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function LoginForm({ next, expired }: { next?: string; expired?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const { error: authError } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setSubmitting(false);
      setError(
        authError.message === 'Invalid login credentials'
          ? 'That email and password do not match. Check both and try again.'
          : authError.message,
      );
      return;
    }
    router.replace(safeNext(next));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {expired && <Notice tone="warning" title="Your session ended. Sign in again to continue." />}
      {error && <Notice tone="error" title={error} />}
      <Field label="Email">
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Field label="Password">
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" loading={submitting} className="mt-1 w-full">
        Sign in
      </Button>
      <p className="text-[12.5px] text-ink-3">New to WonderImport? Use the invitation link sent to your email to set a password.</p>
    </form>
  );
}

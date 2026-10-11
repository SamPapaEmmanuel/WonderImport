'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { supabaseBrowser } from '@/lib/supabase/client';

const MIN_LENGTH = 10;

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < MIN_LENGTH) next.password = `Use at least ${MIN_LENGTH} characters.`;
    if (confirm !== password) next.confirm = 'The two passwords do not match.';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      setFormError(
        error.message.includes('session')
          ? 'This link has expired. Ask an administrator to send a new invitation.'
          : error.message,
      );
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError && <Notice tone="error" title={formError} />}
      <Field label="New password" error={errors.password} hint={`At least ${MIN_LENGTH} characters.`}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </Field>
      <Field label="Confirm password" error={errors.confirm}>
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" loading={submitting} className="mt-1 w-full">
        Save password and continue
      </Button>
    </form>
  );
}

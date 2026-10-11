import type { Metadata } from 'next';
import { SetPasswordForm } from '@/features/auth/set-password-form';

export const metadata: Metadata = { title: 'Set your password' };

export default function SetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.015em]">Set your password</h1>
      <p className="mt-1 mb-7 text-ink-2">You will use it with your email to sign in.</p>
      <SetPasswordForm />
    </>
  );
}

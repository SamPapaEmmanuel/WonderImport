import type { Metadata } from 'next';
import { BrandMark } from '@/components/layout/brand';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  return (
    <>
      <BrandMark className="lg:hidden" />
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.015em] lg:mt-0">Sign in</h1>
      <p className="mt-1 mb-7 text-ink-2">Use the email your administrator invited.</p>
      <LoginForm next={next} expired={expired === '1'} />
    </>
  );
}

import type { Metadata } from 'next';
import { ImportsScreen } from '@/features/imports/imports-screen';

export const metadata: Metadata = { title: 'Imports' };

export default function ImportsPage() {
  return <ImportsScreen />;
}

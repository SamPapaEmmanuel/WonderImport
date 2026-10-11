import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClientsScreen } from '@/features/clients/clients-screen';

export const metadata: Metadata = { title: 'Clients' };

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsScreen />
    </Suspense>
  );
}

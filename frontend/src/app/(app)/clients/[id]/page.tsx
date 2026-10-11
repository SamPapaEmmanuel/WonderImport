import type { Metadata } from 'next';
import { ClientDetailScreen } from '@/features/clients/client-detail-screen';

export const metadata: Metadata = { title: 'Client' };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetailScreen id={id} />;
}

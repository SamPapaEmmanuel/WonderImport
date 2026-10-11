import type { Metadata } from 'next';
import { ImportReviewScreen } from '@/features/imports/import-review-screen';

export const metadata: Metadata = { title: 'Review import' };

export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ImportReviewScreen id={id} />;
}

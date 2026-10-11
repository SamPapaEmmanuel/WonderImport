import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GoodsScreen } from '@/features/goods/goods-screen';

export const metadata: Metadata = { title: 'Goods' };

export default function GoodsPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <GoodsScreen />
    </Suspense>
  );
}

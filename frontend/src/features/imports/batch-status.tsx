import { DotBadge } from '@/components/ui/badge';
import type { ImportBatchStatus } from '@/lib/types';

const META: Record<ImportBatchStatus, { label: string; color: string }> = {
  VALIDATING: { label: 'Checking', color: 'var(--st-ordered)' },
  READY: { label: 'Waiting for review', color: 'var(--tide)' },
  COMMITTED: { label: 'Imported', color: 'var(--mint)' },
  FAILED: { label: 'Failed', color: 'var(--rose)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--st-ordered)' },
};

export function BatchStatusBadge({ status }: { status: ImportBatchStatus }) {
  return <DotBadge color={META[status].color}>{META[status].label}</DotBadge>;
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { count, dateTime } from '@/lib/format';
import type { ImportBatch } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { Notice } from '@/components/ui/notice';
import { can } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';
import { importsApi } from './api';
import { BatchStatusBadge } from './batch-status';
import { UploadPanel } from './upload-panel';

export function ImportsScreen() {
  const router = useRouter();
  const allowed = can.importExport(useSessionStore((s) => s.me?.role));
  const [page, setPage] = useState(1);
  const history = useRequest(() => (allowed ? importsApi.list(page) : Promise.resolve(null)), [page, allowed]);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Imports" description="Bring goods in from a spreadsheet." />
        <Notice title="Only staff and administrators can import goods">Ask an administrator if you need to add goods from a spreadsheet.</Notice>
      </>
    );
  }

  const columns: Column<ImportBatch>[] = [
    { key: 'file', header: 'File', cell: (b) => <span className="font-medium">{b.fileName}</span> },
    { key: 'status', header: 'Status', cell: (b) => <BatchStatusBadge status={b.status} /> },
    {
      key: 'rows',
      header: 'Rows',
      cell: (b) =>
        b.status === 'COMMITTED' ? (
          <span className="text-ink-2">
            <b className="font-medium text-ink">{count(b.committedRows)}</b> imported
            {b.skippedRows ? `, ${count(b.skippedRows)} skipped` : ''}
            {b.invalidRows ? `, ${count(b.invalidRows)} not imported` : ''}
          </span>
        ) : (
          <span className="text-ink-2">
            {count(b.validRows + b.warningRows)} ready, {count(b.invalidRows)} need fixing
          </span>
        ),
    },
    { key: 'by', header: 'By', cell: (b) => <span className="text-ink-2">{b.importedBy.name}</span> },
    { key: 'when', header: 'Uploaded', cell: (b) => <span className="text-ink-2">{dateTime(b.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Imports" description="Bring goods in from a spreadsheet. You review every row before anything is saved." />
      <UploadPanel />
      <Panel>
        <PanelHeader title="Recent imports" />
        {history.error ? (
          <ErrorState error={history.error} onRetry={history.reload} />
        ) : (
          <DataTable
            caption="Recent imports"
            columns={columns}
            rows={history.data?.data ?? []}
            rowKey={(b) => b.id}
            loading={history.loading}
            skeletonRows={3}
            onRowClick={(b) => router.push(`/imports/${b.id}`)}
            empty={<EmptyState title="No imports yet">Upload a file above to start.</EmptyState>}
          />
        )}
        {history.data && history.data.meta.total > 10 && (
          <Pagination page={page} pageSize={10} total={history.data.meta.total} onPage={setPage} noun={['import', 'imports']} />
        )}
      </Panel>
    </>
  );
}

'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-error';
import { downloadFromApi } from '@/lib/download';
import { toast } from '@/stores/toast-store';

/** Downloads an Excel export for the given API path and confirms with a toast. */
export function ExportButton({ path, fallbackName, label = 'Export', size = 'md', variant = 'secondary' }: { path: string; fallbackName: string; label?: string; size?: 'sm' | 'md'; variant?: 'secondary' | 'ghost' | 'primary' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const name = await downloadFromApi(path, fallbackName);
          toast.success('Export ready', name);
        } catch (e) {
          toast.error('Export failed', ApiError.from(e).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {!busy && <Download className="size-4" aria-hidden />}
      {label}
    </Button>
  );
}

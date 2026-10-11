'use client';

import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  confirmDisabled?: boolean;
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
  children?: ReactNode;
  /** Extra action, e.g. "Check in and move". */
  secondary?: { label: string; onSelect: () => Promise<unknown> | void };
}

export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'primary', confirmDisabled, onConfirm, onClose, children, secondary }: ConfirmDialogProps) {
  const [busy, setBusy] = useState<'primary' | 'secondary' | null>(null);

  async function run(which: 'primary' | 'secondary', fn: () => Promise<unknown> | void) {
    setBusy(which);
    try {
      await fn();
      onClose();
    } catch {
      // The action reported its own error; keep the dialog open so the user can retry or cancel.
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={onClose} disabled={!!busy}>
            Cancel
          </Button>
          {secondary && (
            <Button onClick={() => run('secondary', secondary.onSelect)} loading={busy === 'secondary'} disabled={!!busy}>
              {secondary.label}
            </Button>
          )}
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => run('primary', onConfirm)} loading={busy === 'primary'} disabled={!!busy || confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

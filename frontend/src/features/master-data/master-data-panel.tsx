'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { ApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { count } from '@/lib/format';
import { can } from '@/lib/roles';
import type { Category, Supplier } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { refreshLookups } from '@/features/lookups/use-lookups';
import { useSessionStore } from '@/stores/session-store';
import { toast } from '@/stores/toast-store';
import { masterApi, type MasterKind } from './api';

type Row = Supplier | Category;

const FIELDS: Record<MasterKind, { key: string; label: string; hint?: string; type?: string }[]> = {
  suppliers: [
    { key: 'name', label: 'Name' },
    { key: 'contactPerson', label: 'Contact person' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'country', label: 'Country' },
    { key: 'notes', label: 'Notes' },
  ],
  categories: [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description', hint: 'What goes in this category.' },
  ],
};

const SINGULAR: Record<MasterKind, string> = { suppliers: 'supplier', categories: 'category' };

function MasterForm({ kind, row, onClose, onSaved }: { kind: MasterKind; row: Row | null | 'new'; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const src = row === 'new' ? {} : (row as unknown as Record<string, unknown>);
    setValues(Object.fromEntries(FIELDS[kind].map((f) => [f.key, String(src[f.key] ?? (f.key === 'country' ? 'China' : ''))])));
    setErrors({});
  }, [row, kind]);

  if (!row) return null;
  const isNew = row === 'new';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!values.name?.trim()) return setErrors({ name: 'Enter a name.' });
    const body: Record<string, unknown> = {};
    for (const f of FIELDS[kind]) {
      const v = values[f.key]?.trim() ?? '';
      const before = isNew ? undefined : String((row as unknown as Record<string, unknown>)[f.key] ?? '');
      if (isNew ? v : v !== before) body[f.key] = f.key === 'name' || f.key === 'country' ? v : v || null;
    }
    if (!isNew && Object.keys(body).length === 0) return onClose();
    setSaving(true);
    try {
      if (isNew) await masterApi.create(kind, body);
      else await masterApi.update(kind, (row as Row).id, body);
      void refreshLookups();
      toast.success(isNew ? `${SINGULAR[kind][0].toUpperCase()}${SINGULAR[kind].slice(1)} added` : 'Changes saved');
      onSaved();
    } catch (err) {
      const apiErr = ApiError.from(err);
      setErrors(apiErr.fields.length ? Object.fromEntries(apiErr.fields.map((f) => [f.field, f.message])) : { form: apiErr.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !saving && onClose()}
      title={isNew ? `Add ${SINGULAR[kind]}` : `Edit ${SINGULAR[kind]}`}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="master-form" loading={saving}>
            {isNew ? `Add ${SINGULAR[kind]}` : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="master-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form && <Notice tone="error" title="Not saved">{errors.form}</Notice>}
        {errors.name === 'Already in use' && <Notice tone="error" title={`A ${SINGULAR[kind]} with this name already exists`} />}
        {FIELDS[kind].map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key] === 'Already in use' ? undefined : errors[f.key]}>
            <Input type={f.type ?? 'text'} value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} autoFocus={f.key === 'name'} />
          </Field>
        ))}
      </form>
    </Dialog>
  );
}

/** Suppliers and categories used to classify goods. Administrators manage them; everyone can see them. */
export function MasterDataPanel() {
  const editable = can.manageMasterData(useSessionStore((s) => s.me?.role));
  const [kind, setKind] = useState<MasterKind>('suppliers');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const list = useRequest<Row[]>(() => masterApi.list(kind, showArchived ? 'include' : 'exclude'), [kind, showArchived]);

  async function toggleArchive(r: Row) {
    try {
      if (r.archivedAt) await masterApi.restore(kind, r.id);
      else await masterApi.archive(kind, r.id);
      void refreshLookups();
      void list.reload();
      toast.success(r.archivedAt ? `${r.name} restored` : `${r.name} archived`, r.archivedAt ? undefined : 'Existing goods keep it; it can’t be chosen for new goods.');
    } catch (e) {
      toast.error('Not changed', ApiError.from(e).message);
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (r) => (
        <span className={cn('font-medium', r.archivedAt && 'text-ink-3')}>
          {r.name}
          {r.archivedAt && <span className="ml-2 text-xs font-normal">Archived</span>}
        </span>
      ),
    },
    kind === 'suppliers'
      ? { key: 'contact', header: 'Contact', cell: (r) => <span className="text-ink-2">{[(r as Supplier).contactPerson, (r as Supplier).phone].filter(Boolean).join(', ') || '—'}</span> }
      : { key: 'desc', header: 'Description', cell: (r) => <span className="text-ink-2">{(r as Category).description ?? '—'}</span> },
    { key: 'goods', header: 'Goods', align: 'right', cell: (r) => count(r.goodsCount) },
    ...(editable
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (r: Row) => (
              <span className="inline-flex gap-1">
                {!r.archivedAt && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => void toggleArchive(r)}>
                  {r.archivedAt ? 'Restore' : 'Archive'}
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <Panel>
      <PanelHeader
        title="Suppliers and categories"
        description={editable ? 'Used to classify goods. Archiving keeps existing goods intact.' : 'Only administrators can change these.'}
        actions={
          editable && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="size-4" aria-hidden /> Add {SINGULAR[kind]}
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-[18px] py-2.5">
        <div className="inline-flex rounded-control border border-line p-0.5" role="group" aria-label="Show">
          {(['suppliers', 'categories'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn('rounded-md px-3 py-1 text-[13px] font-medium', kind === k ? 'bg-glacier text-fjord-strong' : 'text-ink-2 hover:text-ink')}
            >
              {k === 'suppliers' ? 'Suppliers' : 'Categories'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-[var(--fjord)]" />
          Show archived
        </label>
      </div>
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <DataTable
          caption={kind}
          columns={columns}
          rows={list.data ?? []}
          rowKey={(r) => r.id}
          loading={list.loading}
          skeletonRows={4}
          empty={<EmptyState title={`No ${kind} yet`} action={editable && <Button size="sm" onClick={() => setEditing('new')}>Add {SINGULAR[kind]}</Button>} />}
        />
      )}
      <MasterForm
        kind={kind}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void list.reload();
        }}
      />
    </Panel>
  );
}

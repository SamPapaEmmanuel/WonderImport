'use client';

import { useState, type FormEvent } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { DotBadge, RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { ErrorState } from '@/components/ui/states';
import { ApiError } from '@/lib/api-error';
import { ROLE_LABEL } from '@/lib/roles';
import type { Role } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { useSessionStore } from '@/stores/session-store';
import { toast } from '@/stores/toast-store';
import { describeInvite, usersApi, type Person } from './api';

const ROLES: Role[] = ['ADMIN', 'STAFF', 'VIEWER'];
const ROLE_HINT: Record<Role, string> = {
  ADMIN: 'Everything, including people, pricing defaults and corrections',
  STAFF: 'Records goods and clients, imports and exports',
  VIEWER: 'Read-only',
};

function notify(result: ReturnType<typeof describeInvite>) {
  if (result) toast[result.tone](result.title, result.description);
}

function AddPersonDialog({ open, invitesEnabled, onClose, onAdded }: { open: boolean; invitesEnabled: boolean; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'STAFF' as Role, sendInvite: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Enter their name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter the email they will sign in with.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const res = await usersApi.create({ ...form, name: form.name.trim(), email: form.email.trim(), sendInvite: invitesEnabled && form.sendInvite });
      toast.success(`${res.user.name} added as ${ROLE_LABEL[res.user.role].toLowerCase()}`);
      notify(describeInvite(res.invite ?? (invitesEnabled ? null : 'not_configured'), res.user.email));
      setForm({ name: '', email: '', role: 'STAFF', sendInvite: true });
      onAdded();
    } catch (err) {
      const apiErr = ApiError.from(err);
      setErrors(apiErr.fields.length ? Object.fromEntries(apiErr.fields.map((f) => [f.field, f.message])) : { form: apiErr.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title="Add a person"
      description="They can sign in once they have a WonderImport account and a password."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="person-form" loading={busy}>
            Add person
          </Button>
        </>
      }
    >
      <form id="person-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form && <Notice tone="error" title="Not added">{errors.form}</Notice>}
        <Field label="Name" error={errors.name}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus maxLength={120} />
        </Field>
        <Field label="Email" error={errors.email} hint="The address they sign in with.">
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" />
        </Field>
        <Field label="Role" hint={ROLE_HINT[form.role]}>
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        {invitesEnabled ? (
          <label className="flex items-center gap-2.5 text-[13px]">
            <input type="checkbox" checked={form.sendInvite} onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))} className="size-4 accent-[var(--fjord)]" />
            Email them an invitation to set a password
          </label>
        ) : (
          <Notice>After adding them here, invite the same email from Supabase (Authentication &gt; Users &gt; Invite user). Their account links on first sign-in.</Notice>
        )}
      </form>
    </Dialog>
  );
}

/** People who can use WonderImport, their roles, and access. Administrators only. */
export function PeoplePanel() {
  const me = useSessionStore((s) => s.me);
  const list = useRequest(() => usersApi.list(), []);
  const [adding, setAdding] = useState(false);

  async function change(p: Person, body: { role?: Role; active?: boolean }, done: string) {
    try {
      await usersApi.update(p.id, body);
      toast.success(done);
      void list.reload();
    } catch (e) {
      toast.error('Not changed', ApiError.from(e).message);
    }
  }

  const columns: Column<Person>[] = [
    {
      key: 'name',
      header: 'Person',
      cell: (p) => (
        <div className="min-w-0">
          <p className="font-medium">
            {p.name}
            {p.id === me?.id && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
          </p>
          <p className="truncate text-xs text-ink-3">{p.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (p) => <RoleBadge>{ROLE_LABEL[p.role]}</RoleBadge> },
    {
      key: 'access',
      header: 'Access',
      cell: (p) =>
        !p.active ? <DotBadge color="var(--st-ordered)">Deactivated</DotBadge> : p.linked ? <DotBadge color="var(--mint)">Active</DotBadge> : <DotBadge color="var(--tide)">Not signed in yet</DotBadge>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10 pr-2',
      cell: (p) => {
        const items: (MenuItem | 'separator')[] = ROLES.filter((r) => r !== p.role).map((r) => ({
          label: `Make ${ROLE_LABEL[r].toLowerCase()}`,
          hint: ROLE_HINT[r],
          onSelect: () => void change(p, { role: r }, `${p.name} is now ${ROLE_LABEL[r].toLowerCase()}`),
        }));
        if (p.active && !p.linked)
          items.push('separator', {
            label: 'Send invitation again',
            onSelect: async () => {
              try {
                notify(describeInvite(await usersApi.invite(p.id), p.email));
              } catch (e) {
                toast.error('Not sent', ApiError.from(e).message);
              }
            },
          });
        items.push(
          'separator',
          p.active
            ? { label: 'Deactivate', hint: 'Blocks sign-in immediately; history is kept', tone: 'danger', onSelect: () => void change(p, { active: false }, `${p.name} can no longer sign in`) }
            : { label: 'Reactivate', onSelect: () => void change(p, { active: true }, `${p.name} can sign in again`) },
        );
        return (
          <Menu
            items={items}
            trigger={(props) => (
              <button type="button" {...props} className="rounded-md p-1.5 text-ink-3 hover:bg-glacier hover:text-ink" aria-label={`Change access for ${p.name}`}>
                <MoreHorizontal className="size-4" />
              </button>
            )}
          />
        );
      },
    },
  ];

  return (
    <Panel>
      <PanelHeader
        title="People"
        description="Who can sign in, and what they can do."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add person
          </Button>
        }
      />
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <DataTable caption="People" columns={columns} rows={list.data?.users ?? []} rowKey={(p) => p.id} loading={list.loading} skeletonRows={3} rowClassName={(p) => (p.active ? undefined : 'text-ink-3')} />
      )}
      <AddPersonDialog
        open={adding}
        invitesEnabled={list.data?.invitesEnabled ?? false}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          void list.reload();
        }}
      />
    </Panel>
  );
}

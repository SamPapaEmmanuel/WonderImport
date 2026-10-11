'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-error';
import type { Client } from '@/lib/types';
import { refreshLookups } from '@/features/lookups/use-lookups';
import { toast } from '@/stores/toast-store';
import { clientsApi, type ClientInput } from './api';

type Mode = { mode: 'create' } | { mode: 'edit'; client: Client };
type FormState = { name: string; phone: string; email: string; address: string; notes: string };
const KEYS = ['name', 'phone', 'email', 'address', 'notes'] as const;

const toForm = (c?: Client): FormState => ({ name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '', address: c?.address ?? '', notes: c?.notes ?? '' });

export function ClientFormDialog({ state, onClose, onSaved }: { state: Mode | null; onClose: () => void; onSaved: (c: Client) => void }) {
  const [form, setForm] = useState<FormState>(toForm());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'form', string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state) {
      setForm(toForm(state.mode === 'edit' ? state.client : undefined));
      setErrors({});
    }
  }, [state]);

  if (!state) return null;
  const isEdit = state.mode === 'edit';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Enter the client’s name.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address, or leave it empty.';
    if (form.phone && !/^\+?[0-9 ()-]{6,20}$/.test(form.phone.trim())) next.phone = 'Enter a phone number, e.g. +233 24 123 4567.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const body: ClientInput = {};
    for (const k of KEYS) {
      const value = k === 'name' ? form.name.trim() : form[k].trim() || null;
      const before = isEdit ? ((state as { client: Client }).client[k] ?? (k === 'name' ? '' : null)) : undefined;
      if (!isEdit || value !== before) (body as Record<string, unknown>)[k] = value;
    }
    if (isEdit && Object.keys(body).length === 0) return onClose();

    setSaving(true);
    try {
      const saved = isEdit ? await clientsApi.update((state as { client: Client }).client.id, body) : await clientsApi.create(body);
      void refreshLookups();
      toast.success(isEdit ? 'Client updated' : `${saved.name} added as ${saved.code}`);
      onSaved(saved);
    } catch (err) {
      const apiErr = ApiError.from(err);
      const fieldErrors: typeof errors = {};
      apiErr.fields.forEach((f) => (fieldErrors[f.field as keyof FormState] = f.message));
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: apiErr.message });
    } finally {
      setSaving(false);
    }
  }

  const bind = (k: keyof FormState) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  return (
    <Dialog
      open
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Edit client' : 'Add client'}
      description={isEdit ? (state as { client: Client }).client.code : 'A client code is assigned automatically.'}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="client-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add client'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form && <Notice tone="error" title="Not saved">{errors.form}</Notice>}
        <Field label="Name" error={errors.name}>
          <Input {...bind('name')} maxLength={120} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" error={errors.phone}>
            <Input {...bind('phone')} type="tel" autoComplete="off" />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input {...bind('email')} type="email" autoComplete="off" />
          </Field>
        </div>
        <Field label="Address" error={errors.address}>
          <Input {...bind('address')} maxLength={300} />
        </Field>
        <Field label="Notes" error={errors.notes}>
          <Textarea {...bind('notes')} rows={3} maxLength={2000} />
        </Field>
      </form>
    </Dialog>
  );
}

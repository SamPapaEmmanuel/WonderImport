'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FileDrop } from '@/components/ui/file-drop';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/lib/api-error';
import { SHIPMENT_FLOW, STATUS_META } from '@/lib/status';
import type { ShipmentStatus } from '@/lib/types';
import { useLookups } from '@/features/lookups/use-lookups';
import { usePricingSettings } from '@/features/settings/use-pricing-settings';
import { importsApi, type UploadDefaults } from './api';

const MAX_BYTES = 5 * 1024 * 1024;

/** Step 1: choose a file and the defaults for empty cells. Nothing is saved until the review step. */
export function UploadPanel() {
  const router = useRouter();
  const { data: lookups } = useLookups();
  const { data: pricing } = usePricingSettings();
  const [file, setFile] = useState<File | null>(null);
  const [defaults, setDefaults] = useState<UploadDefaults>({ defaultClientId: '', defaultSupplierId: '', defaultCategoryId: '', defaultStatus: '', defaultExchangeRate: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof UploadDefaults | 'file' | 'form', string>>>({});
  const [busy, setBusy] = useState(false);

  // Goods with no named buyer default to the stock client, as in the original workbook.
  useEffect(() => {
    if (lookups && !defaults.defaultClientId) {
      const stock = lookups.clients.find((c) => c.isStock);
      if (stock) setDefaults((d) => ({ ...d, defaultClientId: stock.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups]);

  useEffect(() => {
    if (pricing && !defaults.defaultExchangeRate) setDefaults((d) => ({ ...d, defaultExchangeRate: pricing.defaultExchangeRate }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing]);

  const set = (k: keyof UploadDefaults, v: string) => setDefaults((d) => ({ ...d, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setErrors({ file: 'Choose a file first.' });
    if (defaults.defaultExchangeRate && !/^\d{1,6}(\.\d{1,6})?$/.test(defaults.defaultExchangeRate)) return setErrors({ defaultExchangeRate: 'Enter a rate such as 1.887.' });
    setErrors({});
    setBusy(true);
    try {
      const batch = await importsApi.upload(file, defaults);
      router.push(`/imports/${batch.id}`);
    } catch (err) {
      const apiErr = ApiError.from(err);
      const fields = Object.fromEntries(apiErr.fields.map((f) => [f.field, f.message]));
      setErrors(Object.keys(fields).length ? fields : { form: apiErr.message });
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Import goods from a spreadsheet"
        description="Use the template, or your existing workbook: columns such as Delivery ID, Product Description, Cost Per 1Unit and Person for are recognised."
        actions={
          <>
            <Button size="sm" onClick={() => void importsApi.template('xlsx')}>
              Download template
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void importsApi.template('csv')}>
              CSV
            </Button>
          </>
        }
      />
      <PanelBody>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {errors.form && <Notice tone="error" title="The file was not checked">{errors.form}</Notice>}
          <FileDrop file={file} onFile={(f) => { setFile(f); setErrors((x) => ({ ...x, file: undefined })); }} accept={['.xlsx', '.csv']} maxBytes={MAX_BYTES} error={errors.file} disabled={busy} />

          <fieldset>
            <legend className="text-[13px] font-semibold">Defaults for empty cells</legend>
            <p className="mt-0.5 mb-3 text-[12.5px] text-ink-3">Used only where the file leaves a cell empty or has no such column. Names in the file always win.</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Field label="Client" error={errors.defaultClientId}>
                <Select value={defaults.defaultClientId} onChange={(e) => set('defaultClientId', e.target.value)}>
                  <option value="">None, client required</option>
                  {lookups?.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Supplier" error={errors.defaultSupplierId}>
                <Select value={defaults.defaultSupplierId} onChange={(e) => set('defaultSupplierId', e.target.value)}>
                  <option value="">None, supplier required</option>
                  {lookups?.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category" error={errors.defaultCategoryId}>
                <Select value={defaults.defaultCategoryId} onChange={(e) => set('defaultCategoryId', e.target.value)}>
                  <option value="">None, category required</option>
                  {lookups?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" error={errors.defaultStatus}>
                <Select value={defaults.defaultStatus} onChange={(e) => set('defaultStatus', e.target.value as ShipmentStatus | '')}>
                  <option value="">Ordered</option>
                  {SHIPMENT_FLOW.slice(1).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Rate (GHS per ¥)" error={errors.defaultExchangeRate}>
                <Input inputMode="decimal" value={defaults.defaultExchangeRate} onChange={(e) => set('defaultExchangeRate', e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" loading={busy} disabled={!file}>
              {busy ? 'Checking every row…' : 'Check file'}
            </Button>
            <span className="text-[12.5px] text-ink-3">Nothing is saved yet. You review every row next.</span>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

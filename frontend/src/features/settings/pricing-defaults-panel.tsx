'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { ApiError } from '@/lib/api-error';
import { dateTime } from '@/lib/format';
import { can } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';
import { updateExchangeRate } from './api';
import { usePricingSettings } from './use-pricing-settings';

const RATE_PATTERN = /^\d{1,6}(\.\d{1,6})?$/;

function example(rate: string) {
  const r = Number(rate);
  if (!RATE_PATTERN.test(rate) || !(r > 0)) return null;
  // Display only; the API is the authority for stored prices.
  return (10 * r * 3).toFixed(2);
}

export function PricingDefaultsPanel() {
  const role = useSessionStore((s) => s.me?.role);
  const { data, error, loading, load, set } = usePricingSettings();
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const editable = can.manageSettings(role);

  useEffect(() => {
    if (data) setRate(data.defaultExchangeRate);
  }, [data]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    const value = rate.trim();
    if (!RATE_PATTERN.test(value) || !(Number(value) > 0)) {
      setFieldError('Enter a rate greater than 0 with up to 6 decimal places, for example 1.887');
      return;
    }
    setFieldError(undefined);
    setSaving(true);
    try {
      set(await updateExchangeRate(value));
      setSaved(true);
    } catch (err) {
      const apiErr = ApiError.from(err);
      setFieldError(apiErr.fieldError('defaultExchangeRate'));
      if (!apiErr.fieldError('defaultExchangeRate')) setSaveError(apiErr);
    } finally {
      setSaving(false);
    }
  }

  const preview = example(rate.trim());
  const dirty = data ? rate.trim() !== data.defaultExchangeRate : false;

  return (
    <Panel>
      <PanelHeader title="Pricing defaults" description="Used to prefill new goods. Changing the rate does not alter goods already recorded." />
      {error ? (
        <ErrorState error={error} onRetry={() => load(true)} />
      ) : loading || !data ? (
        <PanelBody className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full max-w-xs" />
        </PanelBody>
      ) : (
        <PanelBody>
          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Exchange rate (GHS per 1 CNY)"
                error={fieldError}
                hint={preview ? `A ¥10 item would be suggested at GHS ${preview}.` : 'For example 1.887'}
              >
                <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} disabled={!editable || saving} autoComplete="off" />
              </Field>
              <Field label="Price multiplier" hint="Fixed at 3 for the first release.">
                <Input value={data.priceMultiplier} disabled readOnly />
              </Field>
            </div>

            <p className="text-[12.5px] text-ink-3">
              {data.updatedAt ? `Last changed ${dateTime(data.updatedAt)}${data.updatedBy ? ` by ${data.updatedBy}` : ''}.` : 'Using the default from the reference spreadsheet.'}
            </p>

            {saved && <Notice tone="success" title="Exchange rate saved" />}
            {saveError && (
              <Notice tone="error" title="The rate was not saved">
                {saveError.message}
              </Notice>
            )}
            {!editable && <Notice>Only administrators can change pricing defaults.</Notice>}

            {editable && (
              <div>
                <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
                  Save exchange rate
                </Button>
              </div>
            )}
          </form>
        </PanelBody>
      )}
    </Panel>
  );
}

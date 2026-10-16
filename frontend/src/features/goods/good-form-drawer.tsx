'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { ghs } from '@/lib/format';
import { SHIPMENT_FLOW, STATUS_META } from '@/lib/status';
import type { Good, GoodDetail, ShipmentStatus } from '@/lib/types';
import { useLookups } from '@/features/lookups/use-lookups';
import { usePricingSettings } from '@/features/settings/use-pricing-settings';
import { toast } from '@/stores/toast-store';
import { goodsApi, type GoodInput } from './api';
import { previewFinancials } from './pricing-preview';

export type GoodFormMode = { mode: 'create' } | { mode: 'edit'; good: Good };

interface BuyerSplit {
  clientId: string;
  quantity: string;
}

interface FormState {
  itemName: string;
  trackingNumber: string;
  /** Lot owner. When 2+ buyers are picked, set this to the Stock client. */
  clientId: string;
  /** Buying clients picked in Add Good (1 = classic, 2+ = split at recording). */
  buyerIds: string[];
  /** Per-buyer units when splitting. Defaults to an equal split of quantity. */
  splits: BuyerSplit[];
  supplierId: string;
  categoryId: string;
  quantity: string;
  quantitySold: string;
  unitCost: string;
  exchangeRate: string;
  overrideOn: boolean;
  sellingPrice: string;
  overrideReason: string;
  retailPrice: string;
  status: ShipmentStatus;
  chinaCheckedIn: boolean;
  orderedAt: string;
  notes: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function initialState(mode: GoodFormMode, defaultRate: string): FormState {
  if (mode.mode === 'edit') {
    const g = mode.good;
    return {
      itemName: g.itemName,
      trackingNumber: g.trackingNumber ?? '',
      clientId: g.client.id,
      buyerIds: [g.client.id],
      splits: [],
      supplierId: g.supplier.id,
      categoryId: g.category.id,
      quantity: String(g.quantity),
      quantitySold: String(g.quantitySold),
      unitCost: g.unitCost,
      exchangeRate: g.exchangeRate,
      overrideOn: g.priceOverridden,
      sellingPrice: g.priceOverridden ? g.sellingPrice : '',
      overrideReason: g.overrideReason ?? '',
      retailPrice: g.retailPrice ?? '',
      status: g.status,
      chinaCheckedIn: g.chinaCheckedIn,
      orderedAt: g.dates.orderedAt ?? '',
      notes: g.notes ?? '',
    };
  }
  return {
    itemName: '',
    trackingNumber: '',
    clientId: '',
    buyerIds: [],
    splits: [],
    supplierId: '',
    categoryId: '',
    quantity: '1',
    quantitySold: '0',
    unitCost: '',
    exchangeRate: defaultRate,
    overrideOn: false,
    sellingPrice: '',
    overrideReason: '',
    retailPrice: '',
    status: 'ORDERED',
    chinaCheckedIn: false,
    orderedAt: todayIso(),
    notes: '',
  };
}

const DEC = (int: number, frac: number) => new RegExp(`^\\d{1,${int}}(\\.\\d{1,${frac}})?$`);
const PATTERNS = { unitCost: DEC(10, 4), exchangeRate: DEC(6, 6), money: DEC(12, 2) };

type Errors = Partial<Record<keyof FormState | 'form', string>>;

function validate(s: FormState, mode: GoodFormMode): Errors {
  const e: Errors = {};
  if (!s.itemName.trim()) e.itemName = 'Enter the item name.';
  const multi = mode.mode === 'create' && s.buyerIds.length > 1;
  if (mode.mode === 'create') {
    if (!s.buyerIds.length) e.clientId = 'Tick at least one buying client, or Stock if it is for resale.';
    if (multi) {
      if (!s.clientId) e.clientId = 'Choose the lot holder (usually Stock) for a split sale.';
      const q = Number(s.quantity);
      let assigned = 0;
      for (const sp of s.splits) {
        if (!/^\d+$/.test(sp.quantity) || Number(sp.quantity) < 1) {
          e.clientId = 'Give each buyer whole units of at least 1.';
          break;
        }
        assigned += Number(sp.quantity);
      }
      if (!e.clientId && /^\d+$/.test(s.quantity) && assigned > q) {
        e.clientId = `The buyers' shares (${assigned}) are more than the quantity (${q}).`;
      }
    } else if (!s.clientId && !s.buyerIds.length) {
      e.clientId = 'Choose a client, or Stock if it is for resale.';
    }
  } else if (!s.clientId) {
    e.clientId = 'Choose a client, or Stock if it is for resale.';
  }
  if (!s.categoryId) e.categoryId = 'Choose a category.';
  const q = Number(s.quantity);
  if (!/^\d+$/.test(s.quantity) || q < 1) e.quantity = 'Enter a whole number of at least 1.';
  if (!/^\d+$/.test(s.quantitySold) || Number(s.quantitySold) > q) e.quantitySold = `Enter a whole number up to ${Number.isFinite(q) ? q : 'the quantity'}.`;
  if (!PATTERNS.unitCost.test(s.unitCost) || !(Number(s.unitCost) > 0)) e.unitCost = 'Enter the price per unit in yuan, e.g. 12.50.';
  if (!PATTERNS.exchangeRate.test(s.exchangeRate) || !(Number(s.exchangeRate) > 0)) e.exchangeRate = 'Enter a rate greater than 0, e.g. 1.887.';
  if (s.overrideOn) {
    if (!PATTERNS.money.test(s.sellingPrice) || !(Number(s.sellingPrice) > 0)) e.sellingPrice = 'Enter the selling price per unit in cedis.';
    const priceChanged = mode.mode === 'create' || !mode.good.priceOverridden || Number(mode.good.sellingPrice) !== Number(s.sellingPrice);
    if (priceChanged && s.overrideReason.trim().length < 3) e.overrideReason = 'Say why this price differs from the suggested one.';
  }
  if (s.retailPrice && !PATTERNS.money.test(s.retailPrice)) e.retailPrice = 'Enter an amount in cedis, or leave it empty.';
  return e;
}

function toPayload(s: FormState, mode: GoodFormMode, fallbackSupplierId?: string): GoodInput {
  const nullable = (v: string) => (v.trim() ? v.trim() : null);
  // Supplier is hidden from the form: keep the existing one on edit, or the
  // default active supplier on create, so the required API field still sends.
  const supplierId = s.supplierId || fallbackSupplierId || '';
  const full: GoodInput = {
    itemName: s.itemName.trim(),
    trackingNumber: nullable(s.trackingNumber),
    clientId: s.clientId,
    supplierId,
    categoryId: s.categoryId,
    quantity: Number(s.quantity),
    quantitySold: Number(s.quantitySold),
    unitCost: s.unitCost,
    exchangeRate: s.exchangeRate,
    retailPrice: nullable(s.retailPrice),
    orderedAt: nullable(s.orderedAt),
    notes: nullable(s.notes),
  };

  if (mode.mode === 'create') {
    const multi = s.buyerIds.length > 1;
    return {
      ...full,
      // Single buyer: they own the lot (classic). Split: the lot sits under
      // clientId (Stock) and each picked buyer gets their share.
      clientId: multi ? s.clientId : (s.buyerIds[0] ?? s.clientId),
      status: s.status,
      chinaCheckedIn: s.chinaCheckedIn,
      ...(s.overrideOn ? { sellingPrice: s.sellingPrice, overrideReason: s.overrideReason.trim() } : {}),
      ...(multi
        ? {
            allocations: s.splits.map((sp) => ({ clientId: sp.clientId, quantity: Number(sp.quantity) })),
          }
        : {}),
    };
  }

  // Edit: send only what changed, so the audit trail stays precise.
  const before = initialState(mode, mode.good.exchangeRate);
  const beforePayload = toPayload(before, { mode: 'create' });
  const patch: GoodInput = {};
  for (const key of Object.keys(full) as (keyof GoodInput)[]) {
    if (JSON.stringify(full[key]) !== JSON.stringify(beforePayload[key])) (patch as Record<string, unknown>)[key] = full[key];
  }
  if (s.overrideOn) {
    const priceChanged = !mode.good.priceOverridden || Number(mode.good.sellingPrice) !== Number(s.sellingPrice);
    if (priceChanged) Object.assign(patch, { sellingPrice: s.sellingPrice, overrideReason: s.overrideReason.trim() });
    else if (s.overrideReason.trim() !== (mode.good.overrideReason ?? '')) patch.overrideReason = s.overrideReason.trim();
  } else if (mode.good.priceOverridden) {
    patch.sellingPrice = null;
  }
  return patch;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-b border-line-soft pb-5 last:border-b-0 last:pb-0">
      <legend className="mb-3 text-[13px] font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

interface Props {
  state: GoodFormMode | null;
  onClose: () => void;
  onSaved: (good: GoodDetail, mode: GoodFormMode['mode']) => void;
}

export function GoodFormDrawer({ state, onClose, onSaved }: Props) {
  const { data: lookups } = useLookups();
  const { data: pricing } = usePricingSettings();
  const defaultRate = pricing?.defaultExchangeRate ?? '1.887';
  const [form, setForm] = useState<FormState>(() => initialState(state ?? { mode: 'create' }, defaultRate));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state) {
      setForm(initialState(state, defaultRate));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const multiplier = state?.mode === 'edit' ? state.good.priceMultiplier : (pricing?.priceMultiplier ?? '3');
  const preview = useMemo(
    () => previewFinancials({ quantity: form.quantity, unitCost: form.unitCost, exchangeRate: form.exchangeRate, multiplier, override: form.overrideOn ? form.sellingPrice : undefined }),
    [form.quantity, form.unitCost, form.exchangeRate, form.overrideOn, form.sellingPrice, multiplier],
  );

  if (!state) return null;
  const isEdit = state.mode === 'edit';
  const rateDiffers = isEdit && pricing && Number(form.exchangeRate) !== Number(pricing.defaultExchangeRate);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = validate(form, state!);
    setErrors(v);
    if (Object.keys(v).length) return;

    // Hidden supplier: fall back to the first active supplier so create still sends a valid id.
    const fallbackSupplierId = !isEdit && !form.supplierId ? (lookups?.suppliers[0]?.id ?? '') : undefined;
    const payload = toPayload(form, state!, fallbackSupplierId);
    if (!isEdit && !payload.supplierId) {
      setErrors({ form: 'No active supplier exists yet. Add one under Master data first.' });
      return;
    }
    if (isEdit && Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const saved = isEdit ? await goodsApi.update((state as { good: Good }).good.id, payload) : await goodsApi.create(payload);
      if (isEdit) {
        toast.success('Changes saved');
      } else if (saved.buyers?.length > 1) {
        toast.success(`${saved.itemName} added`, `Split across ${saved.buyers.map((b) => b.name).join(', ')} — ${saved.itemsLeft} left.`);
      } else {
        toast.success(`${saved.itemName} added`);
      }
      onSaved(saved, state!.mode);
    } catch (err) {
      const apiErr = ApiError.from(err);
      const fieldErrors: Errors = {};
      for (const f of apiErr.fields) fieldErrors[f.field as keyof FormState] = f.message;
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: apiErr.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      variant="drawer"
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Edit good' : 'Add good'}
      description={isEdit ? (state as { good: Good }).good.itemName : 'Prices are calculated from the unit cost and exchange rate.'}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="good-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Add good'}
          </Button>
        </>
      }
    >
      <form id="good-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        {errors.form && <Notice tone="error" title="Not saved">{errors.form}</Notice>}

        <Section title="Item">
          <Field label="Tracking number" error={errors.trackingNumber} hint="The delivery ID on the parcel. Several items can share one.">
            <Input value={form.trackingNumber} onChange={(e) => set('trackingNumber', e.target.value)} className="font-mono" maxLength={64} autoFocus={!isEdit} />
          </Field>
          <Field label="Item name" error={errors.itemName}>
            <Input value={form.itemName} onChange={(e) => set('itemName', e.target.value)} maxLength={200} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isEdit ? (
              <Field
                label="Clients (buyers)"
                error={errors.clientId}
                hint={
                  form.buyerIds.length > 1
                    ? `${form.buyerIds.length} buyers — split the quantity below. The lot is held under Stock.`
                    : 'Tick every client buying this good — e.g. Anita, Cons and Grace.'
                }
              >
                <>
                <div className="max-h-44 overflow-auto rounded-control border border-line bg-surface px-2 py-1.5">
                  {lookups?.clients.map((c) => {
                    const checked = form.buyerIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1.5 text-[13px] hover:bg-mist">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...form.buyerIds, c.id] : form.buyerIds.filter((id) => id !== c.id);
                            // Keep one split row per buyer, defaulting to an equal share.
                            const q = Math.max(1, Number(form.quantity) || 1);
                            const each = Math.max(1, Math.floor(q / Math.max(1, next.length)));
                            set('buyerIds', next);
                            set(
                              'splits',
                              next.map((id, i) => {
                                const prev = form.splits.find((sp) => sp.clientId === id);
                                if (prev) return prev;
                                const remaining = q - each * i;
                                return { clientId: id, quantity: String(i === next.length - 1 ? Math.max(1, remaining) : each) };
                              }),
                            );
                            // Auto-hold split lots under Stock so totals never double-count.
                            if (next.length > 1) {
                              const stock = lookups?.clients.find((x) => x.isStock);
                              if (stock) set('clientId', stock.id);
                            } else if (next.length === 1) {
                              set('clientId', next[0]);
                            }
                          }}
                          className="size-4 accent-[var(--fjord)]"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {c.isStock ? 'Stock (unassigned)' : c.name}
                          <span className="ml-1.5 font-mono text-xs text-ink-3">{c.code}</span>
                        </span>
                      </label>
                    );
                  }) ?? <p className="px-1.5 py-1 text-[13px] text-ink-3">Loading clients…</p>}
                </div>
                {form.buyerIds.length > 0 && (
                  <p className="mt-1 text-xs text-ink-2">
                    {form.buyerIds.length} selected: {form.buyerIds.map((id) => lookups?.clients.find((c) => c.id === id)?.name ?? '…').join(', ')}
                  </p>
                )}
                </>
              </Field>
            ) : (
              <Field label="Client" error={errors.clientId}>
                <Select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
                  <option value="">Choose…</option>
                  {lookups?.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Category" error={errors.categoryId}>
              <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Choose…</option>
                {lookups?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        {!isEdit && form.buyerIds.length > 1 && (
          <Section title={`Split ${form.quantity || '—'} units across ${form.buyerIds.length} buyers`}>
            {(() => {
              const q = Number(form.quantity);
              const assigned = form.splits.reduce((n, sp) => n + (Number(sp.quantity) || 0), 0);
              const left = Number.isFinite(q) ? q - assigned : 0;
              return (
                <div className="flex flex-col gap-2.5">
                  {form.splits.map((sp) => {
                    const client = lookups?.clients.find((c) => c.id === sp.clientId);
                    return (
                      <div key={sp.clientId} className="grid grid-cols-[1fr_110px] items-end gap-3">
                        <p className="truncate text-[13px] font-medium">
                          {client?.isStock ? 'Stock (unassigned)' : (client?.name ?? '…')}
                          <span className="ml-1.5 font-mono text-xs font-normal text-ink-3">{client?.code}</span>
                        </p>
                        <Field label="Units">
                          <Input
                            inputMode="numeric"
                            value={sp.quantity}
                            onChange={(e) =>
                              set(
                                'splits',
                                form.splits.map((x) => (x.clientId === sp.clientId ? { ...x, quantity: e.target.value } : x)),
                              )
                            }
                          />
                        </Field>
                      </div>
                    );
                  })}
                  <p className={`text-xs ${left < 0 ? 'font-medium text-rose' : 'text-ink-3'}`}>
                    {left < 0
                      ? `${Math.abs(left)} too many — lower a share or raise the quantity.`
                      : left === 0
                        ? 'All units assigned.'
                        : `${left} of ${form.quantity} unassigned — left on the lot under Stock.`}
                  </p>
                </div>
              );
            })()}
          </Section>
        )}

        <Section title="Cost and price">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quantity" error={errors.quantity}>
              <Input inputMode="numeric" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            </Field>
            <Field label="Unit cost (¥)" error={errors.unitCost}>
              <Input inputMode="decimal" value={form.unitCost} onChange={(e) => set('unitCost', e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Rate (GHS per ¥)" error={errors.exchangeRate} hint={rateDiffers ? `Today’s default is ${pricing!.defaultExchangeRate}` : undefined}>
              <Input inputMode="decimal" value={form.exchangeRate} onChange={(e) => set('exchangeRate', e.target.value)} />
            </Field>
          </div>

          <div className="rounded-control border border-line bg-mist px-3.5 py-3 text-[13px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-ink-2">Suggested price per unit</span>
              <span className="font-semibold">{preview ? ghs(preview.suggested) : '—'}</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              Unit cost × rate × {multiplier}
              {preview ? ` = ${form.unitCost} × ${form.exchangeRate} × ${multiplier}` : ''}
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={form.overrideOn}
              onChange={(e) => {
                set('overrideOn', e.target.checked);
                if (e.target.checked && !form.sellingPrice && preview) set('sellingPrice', preview.suggested.toFixed(2));
              }}
              className="mt-0.5 size-4 accent-[var(--fjord)]"
            />
            <span>
              <span className="font-medium">Sell at a different price</span>
              <span className="block text-ink-3">Like the spreadsheet’s “Actual Selling Price”. The suggested price is kept beside it.</span>
            </span>
          </label>

          {form.overrideOn && (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <Field label="Selling price (GHS)" error={errors.sellingPrice}>
                <Input inputMode="decimal" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} />
              </Field>
              <Field label="Reason" error={errors.overrideReason}>
                <Input value={form.overrideReason} onChange={(e) => set('overrideReason', e.target.value)} maxLength={500} placeholder="e.g. Market price for this size" />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Retail price (GHS)" error={errors.retailPrice} hint="Optional, for reference.">
              <Input inputMode="decimal" value={form.retailPrice} onChange={(e) => set('retailPrice', e.target.value)} />
            </Field>
            {isEdit && (
              <Field label="Quantity sold" error={errors.quantitySold} hint={`${Math.max(0, Number(form.quantity) - Number(form.quantitySold)) || 0} left`}>
                <Input inputMode="numeric" value={form.quantitySold} onChange={(e) => set('quantitySold', e.target.value)} />
              </Field>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line-soft text-[13px] sm:grid-cols-4">
            {[
              ['Landed cost', preview ? ghs(preview.totalCost) : '—', ''],
              ['Revenue', preview ? ghs(preview.revenue) : '—', ''],
              ['Profit', preview ? ghs(preview.profit) : '—', preview && preview.profit < 0 ? 'text-rose' : 'text-mint'],
              ['Margin', preview?.margin != null ? `${preview.margin.toFixed(1)}%` : '—', ''],
            ].map(([label, value, cls]) => (
              <div key={label} className="bg-surface px-3 py-2.5">
                <dt className="text-xs text-ink-3">{label}</dt>
                <dd className={cn('font-semibold', cls)}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="-mt-2 text-xs text-ink-3">Estimate. The server calculates the stored figures with exact decimals when you save.</p>
        </Section>

        <Section title="Shipment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ordered on" error={errors.orderedAt}>
              <Input type="date" value={form.orderedAt} onChange={(e) => set('orderedAt', e.target.value)} />
            </Field>
            {!isEdit && (
              <Field label="Current status" hint="For goods already on their way when recorded.">
                <Select value={form.status} onChange={(e) => set('status', e.target.value as ShipmentStatus)}>
                  {SHIPMENT_FLOW.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          {!isEdit && (
            <label className="flex items-center gap-2.5 text-[13px]">
              <input type="checkbox" checked={form.chinaCheckedIn} onChange={(e) => set('chinaCheckedIn', e.target.checked)} className="size-4 accent-[var(--fjord)]" />
              Already checked in at the China warehouse
            </label>
          )}
          {isEdit && <p className="text-[12.5px] text-ink-3">Change the status and China check-in from the goods list or the details panel, so each move is recorded in the timeline.</p>}
        </Section>
      </form>
    </Dialog>
  );
}

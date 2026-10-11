import { cn } from '@/lib/cn';
import { cny, count, dateTime, ghs, percent } from '@/lib/format';
import type { Good } from '@/lib/types';

function Line({ label, formula, value, strong, tone }: { label: string; formula?: string; value: string; strong?: boolean; tone?: 'pos' | 'neg' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className={cn(strong ? 'font-medium' : 'text-ink-2')}>{label}</p>
        {formula && <p className="text-xs text-ink-3">{formula}</p>}
      </div>
      <p className={cn('whitespace-nowrap', strong && 'font-semibold', tone === 'pos' && 'text-mint', tone === 'neg' && 'text-rose')}>{value}</p>
    </div>
  );
}

/** Every figure with the inputs that produced it, so a total can be checked by hand. */
export function FinancialBreakdown({ good: g }: { good: Good }) {
  const profitTone = Number(g.profit) < 0 ? 'neg' : 'pos';
  return (
    <div className="divide-y divide-line-soft text-[13px]">
      <Line label="Suggested price per unit" formula={`${cny(g.unitCost)} × ${g.exchangeRate} × ${g.priceMultiplier}`} value={ghs(g.suggestedPrice)} />
      <div className="py-2">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-medium">Selling price per unit</p>
          <p className="font-semibold">{ghs(g.sellingPrice)}</p>
        </div>
        {g.priceOverridden ? (
          <p className="mt-1 rounded-md bg-glacier px-2.5 py-1.5 text-xs text-ink-2">
            Set manually{g.overriddenBy ? ` by ${g.overriddenBy.name}` : ''}
            {g.overriddenAt ? ` on ${dateTime(g.overriddenAt)}` : ''}. Reason: {g.overrideReason ?? 'not given'}
          </p>
        ) : (
          <p className="text-xs text-ink-3">Uses the suggested price</p>
        )}
      </div>
      <Line label="Landed cost" formula={`${count(g.quantity)} × ${cny(g.unitCost)} × ${g.exchangeRate}`} value={ghs(g.totalCost)} />
      <Line label="Expected revenue" formula={`${count(g.quantity)} × ${ghs(g.sellingPrice)}`} value={ghs(g.expectedRevenue)} />
      <Line label="Profit" formula="Revenue − landed cost" value={ghs(g.profit)} strong tone={profitTone} />
      <Line label="Margin" formula="Profit ÷ revenue" value={percent(g.margin)} />
      {g.retailPrice && <Line label="Retail price (reference)" value={ghs(g.retailPrice)} />}
    </div>
  );
}

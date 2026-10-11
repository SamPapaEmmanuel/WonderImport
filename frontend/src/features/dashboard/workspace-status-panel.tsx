'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DotBadge, RoleBadge } from '@/components/ui/badge';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLE_LABEL } from '@/lib/roles';
import { useRequest } from '@/lib/use-request';
import { usePricingSettings } from '@/features/settings/use-pricing-settings';
import { useSessionStore } from '@/stores/session-store';
import { getHealth } from './api';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-4 border-b border-line-soft px-[18px] py-3 text-[13px] last:border-b-0">
      <span className="text-ink-3">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Confirms each part of the Phase 1 foundation is connected: API, database, auth, settings. */
export function WorkspaceStatusPanel() {
  const me = useSessionStore((s) => s.me);
  const health = useRequest(getHealth);
  const pricing = usePricingSettings();

  const apiUp = !health.error && health.data;
  const dbUp = health.data?.database === 'up';

  return (
    <Panel>
      <PanelHeader
        title="System status"
        description="Connections this workspace depends on."
        actions={
          <Button size="sm" variant="ghost" onClick={() => void health.reload()} loading={health.loading}>
            Check again
          </Button>
        }
      />
      <Row label="API">
        {health.loading && !health.data ? (
          <Skeleton className="h-4 w-32" />
        ) : apiUp ? (
          <span className="flex flex-wrap items-center gap-2">
            <DotBadge color="var(--mint)">Connected</DotBadge>
            <span className="text-ink-3">
              {health.data!.latencyMs} ms, version {health.data!.version}
            </span>
          </span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <DotBadge color="var(--rose)" className="self-start">
              Unreachable
            </DotBadge>
            <span className="text-ink-3">{health.error?.message}</span>
          </span>
        )}
      </Row>
      <Row label="Database">
        {health.loading && !health.data ? (
          <Skeleton className="h-4 w-24" />
        ) : dbUp ? (
          <DotBadge color="var(--mint)">Connected</DotBadge>
        ) : (
          <DotBadge color="var(--rose)">{health.data ? 'Not responding' : 'Unknown'}</DotBadge>
        )}
      </Row>
      <Row label="Signed in as">
        {me && (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{me.name}</span>
            <RoleBadge>{ROLE_LABEL[me.role]}</RoleBadge>
          </span>
        )}
      </Row>
      <Row label="Exchange rate">
        {pricing.data ? (
          <span>
            1 CNY = <b className="font-semibold">GHS {pricing.data.defaultExchangeRate}</b>
            <span className="text-ink-3">, price = cost × rate × {pricing.data.priceMultiplier}</span>
          </span>
        ) : pricing.error ? (
          <span className="text-rose">{pricing.error.message}</span>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
      </Row>
    </Panel>
  );
}

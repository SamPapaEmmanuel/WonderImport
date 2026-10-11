'use client';

import { RoleBadge } from '@/components/ui/badge';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { ROLE_LABEL } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';

const ROLE_SUMMARY = {
  ADMIN: 'Full access, including price defaults, shipment corrections, suppliers, categories and users.',
  STAFF: 'Records and updates goods and clients, overrides prices with a reason, imports and exports.',
  VIEWER: 'Read-only access to the dashboard, goods and clients.',
} as const;

export function AccountPanel() {
  const me = useSessionStore((s) => s.me);
  if (!me) return null;
  return (
    <Panel>
      <PanelHeader title="Your account" />
      <PanelBody>
        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-[13px]">
          <dt className="text-ink-3">Name</dt>
          <dd className="font-medium">{me.name}</dd>
          <dt className="text-ink-3">Email</dt>
          <dd className="break-all">{me.email}</dd>
          <dt className="text-ink-3">Role</dt>
          <dd>
            <RoleBadge>{ROLE_LABEL[me.role]}</RoleBadge>
            <p className="mt-1.5 text-ink-2">{ROLE_SUMMARY[me.role]}</p>
          </dd>
        </dl>
      </PanelBody>
    </Panel>
  );
}

import { PageHeader } from '@/components/layout/page-header';
import { WorkspaceStatusPanel } from '@/features/dashboard/workspace-status-panel';
import { MasterDataPanel } from '@/features/master-data/master-data-panel';
import { AccountPanel } from './account-panel';
import { AdminOnly } from './admin-only';
import { AppearancePanel } from './appearance-panel';
import { PeoplePanel } from '@/features/users/people-panel';
import { PricingDefaultsPanel } from './pricing-defaults-panel';

export function SettingsScreen() {
  return (
    <>
      <PageHeader title="Settings" description="Your account, pricing defaults, suppliers and categories, and who can use WonderImport." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <PricingDefaultsPanel />
          <MasterDataPanel />
          <AdminOnly>
            <PeoplePanel />
          </AdminOnly>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <AppearancePanel />
          <AccountPanel />
          <WorkspaceStatusPanel />
        </div>
      </div>
    </>
  );
}

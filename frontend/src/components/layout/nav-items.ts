import { ChartColumn, LayoutDashboard, Package, Settings, Upload, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/goods', label: 'Goods', icon: Package },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/imports', label: 'Imports', icon: Upload },
  { href: '/reports', label: 'Reports', icon: ChartColumn },
  { href: '/settings', label: 'Settings', icon: Settings },
];

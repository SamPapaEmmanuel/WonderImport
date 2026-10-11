import { api } from '@/lib/axios-instance';
import type { DashboardSummary, Envelope, Health, PeriodKey } from '@/lib/types';

export async function getHealth() {
  const { data } = await api.get<Health>('/health');
  return data;
}

export async function getDashboardSummary(period: PeriodKey) {
  const { data } = await api.get<Envelope<DashboardSummary>>(`/dashboard/summary?period=${period}`);
  return data.data;
}

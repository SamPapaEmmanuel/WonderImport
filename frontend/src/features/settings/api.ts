import { api } from '@/lib/axios-instance';
import type { Envelope, PricingSettings } from '@/lib/types';

export async function getPricingSettings() {
  const { data } = await api.get<Envelope<PricingSettings>>('/settings/pricing');
  return data.data;
}

export async function updateExchangeRate(defaultExchangeRate: string) {
  const { data } = await api.patch<Envelope<PricingSettings>>('/settings/pricing', { defaultExchangeRate });
  return data.data;
}

import { api } from '@/lib/axios-instance';
import type { AuditEntry, Envelope, Good, GoodDetail, Paginated, ShipmentStatus, StatusChangeResult } from '@/lib/types';

export type GoodInput = {
  itemName?: string;
  trackingNumber?: string | null;
  quantity?: number;
  quantitySold?: number;
  unitCost?: string;
  exchangeRate?: string;
  sellingPrice?: string | null;
  overrideReason?: string | null;
  retailPrice?: string | null;
  clientId?: string;
  supplierId?: string;
  categoryId?: string;
  status?: ShipmentStatus;
  chinaCheckedIn?: boolean;
  orderedAt?: string | null;
  notes?: string | null;
};

export const goodsApi = {
  list: async (query: string) => (await api.get<Paginated<Good>>(`/goods${query ? `?${query}` : ''}`)).data,
  get: async (id: string) => (await api.get<Envelope<GoodDetail>>(`/goods/${id}`)).data.data,
  history: async (id: string) => (await api.get<Envelope<AuditEntry[]>>(`/goods/${id}/history`)).data.data,
  create: async (body: GoodInput) => (await api.post<Envelope<GoodDetail>>('/goods', body)).data.data,
  update: async (id: string, body: GoodInput) => (await api.patch<Envelope<GoodDetail>>(`/goods/${id}`, body)).data.data,
  changeStatus: async (id: string, body: { status: ShipmentStatus; expectedStatus?: ShipmentStatus; correction?: boolean; note?: string | null }) =>
    (await api.patch<StatusChangeResult>(`/goods/${id}/status`, body)).data,
  checkIn: async (id: string, checkedIn: boolean) => (await api.patch<Envelope<Good>>(`/goods/${id}/china-check-in`, { checkedIn })).data.data,
  duplicate: async (id: string) => (await api.post<Envelope<GoodDetail>>(`/goods/${id}/duplicate`)).data.data,
  archive: async (id: string, reason?: string) => (await api.post<Envelope<GoodDetail>>(`/goods/${id}/archive`, { reason })).data.data,
  restore: async (id: string) => (await api.post<Envelope<GoodDetail>>(`/goods/${id}/restore`)).data.data,
};

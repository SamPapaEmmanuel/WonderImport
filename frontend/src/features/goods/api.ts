import { api } from '@/lib/axios-instance';
import type { AuditEntry, Envelope, Good, GoodDetail, Paginated, PersonRef, ShipmentStatus, StatusChangeResult } from '@/lib/types';

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
  /** One-step multi-buyer creation: shares of the lot sold at recording time. */
  allocations?: { clientId: string; quantity: number; sellingPrice?: string | null; note?: string | null }[];
};

export interface Allocation {
  id: string;
  quantity: number;
  /** GHS per unit for this buyer; null inherits the lot's selling price. */
  sellingPrice: string | null;
  note: string | null;
  client: { id: string; code: string; name: string; isStock: boolean };
  createdBy: PersonRef | null;
  createdAt: string | null;
}

export interface AllocationsResult {
  data: Allocation[];
  meta: { quantity: number; legacySold: number; allocated: number; itemsLeft: number };
}

export interface AllocateResult {
  data: GoodDetail;
  allocation: Allocation & { priceInherited: boolean };
  itemsLeft: number;
}

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
  /** Sells units of one lot to a client; repeat per buyer until itemsLeft hits zero. */
  allocate: async (id: string, body: { clientId: string; quantity: number; sellingPrice?: string | null; note?: string | null }) =>
    (await api.post<AllocateResult>(`/goods/${id}/allocations`, body)).data,
  /** Every buyer holding units of this good, plus the remaining count. */
  allocations: async (id: string) => (await api.get<AllocationsResult>(`/goods/${id}/allocations`)).data,
};

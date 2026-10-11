import { api } from '@/lib/axios-instance';
import type { Client, Envelope, Paginated } from '@/lib/types';

export type ClientInput = { name?: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null };

export const clientsApi = {
  get: async (id: string) => (await api.get<Envelope<Client>>(`/clients/${id}`)).data.data,
  list: async (query: string) => (await api.get<Paginated<Client>>(`/clients${query ? `?${query}` : ''}`)).data,
  create: async (body: ClientInput) => (await api.post<Envelope<Client>>('/clients', body)).data.data,
  update: async (id: string, body: ClientInput) => (await api.patch<Envelope<Client>>(`/clients/${id}`, body)).data.data,
  archive: async (id: string) => (await api.post<Envelope<Client>>(`/clients/${id}/archive`, {})).data.data,
  restore: async (id: string) => (await api.post<Envelope<Client>>(`/clients/${id}/restore`)).data.data,
};

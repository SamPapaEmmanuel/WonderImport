import { api } from '@/lib/axios-instance';
import type { Category, Envelope, Supplier } from '@/lib/types';

export type MasterKind = 'suppliers' | 'categories';
type Row<K extends MasterKind> = K extends 'suppliers' ? Supplier : Category;

export const masterApi = {
  list: async <K extends MasterKind>(kind: K, archived: string) => (await api.get<Envelope<Row<K>[]>>(`/${kind}?archived=${archived}`)).data.data,
  create: async <K extends MasterKind>(kind: K, body: Record<string, unknown>) => (await api.post<Envelope<Row<K>>>(`/${kind}`, body)).data.data,
  update: async <K extends MasterKind>(kind: K, id: string, body: Record<string, unknown>) => (await api.patch<Envelope<Row<K>>>(`/${kind}/${id}`, body)).data.data,
  archive: async (kind: MasterKind, id: string) => (await api.post(`/${kind}/${id}/archive`)).data,
  restore: async (kind: MasterKind, id: string) => (await api.post(`/${kind}/${id}/restore`)).data,
};

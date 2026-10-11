import { api } from '@/lib/axios-instance';
import { downloadFromApi } from '@/lib/download';
import type { Envelope, ImportBatch, ImportBatchDetail, Paginated, RowMessage, ShipmentStatus } from '@/lib/types';

export interface UploadDefaults {
  defaultClientId: string;
  defaultSupplierId: string;
  defaultCategoryId: string;
  defaultStatus: ShipmentStatus | '';
  defaultExchangeRate: string;
}

export const importsApi = {
  list: async (page = 1) => (await api.get<Paginated<ImportBatch>>(`/imports?page=${page}&pageSize=10`)).data,
  get: async (id: string) => (await api.get<Envelope<ImportBatchDetail>>(`/imports/${id}`)).data.data,
  upload: async (file: File, defaults: UploadDefaults) => {
    const form = new FormData();
    form.append('file', file);
    for (const [k, v] of Object.entries(defaults)) if (v) form.append(k, v);
    return (await api.post<Envelope<ImportBatchDetail>>('/imports', form, { timeout: 120_000 })).data.data;
  },
  commit: async (id: string, rowNumbers: number[]) =>
    (await api.post<{ data: ImportBatchDetail; failedOnCommit: { rowNumber: number; messages: RowMessage[] }[] }>(`/imports/${id}/commit`, { rowNumbers }, { timeout: 120_000 })).data,
  archiveGoods: async (id: string, reason: string) => (await api.post<Envelope<{ archived: number }>>(`/imports/${id}/archive-goods`, { reason })).data.data,
  cancel: async (id: string) => (await api.post<Envelope<ImportBatchDetail>>(`/imports/${id}/cancel`)).data.data,
  template: (format: 'xlsx' | 'csv') => downloadFromApi(`/imports/template?format=${format}`, `wonderimport-goods-template.${format}`),
  errors: (id: string) => downloadFromApi(`/imports/${id}/errors`, 'rows-to-fix.xlsx'),
};

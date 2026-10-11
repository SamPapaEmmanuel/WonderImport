'use client';

import { api } from './axios-instance';

function fileNameFrom(disposition: string | undefined, fallback: string) {
  if (!disposition) return fallback;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

/**
 * Downloads a file from the API with the user's token and saves it under the server's file name.
 * Failures reject with ApiError (the interceptor decodes JSON error bodies of blob requests).
 */
export async function downloadFromApi(path: string, fallbackName: string) {
  const res = await api.get<Blob>(path, { responseType: 'blob', timeout: 120_000 });
  const name = fileNameFrom(res.headers['content-disposition'] as string | undefined, fallbackName);
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

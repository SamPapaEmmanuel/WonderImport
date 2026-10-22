import { AxiosError } from 'axios';
import type { ApiErrorBody, FieldError } from './types';

/** A normalised API failure the UI can render without inspecting Axios internals. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fields: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  fieldError(field: string) {
    return this.fields.find((f) => f.field === field)?.message;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (error instanceof AxiosError) {
      const body = error.response?.data as ApiErrorBody | undefined;
      if (body?.error) {
        return new ApiError(body.error.code, body.error.message, error.response!.status, body.error.fields ?? [], body.error.requestId);
      }
      if (!error.response) {
        const target = error.config?.baseURL ?? error.request?.responseURL ?? 'the configured API URL';
        return new ApiError(
          'NETWORK_ERROR',
          `Cannot reach the WonderImport API at ${target}. Check your connection, that the API server is running (GET /api/health should return status ok), and that NEXT_PUBLIC_API_URL matches where the API listens.`,
          0,
        );
      }
      return new ApiError('HTTP_ERROR', `The server responded with ${error.response.status}.`, error.response.status);
    }
    return new ApiError('UNKNOWN', error instanceof Error ? error.message : 'Unexpected error', 0);
  }
}

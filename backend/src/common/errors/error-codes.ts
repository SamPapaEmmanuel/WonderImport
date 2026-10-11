/** Stable error codes the web app can rely on for inline messaging. */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  ACCOUNT_NOT_PROVISIONED: 'ACCOUNT_NOT_PROVISIONED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONFLICT: 'CONFLICT',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldError[];
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

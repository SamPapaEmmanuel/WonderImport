import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, FieldError } from './error-codes';

const STATUS_FOR: Record<ErrorCode, HttpStatus> = {
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  ACCOUNT_NOT_PROVISIONED: HttpStatus.FORBIDDEN,
  ACCOUNT_DISABLED: HttpStatus.FORBIDDEN,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  VALIDATION_FAILED: HttpStatus.UNPROCESSABLE_ENTITY,
  CONFLICT: HttpStatus.CONFLICT,
  INVALID_STATUS_TRANSITION: HttpStatus.UNPROCESSABLE_ENTITY,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Throw this from services; the global filter turns it into the standard error envelope. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldError[],
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, fields, details }, STATUS_FOR[code]);
  }

  static notFound(entity: string) {
    return new AppException(ErrorCode.NOT_FOUND, `${entity} was not found`);
  }

  static validation(fields: FieldError[]) {
    const n = fields.length;
    return new AppException(ErrorCode.VALIDATION_FAILED, n === 1 ? fields[0].message : `${n} fields are invalid`, fields);
  }
}
